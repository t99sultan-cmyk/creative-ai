"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/auth/AuthContext";
import { trackRegistration } from "@/lib/fb-pixel";

/**
 * Fires `CompleteRegistration` to Meta Pixel exactly once per user.
 *
 * Strategy (post-Clerk migration):
 *   - The registerUser server action sets a short-lived
 *     `fb_just_registered` cookie. This component reads it on mount,
 *     fires the pixel, then clears the cookie.
 *   - `localStorage.fb_reg_tracked:<userId>` is a belt-and-suspenders
 *     dedup so even if the cookie somehow lingers we don't double-fire.
 *
 * Why client-side: Meta Pixel is browser-side; the moment the user's
 * first PageView fires after registration is what Meta's match algo
 * expects to see CompleteRegistration paired with.
 */
function readFreshRegistrationCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith("fb_just_registered=1"));
}

function clearFreshRegistrationCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "fb_just_registered=; Max-Age=0; path=/";
}

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

    const isFresh = readFreshRegistrationCookie();

    if (isFresh) {
      // Method is always "email" now — we removed all OAuth providers
      // when migrating off Clerk. If we add Google/Apple later, set
      // a different cookie value (e.g. fb_just_registered=google) and
      // branch on it here.
      trackRegistration({ method: "email", userId: user.id });
      clearFreshRegistrationCookie();
    }

    try {
      localStorage.setItem(flagKey, "1");
    } catch {
      // If we can't persist the flag, we might re-fire on next mount.
      // The cookie clears itself on first fire above, so worst case is
      // ONE extra event for users in incognito. Acceptable.
    }
  }, [isLoaded, user]);

  return null;
}
