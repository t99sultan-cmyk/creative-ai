"use client";

import { Camera, ListChecks, Frame, Wand2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * 4-step usage instructions for the welcome screen. Each step has a
 * Lucide icon, a short title, and 2-3 lines of description. Friendly
 * tone — written in the second person ("ты"), no formal corporate
 * language.
 *
 * Mocks: simple iconographic visuals (Lucide + a small SVG diagram),
 * NOT actual screenshots. Real screenshots become outdated with every
 * editor UI change; abstract visuals don't.
 */
const STEPS = [
  {
    n: 1,
    icon: Camera,
    title: "Загрузи фото товара",
    text: "Можно с телефона на складе при обычном свете — ИИ сам очистит фон и улучшит освещение.",
    accent: "from-pink-500 to-rose-500",
    bg: "from-pink-50 to-rose-50",
    visual: <Step1Mock />,
  },
  {
    n: 2,
    icon: ListChecks,
    title: "Заполни TZ-помощник",
    text: "4 коротких вопроса: что рекламируешь, главная выгода, аудитория, стиль. ИИ напишет полное ТЗ за тебя.",
    accent: "from-amber-500 to-yellow-500",
    bg: "from-amber-50 to-yellow-50",
    visual: <Step2Mock />,
  },
  {
    n: 3,
    icon: Frame,
    title: "Выбери формат",
    text: "9:16 для Stories и Reels, 1:1 для ленты Instagram и Kaspi, 16:9 для YouTube и Facebook.",
    accent: "from-sky-500 to-indigo-500",
    bg: "from-sky-50 to-indigo-50",
    visual: <Step3Mock />,
  },
  {
    n: 4,
    icon: Wand2,
    title: "Жми «Создать»",
    text: "ИИ соберёт креатив за ~60 секунд. Стоимость одного — 4 ⚡. У тебя на старте 7 — хватит на пару попыток.",
    accent: "from-hermes-500 to-amber-500",
    bg: "from-hermes-50 to-amber-50",
    visual: <Step4Mock />,
  },
] as const;

export function HowItWorksSteps() {
  return (
    <section className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-hermes-600 mb-2">
          Как пользоваться
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-neutral-900">
          4 шага до первого креатива
        </h2>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br ${step.bg} border border-neutral-200/60`}
          >
            {/* Visual on the left — stays fixed-width so text wraps cleanly */}
            <div
              className={`flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center shadow-lg overflow-hidden p-3`}
            >
              {step.visual}
            </div>

            {/* Text on the right */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-neutral-400 tabular-nums">
                  ШАГ {step.n}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 leading-tight mb-1">
                {step.title}
              </h3>
              <p className="text-sm text-neutral-600 leading-snug">{step.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/**
 * Step 1 — camera + product silhouette + arrow up.
 * Conveys "upload the photo of your product".
 */
function Step1Mock() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      {/* Photo card */}
      <rect x="10" y="14" width="44" height="36" rx="4" fill="white" opacity="0.9" />
      {/* Sun in photo */}
      <circle cx="20" cy="24" r="3" fill="#fbbf24" />
      {/* Mountains */}
      <path d="M10 42 L22 30 L32 38 L44 26 L54 42 Z" fill="#fff" opacity="0.6" />
      {/* Upload arrow */}
      <path d="M32 56 L32 48 M28 52 L32 48 L36 52" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Step 2 — checklist of 4 lines, like the TZ helper accordion.
 */
function Step2Mock() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      {[14, 26, 38, 50].map((y, i) => (
        <g key={i}>
          <circle cx="14" cy={y} r="4" fill={i < 3 ? "white" : "white"} opacity={i < 3 ? 1 : 0.5} />
          {i < 3 && (
            <path
              d={`M11.5 ${y} L13.5 ${y + 2} L17 ${y - 2}`}
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          <rect x="22" y={y - 2} width={i < 3 ? 32 : 24} height="3" rx="1.5" fill="white" opacity={i < 3 ? 0.95 : 0.5} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Step 3 — three rectangles representing 9:16, 1:1, 16:9 with the
 * middle one highlighted as "selected".
 */
function Step3Mock() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      {/* 9:16 */}
      <rect x="6" y="20" width="14" height="24" rx="2" fill="white" opacity="0.6" />
      {/* 1:1 — highlighted */}
      <rect x="24" y="22" width="20" height="20" rx="2" fill="white" />
      <rect x="22" y="20" width="24" height="24" rx="3" fill="none" stroke="white" strokeWidth="2" />
      {/* 16:9 */}
      <rect x="48" y="26" width="14" height="12" rx="2" fill="white" opacity="0.6" />
    </svg>
  );
}

/**
 * Step 4 — magic wand + sparkles + a tiny mock creative.
 */
function Step4Mock() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      {/* Generated card */}
      <rect x="14" y="14" width="36" height="36" rx="4" fill="white" opacity="0.95" />
      <rect x="20" y="20" width="24" height="14" rx="2" fill="#f37021" opacity="0.4" />
      <rect x="20" y="36" width="18" height="2" rx="1" fill="#737373" />
      <rect x="20" y="40" width="14" height="2" rx="1" fill="#a3a3a3" />
      <rect x="20" y="44" width="20" height="2" rx="1" fill="#a3a3a3" />
      {/* Sparkles around */}
      <path d="M52 12 L53 16 L57 17 L53 18 L52 22 L51 18 L47 17 L51 16 Z" fill="white" />
      <path d="M10 44 L10.5 46 L12.5 46.5 L10.5 47 L10 49 L9.5 47 L7.5 46.5 L9.5 46 Z" fill="white" />
    </svg>
  );
}
