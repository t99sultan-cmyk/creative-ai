"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Meta (Facebook) Pixel — SPA-aware integration.
 *
 * Design notes
 * ------------
 * 1. Base loader AND the initial PageView are in the inline <Script> so
 *    they fire as early as possible — the pixel's main job is to catch
 *    the first impression, even for sessions that bounce before React
 *    effects run.
 *
 * 2. The useEffect in <PageViewTracker> is responsible ONLY for SPA
 *    navigations. On the very first mount it's a no-op (guarded by
 *    `firstRunRef`) so we don't double-count the initial PageView that
 *    the inline script already reported.
 *
 * 3. App Router doesn't full-reload on navigation, so the raw Meta
 *    snippet would miss every subsequent page view. We wire
 *    usePathname + useSearchParams into the effect's deps — any SPA
 *    navigation updates one of them and re-fires `fbq('track','PageView')`.
 *
 * 4. useSearchParams forces CSR on the subtree that reads it. We wrap
 *    the tracker in <Suspense> so only this tiny component opts out of
 *    static generation, not the whole page.
 *
 * 5. Pixel ID is read from NEXT_PUBLIC_META_PIXEL_ID with a fallback to
 *    the production ID (942198525226321). Set it to an empty string in
 *    a preview env to silence tracking.
 */

const DEFAULT_PIXEL_ID = "942198525226321";
const PIXEL_ID =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_META_PIXEL_ID) ||
  DEFAULT_PIXEL_ID;

// Type declaration for the globals Meta's loader attaches. Exported module
// augmentation — works for callers that import this file, and TypeScript
// ambient-merges it across the project via the .d.ts-like `declare global`.
declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: Window["fbq"];
    };
    _fbq?: Window["fbq"];
  }
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!PIXEL_ID) return;

    // Skip the mount run — the inline <Script> already fired the first
    // PageView. This effect exists only to catch subsequent client-side
    // navigations.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    if (typeof window === "undefined") return;
    if (typeof window.fbq === "function") {
      // After Meta's CDN script is loaded, this queues/dispatches the
      // event directly. Before it loads, the stub (defined by the inline
      // loader) queues it for the CDN script to replay — so this is
      // always safe to call.
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixel() {
  // If no pixel id, render nothing so we don't inject a broken script tag
  // on preview envs.
  if (!PIXEL_ID) return null;

  return (
    <>
      {/* Base loader. `afterInteractive` lets the page become
          interactive first, then injects Meta's tracker script — this is
          the strategy Next.js docs recommend for third-party analytics. */}
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />

      {/* Fallback for no-JS visitors — a tracking pixel via <img>. Harmless
          for everyone else. */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>

      {/* usePathname + useSearchParams force CSR on the subtree that reads
          them, so we isolate this in its own Suspense boundary. The rest
          of the page can still be statically generated. */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
