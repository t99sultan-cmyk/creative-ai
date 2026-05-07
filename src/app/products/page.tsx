"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  Package,
  Play,
  Rocket,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { THEMES } from "@/lib/landing-themes";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { BrandTrustBar } from "@/components/landing/BrandTrustBar";
import { ProductStack } from "@/components/landing/ProductStack";
import { PricingSection } from "@/components/landing/PricingSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * /products — full marketing landing for the marketplace product-card
 * generator. Mirrors /sites and /presentations: 10-section premium
 * landing, emerald/teal palette to differentiate from orange (sites)
 * and violet (presentations).
 *
 * The actual generator is the 4th product (alongside creatives, sites,
 * presentations) — purpose: ready-to-list product cards for Kaspi and
 * Wildberries. Wizard is placeholder ("Скоро · Beta").
 */

const REVEAL = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 } as const,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const FAQ_ITEMS = [
  {
    q: "Что именно генерируется — одна картинка или весь набор?",
    a: "Полный набор для одной карточки: главное фото 1:1, 4 lifestyle-фото (товар в использовании, в среде, размер, детали), 1 инфографика со специфика́ми. Готов к загрузке на Kaspi или Wildberries.",
  },
  {
    q: "Как ИИ узнаёт что и как показывать?",
    a: "Загружаешь одно фото товара (можно даже плохое — на белом фоне или со стола). Описываешь категорию (одежда / еда / гаджет / косметика). ИИ собирает 6 карточек в стиле Kaspi-листинга или WB-листинга — с правильной композицией под каждый маркетплейс.",
  },
  {
    q: "Поддерживаются Wildberries и Kaspi?",
    a: "Да — это два главных рынка. ИИ знает требования каждого: Kaspi — квадрат 1:1, минимум текста на главном фото; Wildberries — допустимы инфографики, плашки со скидкой, заголовки. Выбираешь маркетплейс на старте, ИИ адаптирует подачу.",
  },
  {
    q: "Можно ли использовать на Ozon, Etsy, Amazon?",
    a: "Базовая генерация подходит — это всё равно 1:1 главное фото + lifestyle. Адаптации специально под Ozon/Etsy/Amazon добавим в следующих апдейтах (отличаются требования к size guide, batch upload-у и т.д.).",
  },
  {
    q: "Сколько стоит и что входит?",
    a: "30 импульсов за один комплект из 6 карточек. Включено: 6 image-генераций или авто-улучшений твоих фото + копирайт от Claude Opus 4.7 (заголовок карточки, описание, спецификации).",
  },
  {
    q: "Я могу использовать только своё фото товара?",
    a: "Да — загружаешь главное фото, ИИ делает из него студийный hero (Nano Banana polish: чистый фон, мягкий свет) + lifestyle-вариации (товар на руке, в интерьере, рядом с другими предметами для масштаба).",
  },
];

