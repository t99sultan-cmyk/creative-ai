"use client";

import Link from "next/link";
import clsx from "clsx";
import { Star, Zap, CheckCircle2 } from "lucide-react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Reveal } from "./Reveal";
import { PRICING_TIERS } from "@/lib/pricing";
import { trackInitiateCheckout } from "@/lib/fb-pixel";
import { isRegistrationOpen } from "@/lib/flags";
import { LandingTheme } from "@/lib/landing-themes";

/**
 * Shared pricing section for all 4 marketing landings. Themed by the
 * page's current product — the "Хит продаж" highlighted tier picks up
 * the page's accent color, the rest stay neutral.
 *
 * Reads `PRICING_TIERS` from src/lib/pricing.ts (single source of
 * truth; admin dashboard reads the same data). Click tracking via
 * trackInitiateCheckout for Meta Pixel ROAS attribution.
 *
 * Maintenance flag: when registration is closed, all CTAs render
 * disabled with «Скоро вернёмся» — same UX as the original inline
 * pricing block on the main landing.
 */
export function PricingSection({ theme }: { theme: LandingTheme }) {
  const { isSignedIn } = useAuth();
  const registrationOpen = isRegistrationOpen();

  return (
    <section id="pricing" className="py-24 relative border-t border-neutral-100 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4">
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-4">
              Выберите свой формат
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
              Импульсы обновляются каждый месяц. Неиспользованные не переносятся.
              <br className="hidden sm:inline" />
              <span className="font-semibold text-neutral-800">креатив = 4 ⚡</span>
              <span className="mx-2 text-neutral-300">·</span>
              <span className="font-semibold text-neutral-800">сайт / презентация / карточки = 30 ⚡</span>
              <span className="mx-2 text-neutral-300">·</span>
              <span className="font-semibold text-neutral-800">видео = 50 ⚡</span>
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {PRICING_TIERS.map((tier, idx) => {
            const checkoutHref =
              `/checkout?plan=${encodeURIComponent(tier.name)}` +
              `&price=${encodeURIComponent(tier.priceLabel.replace(/[^0-9]/g, ""))}` +
              `&impulses=${tier.impulses}`;

            const buttonClass = clsx(
              "w-full py-4 rounded-xl font-bold text-sm transition-all",
              tier.isHit
                ? `bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-[0_0_20px_rgba(0,0,0,0.15)] hover:opacity-90 active:scale-[0.98]`
                : "bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200 hover:border-neutral-300 active:scale-[0.98]",
            );

            const handlePricingClick = () => {
              trackInitiateCheckout({
                name: tier.name,
                priceKzt: tier.priceKzt,
                impulses: tier.impulses,
              });
            };

            return (
              <Reveal key={idx} delay={idx * 0.1}>
                <div
                  className={clsx(
                    "relative bg-white shadow-xl rounded-3xl p-8 border flex flex-col h-full hover:shadow-2xl transition-shadow duration-300",
                    tier.isHit
                      ? `${theme.accentBorder} shadow-[0_0_30px_rgba(0,0,0,0.1)]`
                      : "border-neutral-200 hover:border-neutral-300",
                  )}
                >
                  {tier.isHit && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 ${theme.accentBg} text-white text-xs font-black uppercase tracking-wider py-1 px-3 rounded-full flex items-center gap-1`}
                    >
                      <Star className="w-3 h-3" /> Хит продаж
                    </div>
                  )}
                  <div className="mb-2 text-neutral-600 text-sm font-medium uppercase tracking-widest">
                    {tier.name}
                  </div>
                  <div className="text-4xl font-extrabold text-neutral-900 mb-2">
                    {tier.priceLabel}
                  </div>
                  <div className="text-sm text-neutral-500 mb-8 pb-8 border-b border-neutral-200">
                    {tier.desc}
                  </div>

                  <div className="flex items-center gap-2 mb-8">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="text-2xl font-bold text-neutral-900">
                      {tier.impulses}{" "}
                      <span className="text-base font-normal text-neutral-500">импульсов</span>
                    </span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-grow">
                    {tier.features.map((feat, i) => (
                      <li key={i} className="flex gap-3 text-sm text-neutral-600">
                        <CheckCircle2 className={`w-5 h-5 ${theme.accentText} shrink-0`} />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {isSignedIn ? (
                    <Link
                      href={checkoutHref}
                      onClick={handlePricingClick}
                      className={buttonClass + " inline-block text-center"}
                    >
                      {tier.btn}
                    </Link>
                  ) : registrationOpen ? (
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl={checkoutHref}
                      signUpForceRedirectUrl="/onboarding"
                    >
                      <button onClick={handlePricingClick} className={buttonClass}>
                        {tier.btn}
                      </button>
                    </SignInButton>
                  ) : (
                    <button
                      disabled
                      aria-disabled="true"
                      className={buttonClass + " cursor-not-allowed opacity-60"}
                    >
                      Скоро вернёмся
                    </button>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
