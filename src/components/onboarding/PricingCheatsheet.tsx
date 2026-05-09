"use client";

import { Zap, Sparkles, Video, Wand2, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import {
  STATIC_DUAL_COST,
  VIDEO_GEN_COST,
  VISION_REFINE_COST,
  SITE_GEN_COST,
} from "@/lib/pricing";

/**
 * Compact pricing cheatsheet shown on /onboarding. Quick reference
 * card so the user knows what each action costs in impulses BEFORE
 * they spend their 7-impulse welcome bonus.
 *
 * Uses constants from @/lib/pricing — single source of truth, so
 * if costs change there, this card updates automatically.
 *
 * KZT estimates assume ~52 ₸ per impulse (rough subscription math:
 * 2490 ₸ / 45 imp = ~55 ₸/imp on the cheapest tier; we round down
 * to 52 to be conservative for the user). Update if pricing shifts.
 */
const PRICE_PER_IMPULSE_KZT = 52;
const formatKzt = (impulses: number) =>
  `~${(impulses * PRICE_PER_IMPULSE_KZT).toLocaleString("ru-RU")} ₸`;

const ITEMS = [
  {
    icon: Sparkles,
    title: "1 креатив (статика)",
    cost: STATIC_DUAL_COST,
    accent: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    icon: Video,
    title: "1 видеоролик 5/10/15 сек",
    cost: VIDEO_GEN_COST,
    accent: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Wand2,
    title: "Кнопка «Улучшить»",
    cost: VISION_REFINE_COST,
    accent: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    icon: LayoutGrid,
    title: "Сайт / презентация / карточки",
    cost: SITE_GEN_COST,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
  },
] as const;

export function PricingCheatsheet() {
  return (
    <section className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-2">
          Цены
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-neutral-900">
          Сколько стоит каждое действие
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          У тебя на старте 7 ⚡ — хватит на 1 креатив + 1 «Улучшить»
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-lg shadow-black/5 border border-neutral-200 overflow-hidden">
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${
                i < ITEMS.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${item.accent}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                  {item.title}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">{formatKzt(item.cost)}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-sm font-black text-neutral-900 tabular-nums">
                  {item.cost}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400 text-center mt-3 leading-relaxed px-4">
        Подписка от <span className="font-bold text-neutral-600">2 490 ₸ / месяц</span> (45 ⚡ ≈ 10 креативов).
        Цены без подписки — оценочные, точные смотри в разделе тарифов.
      </p>
    </section>
  );
}
