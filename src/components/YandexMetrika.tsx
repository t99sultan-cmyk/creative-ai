"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Yandex.Metrika — SPA-aware integration.
 *
 * Architecture mirrors <MetaPixel /> intentionally:
 *
 * 1. Base loader + the initial page "hit" are in the inline <Script> so they
 *    fire as early as possible. Metrika's own loader queues `ym()` calls
 *    before tag.js finishes loading, so this is safe even if the user
 *    navigates away before the CDN script arrives.
 *
 * 2. The useEffect in <HitTracker> is responsible ONLY for SPA navigations.
 *    On first mount it's a no-op (guarded by `firstRunRef`) so we don't
 *    double-count the initial hit that `ym('init', ..., {})` already
 *    registered.
 *
 * 3. We wire usePathname + useSearchParams into the effect's deps — any SPA
 *    navigation updates one of them and re-fires `ym(ID,'hit', url)` with
 *    the new path. Without this Metrika would miss every client-side
 *    navigation in an App Router app.
 *
 * 4. useSearchParams opts the subtree into CSR. We wrap the tracker in its
 *    own <Suspense> so only this component leaves static generation, not
 *    the whole page.
 *
 * 5. Counter ID is read from NEXT_PUBLIC_YANDEX_METRIKA_ID with a fallback
 *    to the production counter 108720841. Set to an empty string in a
 *    preview env to silence tracking.
 *
 * Options (`webvisor`, `clickmap`, `trackLinks`, `accurateTrackBounce`,
 *  `ecommerce: "dataLayer"`) match the snippet Yandex generates in the
 *  admin panel — changing them here silently un-sets them in production.
 */

const DEFAULT_COUNTER_ID = "108720841";
const COUNTER_ID =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID) ||
  DEFAULT_COUNTER_ID;

// Ambient module augmentation for the global Metrika attaches. Exported
// module-level `declare global` so TS knows `window.ym` exists everywhere
// this file is imported (and across the project via the d.ts-like merge).
declare global {
  interface Window {
    ym?: {
      (counterId: number | string, method: string, ...args: unknown[]): void;
      a?: unknown[];
      l?: number;
    };
  }
}

function HitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!COUNTER_ID) return;

    // Skip the mount run — the inline loader already registered the first
    // hit via `ym('init', ID, {...})`. This effect catches subsequent
    // client-side navigations.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    if (typeof window === "undefined") return;
    if (typeof window.ym === "function") {
      // `hit` with explicit url + referer mirrors what a full page-reload
      // would log. Without these two params Metrika sometimes attributes
      // SPA views to the landing URL.
      window.ym(Number(COUNTER_ID), "hit", window.location.href, {
        referer: document.referrer,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function YandexMetrika() {
  // Empty counter id → render nothing. Avoids injecting a tag that would
  // request tag.js with `?id=` and pollute the user's network tab on
  // preview deployments.
  if (!COUNTER_ID) return null;

  return (
    <>
      {/* Base loader. `afterInteractive` lets the page become interactive
          first, then injects Metrika's tag.js — matches the pattern used
          by <MetaPixel />. The inline stub queues `ym()` calls so events
          fired before tag.js lands are replayed once it loads. */}
      <Script
        id="yandex-metrika-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}', 'ym');

            ym(${COUNTER_ID}, 'init', {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: "dataLayer",
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true
            });
          `,
        }}
      />

      {/* No-JS fallback pixel. Exact markup from Yandex's embed instructions
          so their server records a visit even from scraper/curl-like
          clients that never execute the script. */}
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            alt=""
            style={{ position: "absolute", left: "-9999px" }}
          />
        </div>
      </noscript>

      {/* usePathname + useSearchParams force CSR on the subtree that reads
          them. Isolated <Suspense> keeps the rest of the app statically
          generated. */}
      <Suspense fallback={null}>
        <HitTracker />
      </Suspense>
    </>
  );
}
