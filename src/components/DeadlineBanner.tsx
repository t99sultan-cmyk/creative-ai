"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

/**
 * Rolling-deadline urgency banner. The offer "ends today at 23:59 Almaty
 * time" every single day — at midnight local time the label rolls over
 * to the next day, so marketing copy never needs editing.
 *
 * Three visual variants so the same logic can drive the small sticky
 * top bar on the landing, the chunky hero card on /onboarding, and the
 * inline pre-footer block. Pick with `variant`.
 *
 *   sticky-top  — thin strip that sits above the site header, always
 *                 visible on scroll. No CTA (the whole page is the CTA).
 *   hero-card   — compact card with a flame badge, countdown, and the
 *                 "only today · then paid" subtitle. Used inside the
 *                 /onboarding welcome screen.
 *   inline      — full-bleed section with a headline + countdown + CTA
 *                 slot. Used on the landing just before the footer.
 *
 * Countdown is client-only; SSR renders a placeholder of the same size
 * to avoid hydration mismatch and layout shift.
 */
export function DeadlineBanner({
  variant = "hero-card",
  cta,
}: {
  variant?: "top-bar" | "hero-card" | "hero-inline" | "inline";
  /** Optional CTA shown in the `inline` variant. */
  cta?: React.ReactNode;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    const h =
      variant === "top-bar"
        ? "h-10"
        : variant === "inline"
          ? "h-[140px] md:h-[160px]"
          : variant === "hero-inline"
            ? "h-[54px]"
            : "h-[88px]";
    return <div className={h} aria-hidden />;
  }

  const dayLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
  }).format(now);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const deadline = new Date(
    `${parts.year}-${parts.month}-${parts.day}T23:59:59+05:00`,
  );
  const msLeft = Math.max(0, deadline.getTime() - now.getTime());
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  const s = Math.floor((msLeft % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (variant === "top-bar") {
    // Fixed at top so it stays visible above the nav bar. Caller is
    // expected to pad the page below by 40px (h-10) to compensate.
    return (
      <div className="fixed top-0 left-0 right-0 w-full bg-gradient-to-r from-hermes-600 via-red-500 to-amber-500 text-white shadow-md z-[60] h-10 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-4 flex items-center justify-center gap-2 md:gap-3 text-[12px] md:text-sm font-semibold">
          <span className="relative flex items-center">
            <Flame className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-200 animate-ping" />
          </span>
          <span className="hidden sm:inline">
            Бонус 7 Импульсов — только до{" "}
            <strong className="font-black">
              {dayLabel}, 23:59
            </strong>
          </span>
          <span className="sm:hidden">
            До <strong className="font-black">{dayLabel}, 23:59</strong>
          </span>
          <span className="font-mono tabular-nums font-black bg-black/25 rounded px-2 py-0.5 text-[11px] md:text-xs">
            {pad(h)}:{pad(m)}:{pad(s)}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-hermes-600 via-red-500 to-amber-500 p-6 md:p-10 text-white">
        {/* decorative blurs */}
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner shadow-white/20">
            <Flame className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80 mb-1">
              Успей, акция заканчивается
            </p>
            <h3 className="text-2xl md:text-3xl font-black leading-tight">
              7 Импульсов в подарок — только до{" "}
              <span className="underline decoration-white/50 decoration-2 underline-offset-4">
                {dayLabel}, 23:59
              </span>
            </h3>
            <p className="text-white/90 text-sm md:text-base mt-1">
              Этого хватит на 1 статичный + 1 анимированный креатив. Потом
              только платные тарифы.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <InlineTimeBox value={pad(h)} unit="ч" />
            <InlineTimeBox value={pad(m)} unit="м" />
            <InlineTimeBox value={pad(s)} unit="с" />
          </div>
        </div>
        {cta && (
          <div className="relative mt-5 md:mt-6 flex justify-center md:justify-start">
            {cta}
          </div>
        )}
      </div>
    );
  }

  if (variant === "hero-inline") {
    // Loud, can't-miss card for the landing hero. Big countdown, clear
    // "бесплатно" tag, and the specific date so visitors understand
    // both *what* they get and *when it disappears*. Light theme to
    // fit the neutral-50 landing background.
    return (
      <div className="relative overflow-hidden rounded-2xl bg-white p-4 md:p-5 shadow-[0_20px_60px_-20px_rgba(243,112,33,0.5)] ring-1 ring-hermes-500/30">
        <span className="absolute inset-0 bg-gradient-to-br from-hermes-50 via-white to-amber-50 pointer-events-none" />
        <span className="absolute -top-10 -right-10 w-40 h-40 bg-hermes-500/15 rounded-full blur-3xl pointer-events-none" />
        <span className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="relative flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-hermes-500 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Flame className="w-6 h-6 md:w-7 md:h-7 text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-300 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-300" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] md:text-[11px] font-black uppercase tracking-wider">
                Бесплатно
              </span>
              <span className="text-[11px] md:text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                акция действует
              </span>
            </div>
            <p className="text-[15px] md:text-lg font-black text-neutral-900 leading-tight">
              7 Импульсов в подарок —{" "}
              <span className="text-hermes-600">до {dayLabel}, 23:59</span>
            </p>
            <p className="hidden md:block text-xs text-neutral-500 font-medium mt-1">
              1 статичный + 1 анимированный креатив · без карты · без подписки
            </p>
          </div>

          <div className="flex-shrink-0 flex items-start gap-1 md:gap-1.5 font-mono tabular-nums">
            <HeroInlineTimeBox value={pad(h)} unit="час" />
            <span className="text-2xl md:text-3xl font-black text-hermes-400 leading-none pt-1.5">
              :
            </span>
            <HeroInlineTimeBox value={pad(m)} unit="мин" />
            <span className="text-2xl md:text-3xl font-black text-hermes-400 leading-none pt-1.5">
              :
            </span>
            <HeroInlineTimeBox value={pad(s)} unit="сек" />
          </div>
        </div>
      </div>
    );
  }

  // hero-card (default)
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-hermes-600/30 via-red-500/20 to-amber-500/30 border border-hermes-500/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-hermes-500 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
          <Flame className="w-5 h-5 text-white" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] md:text-sm font-bold leading-tight">
            Бонус 7 Импульсов — только сегодня
          </p>
          <p className="text-hermes-200 text-[11px] md:text-xs leading-tight mt-0.5">
            Акция активна до <strong>{dayLabel}, 23:59</strong> · потом
            только платно
          </p>
        </div>
        <div className="flex-shrink-0 flex items-baseline gap-1 font-mono tabular-nums text-white">
          <HeroTimeBox value={pad(h)} unit="ч" />
          <HeroTimeBox value={pad(m)} unit="м" />
          <HeroTimeBox value={pad(s)} unit="с" />
        </div>
      </div>
    </div>
  );
}

function HeroTimeBox({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-sm md:text-base font-black leading-none bg-black/30 rounded-md px-1.5 py-1 min-w-[28px] text-center">
        {value}
      </span>
      <span className="text-[9px] md:text-[10px] text-neutral-300 font-semibold mt-0.5">
        {unit}
      </span>
    </span>
  );
}

function HeroInlineTimeBox({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-2xl md:text-3xl font-black leading-none text-neutral-900 bg-gradient-to-br from-hermes-50 to-amber-50 ring-1 ring-hermes-500/30 rounded-lg px-2 md:px-2.5 py-1.5 min-w-[42px] md:min-w-[48px] text-center">
        {value}
      </span>
      <span className="text-[9px] md:text-[10px] text-neutral-500 font-bold mt-1 uppercase tracking-wider">
        {unit}
      </span>
    </span>
  );
}

function InlineTimeBox({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-xl md:text-2xl font-black leading-none bg-black/30 backdrop-blur-sm rounded-lg px-2.5 py-2 min-w-[44px] text-center ring-1 ring-white/20">
        {value}
      </span>
      <span className="text-[10px] md:text-[11px] text-white/80 font-bold mt-1 uppercase tracking-wider">
        {unit}
      </span>
    </span>
  );
}
