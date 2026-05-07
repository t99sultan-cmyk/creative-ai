"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";
import { LandingProduct, PRODUCT_STACK_ITEMS } from "@/lib/landing-themes";

/**
 * The "4 продукта для всех каналов продаж" block. Lives on every
 * landing — discovers the other three products from whichever one
 * the user is currently on.
 *
 * `currentProduct` highlights one card (smaller, with a "Сейчас тут"
 * badge) and the others render normally. This is the cross-product
 * navigation pattern — every landing is a node in a 4-way star, and
 * this block is the star.
 *
 * Per-card colors are LITERAL Tailwind classes so JIT picks them up.
 * Don't try to drive these from props — colors live in the items
 * array as literal strings.
 */
const CARD_COLORS: Record<
  LandingProduct,
  {
    shadow: string;
    hoverShadow: string;
    hoverBorder: string;
    bgFrom: string;
    bgVia: string;
    bgTo: string;
    accent: string;
    accentText: string;
    accentTextHover: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  creatives: {
    shadow: "shadow-hermes-500/5",
    hoverShadow: "hover:shadow-hermes-500/15",
    hoverBorder: "hover:border-hermes-500/30",
    bgFrom: "from-hermes-50",
    bgVia: "via-amber-50",
    bgTo: "to-orange-50",
    accent: "bg-gradient-to-br from-hermes-500 to-amber-500",
    accentText: "text-hermes-600",
    accentTextHover: "group-hover:text-hermes-700",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  products: {
    shadow: "shadow-emerald-500/5",
    hoverShadow: "hover:shadow-emerald-500/15",
    hoverBorder: "hover:border-emerald-500/30",
    bgFrom: "from-emerald-50",
    bgVia: "via-teal-50",
    bgTo: "to-cyan-50",
    accent: "bg-gradient-to-br from-emerald-500 to-teal-500",
    accentText: "text-emerald-600",
    accentTextHover: "group-hover:text-emerald-700",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  sites: {
    shadow: "shadow-sky-500/5",
    hoverShadow: "hover:shadow-sky-500/15",
    hoverBorder: "hover:border-sky-500/30",
    bgFrom: "from-sky-50",
    bgVia: "via-blue-50",
    bgTo: "to-indigo-50",
    accent: "bg-gradient-to-br from-sky-500 to-blue-500",
    accentText: "text-sky-600",
    accentTextHover: "group-hover:text-sky-700",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  presentations: {
    shadow: "shadow-violet-500/5",
    hoverShadow: "hover:shadow-violet-500/15",
    hoverBorder: "hover:border-violet-500/30",
    bgFrom: "from-violet-50",
    bgVia: "via-purple-50",
    bgTo: "to-fuchsia-50",
    accent: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    accentText: "text-violet-600",
    accentTextHover: "group-hover:text-violet-700",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
};

const BADGE_BG: Record<"Live" | "Beta" | "Скоро", string> = {
  Live: "bg-emerald-100 text-emerald-700",
  Beta: "bg-amber-100 text-amber-700",
  "Скоро": "bg-neutral-100 text-neutral-500",
};

export function ProductStack({ currentProduct }: { currentProduct: LandingProduct }) {
  return (
    <section className="py-24 relative border-t border-neutral-100 bg-gradient-to-b from-white via-neutral-50/40 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <Reveal>
          <div className="text-center mb-12">
            <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">
              Полный креативный стек
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-neutral-900 mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-500 via-rose-500 to-violet-500">
                4 продукта
              </span>{" "}
              для всех каналов продаж
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
              ИИ создаёт всё что нужно для продаж: креативы для таргета,
              карточки для маркетплейсов, продающие сайты, питч-презентации.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {PRODUCT_STACK_ITEMS.map((item, i) => {
            const colors = CARD_COLORS[item.product];
            const isCurrent = item.product === currentProduct;
            return (
              <Reveal key={item.product} delay={0.05 * i}>
                <Link
                  href={item.href}
                  className={`group block rounded-3xl border bg-white overflow-hidden transition-all ${
                    isCurrent
                      ? "border-neutral-900 shadow-xl shadow-neutral-900/10"
                      : `border-neutral-200 shadow-xl ${colors.shadow} ${colors.hoverShadow} ${colors.hoverBorder} hover:-translate-y-1`
                  }`}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <div
                    className={`aspect-[16/10] bg-gradient-to-br ${colors.bgFrom} ${colors.bgVia} ${colors.bgTo} relative overflow-hidden flex items-center justify-center`}
                  >
                    <div
                      className={`w-2/3 aspect-square rounded-2xl ${colors.accent} shadow-md flex items-center justify-center`}
                    >
                      <div className="text-white text-xs font-black tracking-wider uppercase">
                        {item.title.split(" ")[0]}
                      </div>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${BADGE_BG[item.badge]}`}
                      >
                        {isCurrent ? "Сейчас тут" : item.badge}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${colors.accentText}`}
                      >
                        {item.cost}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-neutral-600 text-sm leading-relaxed mb-4">
                      {item.desc}
                    </p>
                    <div
                      className={`inline-flex items-center gap-1.5 text-sm font-bold ${colors.accentText} ${colors.accentTextHover} transition-colors`}
                    >
                      {isCurrent ? "Ты здесь" : "Открыть"}
                      <span className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
