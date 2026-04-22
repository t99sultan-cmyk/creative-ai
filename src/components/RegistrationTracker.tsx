"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { trackRegistration } from "@/lib/fb-pixel";

/**
 * Fires `CompleteRegistration` to Meta Pixel exactly once per Clerk user.
 *
 * Strategy:
 *   1. localStorage holds `fb_reg_tracked:<userId>` so we never re-fire on
 *      repeat visits from the same browser.
 *   2. On first sign-in we also check Clerk's `user.createdAt`: if it's
 *      within a "fresh" window (10 min) we fire. If it's older, the user
 *      must have registered elsewhere (e.g. a previous session / before the
 *      pixel was installed) — we still mark them as tracked so we don't
 *      report a phantom registration days/weeks late, but don't fire the
 *      event to avoid polluting campaign reports with non-conversions.
 *
 * Why client-side and not Clerk webhook:
 *   Meta Pixel is browser-side already; server-side dedup is the job of
 *   the Conversions API (separate integration). Doing CompleteRegistration
 *   in the browser at the same moment the user's first PageView fires is
 *   what Meta's matching algorithm expects.
 */
const FRESH_REGISTRATION_WINDOW_MS = 10 * 60 * 1000;

export function RegistrationTracker() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const flagKey = `fb_reg_tracked:${user.id}`;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(flagKey)) return;
    } catch {
      // localStorage may be blocked (private mode / strict ITP) — skip dedup
      // rather than silently never firing.
    }

    const createdAtMs = user.createdAt?.getTime?.() ?? 0;
    const ageMs = Date.now() - createdAtMs;
    const isFresh = createdAtMs > 0 && ageMs >= 0 && ageMs < FRESH_REGISTRATION_WINDOW_MS;

    if (isFresh) {
      // Detect sign-up method for richer campaign segmentation. Clerk
      // exposes `externalAccounts` — if a Google/Apple account is linked,
      // that's the method they used.
      const externalProvider = user.externalAccounts?.[0]?.provider;
      const method = externalProvider
        ? externalProvider.toLowerCase().includes("google")
          ? ("google" as const)
          : ("other" as const)
        : ("email" as const);

      trackRegistration({ method });
    }

    try {
      localStorage.setItem(flagKey, "1");
    } catch {
      // If we can't persist the flag, we might re-fire on next mount — but
      // the isFresh check above will stop reporting after 10 min, so
      // the worst case is a single extra event for users who just signed
      // up in incognito. Acceptable.
    }
  }, [isLoaded, user]);

  return null;
}
