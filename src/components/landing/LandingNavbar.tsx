"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { isRegistrationOpen } from "@/lib/flags";
import { LandingTheme } from "@/lib/landing-themes";

/**
 * Top navbar shared across all 4 landings. Theme-aware: logo dot
 * and CTA button pick up the current page's accent color, so the
 * navbar instantly identifies which product the user is browsing.
 *
 * `anchors` is the list of in-page jumps for THIS landing — every
 * page has its own #how, #pricing, #faq, etc. Pass `[]` to render
 * a blank center (e.g. for a landing without anchor sections).
 *
 * Auth: signed-in user sees their UserButton + a "перейти" link
 * to the product's wizard/editor (`theme.ctaHref`). Signed-out
 * users get sign-in / start-free CTAs gated by isRegistrationOpen
 * (maintenance mode collapses to login-only).
 */
export function LandingNavbar({
  theme,
  anchors = [
    { href: "#how", label: "Как работает" },
    { href: "#pricing", label: "Тарифы" },
    { href: "#faq", label: "FAQ" },
  ],
  ctaLabel = "Создать",
}: {
  theme: LandingTheme;
  anchors?: Array<{ href: string; label: string }>;
  ctaLabel?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const registrationOpen = isRegistrationOpen();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-neutral-50/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${theme.gradientFrom} ${theme.gradientTo} flex items-center justify-center shadow-md`}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-neutral-900">
            AICreative
          </span>
          {theme.product !== "creatives" && (
            <span className="text-xs text-neutral-400 font-medium hidden sm:inline">
              · {theme.label}
            </span>
          )}
        </Link>

        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-600">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="hover:text-neutral-900 transition-colors"
            >
              {a.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isSignedIn ? (
            <div className="flex items-center gap-4">
              <Link
                href={theme.ctaHref}
                className={`text-sm font-bold text-white ${theme.accentBg} ${theme.accentBgHover} px-4 py-2 rounded-full transition-all`}
              >
                {ctaLabel}
              </Link>
              <UserButton />
            </div>
          ) : registrationOpen ? (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className={`text-sm font-bold text-white ${theme.accentBg} ${theme.accentBgHover} px-5 py-2 rounded-full shadow-md transition-all`}
              >
                Начать бесплатно
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-5 py-2 rounded-full border border-neutral-200 transition-all"
            >
              Войти
            </Link>
          )}
        </div>

        <button
          className="md:hidden text-neutral-600"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Меню"
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-neutral-200 bg-neutral-50/95 backdrop-blur-xl px-4 py-6 flex flex-col gap-4 overflow-hidden"
          >
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-neutral-600"
              >
                {a.label}
              </a>
            ))}
            {isSignedIn ? (
              <Link
                href={theme.ctaHref}
                className={`mt-4 text-center text-sm font-bold text-white ${theme.accentBg} px-5 py-3 rounded-xl transition-all`}
              >
                {ctaLabel}
              </Link>
            ) : registrationOpen ? (
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className={`mt-4 text-center text-sm font-bold text-white ${theme.accentBg} px-5 py-3 rounded-xl transition-all w-full`}
              >
                Начать бесплатно
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4 text-center text-sm font-bold text-neutral-900 bg-neutral-100 border border-neutral-200 px-5 py-3 rounded-xl transition-all w-full"
              >
                Войти
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
