"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ShieldAlert, LogOut } from "lucide-react";

/**
 * Sticky banner that appears when an admin has impersonated another user
 * (via the "Войти как" button in /admin). First activated by a
 * `?impersonating=1` query param on the Clerk sign-in-token redirect;
 * kept alive across navigations via sessionStorage.
 *
 * Clicking "Выйти из имперсонации" calls Clerk.signOut() and lands the
 * admin back on /admin. The admin is expected to sign in again with their
 * own account — we don't cache their previous session (too risky).
 *
 * Implementation note: intentionally NOT using next/navigation's
 * useSearchParams — that hook forces CSR bailout on the host page and
 * breaks `next build` when /editor is prerendered. We read
 * window.location.search manually inside a useEffect (client only), which
 * does the same job without poisoning static generation.
 */
export function ImpersonationBanner() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [active, setActive] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Read the URL once on mount (no useSearchParams → no CSR bailout).
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("impersonating") === "1";

    let fromSession = false;
    let savedEmail: string | null = null;
    try {
      fromSession = sessionStorage.getItem("impersonating") === "1";
      savedEmail = sessionStorage.getItem("impersonating_email");
    } catch {}

    if (fromUrl) {
      try {
        sessionStorage.setItem("impersonating", "1");
      } catch {}
      setActive(true);
    } else if (fromSession) {
      setActive(true);
    }

    if (savedEmail) setEmail(savedEmail);
  }, []);

  const exit = async () => {
    try {
      sessionStorage.removeItem("impersonating");
      sessionStorage.removeItem("impersonating_email");
    } catch {}
    // Sign out fully. The admin then re-authenticates on /admin with their
    // own email to get back into the admin panel.
    await signOut({ redirectUrl: "/admin" });
    router.push("/admin");
  };

  if (!active) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">
              Вы действуете от имени {email ? <span className="font-mono">{email}</span> : "пользователя"}
            </div>
            <div className="text-[11px] opacity-90 hidden sm:block">
              Все действия будут записаны от его имени. Пишется в audit log.
            </div>
          </div>
        </div>
        <button
          onClick={exit}
          className="shrink-0 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </div>
  );
}