export default function ProductsLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans overflow-x-hidden">
      <LandingNavbar
        theme={THEMES.products}
        anchors={[
          { href: "#how", label: "Как работает" },
          { href: "#pricing", label: "Тарифы" },
          { href: "#faq", label: "FAQ" },
        ]}
        ctaLabel="Создать карточки"
      />
      <div className="h-16" aria-hidden />

      {/* ── 1. HERO ─────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-300/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.span {...REVEAL} className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-600 mb-6">
            🛍️ Карточки для Kaspi и Wildberries · Beta
          </motion.span>

          <motion.h1
            {...REVEAL}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            6 карточек товара
            <br />
            за <span className="text-emerald-500">минуту</span>
          </motion.h1>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Главное фото + 4 lifestyle + инфографика — всё, что требует
            маркетплейс для одной карточки. Загружаешь одно фото товара, ИИ
            делает остальное под Kaspi или WB.
          </motion.p>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/products/new"
              className="group bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Создать карточку
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/20 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> 30
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#how"
              className="text-sm font-bold text-neutral-500 hover:text-neutral-900 px-4 py-3 transition-colors"
            >
              Как работает →
            </Link>
          </motion.div>

          {/* Hero mockup — Kaspi-style listing preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="mt-16 relative"
          >
            <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-neutral-200 shadow-2xl">
              <div className="aspect-[16/10] relative p-6 sm:p-12">
                <div className="h-full flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="ml-3 px-3 py-1 rounded-md bg-white/80 border border-white text-[10px] sm:text-xs text-neutral-500 font-mono">
                      kaspi.kz / shop / {"товар"}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-6 gap-2 sm:gap-3 mt-2">
                    {/* Main hero (large) */}
                    <div className="col-span-3 row-span-2 aspect-square rounded-xl bg-white border-2 border-emerald-300 shadow-md flex items-center justify-center relative">
                      <Package className="w-10 h-10 text-neutral-400" />
                      <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-white">Hero</span>
                    </div>
                    {/* 4 lifestyle thumbs + 1 specs */}
                    {[
                      { label: "Lifestyle", color: "bg-white border-neutral-200" },
                      { label: "Lifestyle", color: "bg-white border-neutral-200" },
                      { label: "Detail", color: "bg-white border-neutral-200" },
                      { label: "Lifestyle", color: "bg-white border-neutral-200" },
                      { label: "Specs", color: "bg-emerald-50 border-emerald-200" },
                      { label: "Size", color: "bg-white border-neutral-200" },
                    ].map((t, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-lg ${t.color} border shadow-sm flex items-center justify-center`}
                      >
                        <span className="text-[8px] sm:text-[10px] font-bold uppercase text-neutral-400">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <BrandTrustBar />

      {/* ── 2. STATS BAR ───────────────────────────────────────── */}
      <section className="py-8 px-4 border-y border-neutral-100 bg-neutral-50/40">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: "6 карточек", label: "Hero + 4 lifestyle + специфика" },
            { num: "~1 мин", label: "От фото до готового набора" },
            { num: "Kaspi · WB", label: "Адаптация под маркетплейс" },
            { num: "30⚡", label: "За полный комплект" },
          ].map((s, i) => (
            <motion.div key={i} {...REVEAL} transition={{ duration: 0.4, delay: i * 0.05 }}>
              <div className="text-2xl sm:text-3xl font-black text-neutral-900 mb-1">{s.num}</div>
              <div className="text-xs sm:text-sm text-neutral-500 leading-snug">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 3. PROBLEM ─────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-rose-500 mb-3 block">
              Проблема
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Фотограф для маркетплейса —
              <br />
              <span className="text-rose-500">это медленно и дорого</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { num: "30 000 ₸", title: "За одну фотосессию", text: "Один товар = аренда студии + фотограф + мейкап-ассистент. Если 50 SKU — это 1.5 миллиона ₸ только на съёмку." },
              { num: "1-2 недели", title: "От заказа до готовых фото", text: "Согласование графика, съёмка, ретушь, отправка. За это время конкуренты успевают залить листинг и забрать твою долю органики." },
              { num: "1 фото", title: "На одну карточку — 6+ нужно", text: "Маркетплейс требует hero + lifestyle + детали + size guide + специфика. Делать 6 разных снимков для каждого SKU — нереально." },
            ].map((p, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="bg-white rounded-2xl border border-rose-200/40 p-6 hover:border-rose-300 transition-colors"
              >
                <div className="text-3xl font-black text-rose-500 mb-2">{p.num}</div>
                <h3 className="text-base font-black mb-2">{p.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{p.text}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center text-base sm:text-lg text-neutral-600 mt-12 max-w-2xl mx-auto"
          >
            Селлеры на Kaspi и WB <strong>не растут не из-за товара</strong> — а из-за
            кривых фотографий с белого фона. Решаем это.
          </motion.p>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ────────────────────────────────────── */}
      <section id="how" className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-b from-neutral-50/40 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-3 block">
              Как работает
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 шага до готового листинга
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: "01", title: "Загрузи фото", text: "Одно фото товара — даже плохое, на белом фоне или со стола. ИИ его сам доведёт до студийного качества.", icon: ImageIcon },
              { step: "02", title: "Категория и маркетплейс", text: "Что это (одежда / гаджет / еда / косметика) и куда заливаешь (Kaspi / Wildberries / оба). ИИ адаптирует подачу.", icon: Wand2 },
              { step: "03", title: "Жди ~1 мин", text: "Параллельно генерим 6 карточек: hero, 4 lifestyle, инфографика. Каждая — в правильной композиции маркетплейса.", icon: Sparkles },
              { step: "04", title: "Скачай и залей", text: "Получаешь архив с 6 готовыми JPG в нужных размерах. Заливаешь в Kaspi/WB напрямую — никакой ретуши не нужно.", icon: Rocket },
            ].map((s, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-neutral-200 p-5 hover:border-emerald-500/40 hover:shadow-lg transition-all relative overflow-hidden"
              >
                <div className="text-4xl font-black text-emerald-500/20 mb-2">{s.step}</div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <s.icon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-black mb-2">{s.title}</h4>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. FEATURES GRID ───────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-16">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-3 block">
              Что внутри
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Полный <span className="text-emerald-500">marketplace-ready</span> комплект
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
              Не «улучшалка одного фото» — а готовый набор под загрузку в карточку.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Package, title: "Hero shot 1:1", text: "Главное фото товара — чистый фон, мягкий студийный свет, продукт точно в центре. Соответствует требованиям Kaspi и WB.", accent: "bg-emerald-500" },
              { icon: Users, title: "4 lifestyle-фото", text: "Товар в использовании: на руке, в интерьере, рядом с другими предметами для масштаба, в момент применения. Продают эмоцию.", accent: "bg-teal-500" },
              { icon: Layers, title: "Инфографика-плашка", text: "Специфика товара текстом + иконками. Размеры, материалы, особенности. Без неё на WB карточка теряет 30% CTR.", accent: "bg-cyan-500" },
              { icon: ShoppingBag, title: "Под Kaspi или WB", text: "ИИ знает требования каждого: Kaspi — минимум текста на главном фото; WB — допустимы плашки и заголовки. Выбираешь маркетплейс — получаешь правильную подачу.", accent: "bg-blue-500" },
              { icon: TrendingUp, title: "Подгонка под категорию", text: "Одежда — модель / манекен. Еда — приготовленная подача. Гаджет — клин-шот + использование. Косметика — текстура + результат. ИИ знает паттерны.", accent: "bg-violet-500" },
              { icon: Zap, title: "Твоё фото или ИИ", text: "Загружаешь одно фото товара (Nano Banana доводит до студии). Или вообще без фото — ИИ нарисует с описания. Полная гибкость.", accent: "bg-rose-500" },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="bg-white rounded-2xl border border-neutral-200 p-6 hover:border-emerald-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className={`w-11 h-11 rounded-xl ${b.accent} flex items-center justify-center mb-4`}>
                  <b.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-black mb-2">{b.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{b.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <ProductStack currentProduct="products" />

      {/* ── 6. UPCOMING ────────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-teal-400/15 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 mb-3 block">
              🔥 В ближайшем апдейте
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Видео-карточки и batch-загрузка
            </h2>
            <p className="text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto">
              Карточка перестаёт быть статичной. WB и Kaspi уже разрешают видео —
              мы дадим инструмент его собрать за минуту.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Play, title: "Видео-обзор товара", text: "5-10 сек анимация: 360° оборот hero + lifestyle-моменты с твоим товаром. Готов под загрузку как видео-карточка." },
              { icon: Layers, title: "Batch — 50 SKU за раз", text: "Загружаешь Excel со списком товаров → ИИ делает по 6 карточек на каждый. Для селлеров с большой матрицей." },
              { icon: ImageIcon, title: "Размерная сетка / chart", text: "Авто-генерация size guide для одежды и обуви. Российские, EU, US, KZ размеры — всё в одной картинке." },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-emerald-400/40 hover:bg-white/10 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-black mb-2">{b.title}</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">{b.text}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center mt-10"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
              Roadmap · 2026 Q3
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── 7. USE CASES ───────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-3 block">
              Для кого
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 типа селлеров — все в плюсе
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShoppingBag, persona: "Kaspi-селлер", text: "Заливаешь 50 SKU — нужны 300 фотографий. У фотографа = 1.5 млн ₸. У нас = 75 000 ₸ и 1 час.", color: "from-emerald-50 to-teal-50 border-emerald-200/50" },
              { icon: TrendingUp, persona: "Wildberries-селлер", text: "Сезонная коллекция = 20 новых SKU в неделю. Без ИИ-карточек = вечно отстаёшь от конкурентов в выдаче.", color: "from-violet-50 to-fuchsia-50 border-violet-200/50" },
              { icon: Package, persona: "Производитель", text: "Делаешь товар — не хочешь возиться с фото-студией. Загружаешь фото со склада, получаешь готовый листинг.", color: "from-rose-50 to-pink-50 border-rose-200/50" },
              { icon: Target, persona: "Маркетплейс-агентство", text: "Делаешь карточки клиентам пакетами. Скорость × качество = выручка. ИИ снимает узкое горлышко по фотографу.", color: "from-blue-50 to-cyan-50 border-blue-200/50" },
            ].map((u, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`rounded-2xl border bg-gradient-to-br p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${u.color}`}
              >
                <u.icon className="w-7 h-7 text-neutral-700 mb-3" />
                <h3 className="text-base font-black mb-2">{u.persona}</h3>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">{u.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. COMPARISON ──────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100 bg-neutral-50/40">
        <div className="max-w-5xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-3 block">
              Сравнение
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Фотограф vs <span className="text-emerald-500">AICreative</span>
            </h2>
          </motion.div>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden"
          >
            <div className="grid grid-cols-3 text-sm">
              <div className="p-4 sm:p-6 bg-neutral-100 font-bold text-xs sm:text-sm uppercase tracking-wider text-neutral-500" />
              <div className="p-4 sm:p-6 bg-neutral-100 font-bold text-xs sm:text-sm uppercase tracking-wider text-neutral-500 text-center border-l border-neutral-200">
                Фотограф / студия
              </div>
              <div className="p-4 sm:p-6 bg-gradient-to-br from-emerald-500 to-teal-500 font-black text-xs sm:text-sm uppercase tracking-wider text-white text-center">
                AICreative
              </div>

              {[
                { row: "Время на 6 карточек", a: "1-2 недели", b: "~1 мин" },
                { row: "Стоимость", a: "30 000 ₸ за SKU", b: "1 500 ₸ (30⚡)" },
                { row: "Lifestyle-фото", a: "Реквизит + локация + время", b: "ИИ генерирует сцену" },
                { row: "Инфографика-плашка", a: "Отдельно у дизайнера", b: "В комплекте" },
                { row: "Адаптация под Kaspi/WB", a: "Вручную ретушь", b: "Авто-композиция под маркетплейс" },
                { row: "50 SKU = ?", a: "1.5 млн ₸ + 1.5 месяца", b: "75 000 ₸ + 1 час" },
              ].map((r, i) => (
                <div key={r.row} className="contents">
                  <div className={`p-4 sm:p-5 font-bold text-neutral-800 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.row}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-500 text-center border-l border-neutral-200 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.a}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-900 text-center font-bold border-l border-neutral-200 ${i % 2 === 0 ? "bg-emerald-50/40" : "bg-white"}`}>
                    {r.b}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <PricingSection theme={THEMES.products} />

      {/* ── 9. FAQ ─────────────────────────────────────────────── */}
      <div id="faq" />

      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-3xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-3 block">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Частые вопросы
            </h2>
          </motion.div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <motion.div
                  key={i}
                  {...REVEAL}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="rounded-2xl border border-neutral-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors"
                  >
                    <span className="font-bold text-sm sm:text-base">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm text-neutral-600 leading-relaxed">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 10. FINAL CTA ──────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-neutral-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2 {...REVEAL} className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Залей первую карточку сейчас
          </motion.h2>
          <motion.p
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-neutral-600 text-base sm:text-lg mb-8"
          >
            30 импульсов — комплект из 6 карточек под Kaspi или Wildberries.
          </motion.p>
          <motion.div
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-500 mb-6"
          >
            {["Hero + 4 lifestyle + специфика", "Kaspi или WB", "Под категорию товара", "ИИ или твоё фото"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> {f}
              </span>
            ))}
          </motion.div>
          <motion.div {...REVEAL} transition={{ duration: 0.4, delay: 0.2 }}>
            <Link
              href="/products/new"
              className="group bg-neutral-900 hover:bg-black text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2 mx-auto w-fit transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-5 h-5" />
              Начать
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/15 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> 30
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <motion.p
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mt-6 text-xs text-neutral-400"
          >
            Также доступно:{" "}
            <Link href="/sites" className="font-bold text-hermes-600 hover:text-hermes-800 underline">
              Сайты →
            </Link>
            {" · "}
            <Link href="/presentations" className="font-bold text-violet-600 hover:text-violet-800 underline">
              Презентации →
            </Link>
            {" · "}
            <Link href="/editor" className="font-bold text-hermes-600 hover:text-hermes-800 underline">
              Креативы для таргета →
            </Link>
          </motion.p>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
