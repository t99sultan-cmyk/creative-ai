"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Layers,
  Play,
  Rocket,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { SITE_GEN_COST } from "@/lib/pricing";
import { THEMES } from "@/lib/landing-themes";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { BrandTrustBar } from "@/components/landing/BrandTrustBar";
import { ProductStack } from "@/components/landing/ProductStack";
import { PricingSection } from "@/components/landing/PricingSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * /sites — full marketing landing for the Sites generator. Mirrors the
 * depth and rhythm of the main /aicreative.kz landing: 10 distinct
 * content sections, premium typography, brand orange/hermes accents.
 *
 * The "Создать" CTAs link to /sites/new (the wizard). Generation itself
 * is gated behind NEXT_PUBLIC_GEN_PRODUCTS_ENABLED — public visitors
 * see a "Скоро · Beta" disabled state inside the wizard.
 *
 * NOTE on flicker: every motion.div uses `viewport: { once: true,
 * amount: 0.2 }` and only animates opacity + small Y-offset. Aspect-
 * ratio mockup blocks live inside fixed-size grids so layout never
 * collapses to zero.
 */

// Single shared `whileInView` config — guarantees motion runs once,
// after the section is ~20% visible. No re-firing on scroll = no flicker.
const REVEAL = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 } as const,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const FAQ_ITEMS = [
  {
    q: "Чем это отличается от шаблонных конструкторов (Tilda, Webflow)?",
    a: "Tilda и Webflow дают тебе пустой шаблон — текст и картинки ты пишешь сам. AICreative пишет копию, рисует образы, расставляет блоки за тебя. Под твой продукт, не «универсальный шаблон №47».",
  },
  {
    q: "Я могу использовать свои фото товара?",
    a: "Да. На шаге 2 любой из 5 image-блоков можно переключить на «Я загружу» — твоё фото пройдёт через Nano Banana studio polish (мягкий студийный свет, чистый фон) и встанет в лендинг.",
  },
  {
    q: "Что значит «вариант от Claude Opus 4.7»?",
    a: "Параллельно с одним и тем же ТЗ работают Claude Opus 4.7 — лучшая LLM 2026 года для копи и HTML. Результат уровня top-tier дизайнерской студии — прямо в браузере, за минуту.",
  },
  {
    q: "Что значит «опубликовать на нашем домене»?",
    a: "После выбора лучшего варианта жмёшь «Опубликовать» — выдаём короткий URL вида aicreative.kz/s/abc12 . Делишься в таргете, в директе, в Telegram. Не нужен хостинг, не нужен домен. Хочешь свой домен — скачиваешь HTML и вешаешь на свой Vercel/Netlify.",
  },
  {
    q: "Сколько стоит и что входит?",
    a: "30 импульсов за один лендинг. В стоимость уже входит: вариант от Claude Opus 4.7 + 5 сгенерированных или авто-улучшенных картинок + публикация на нашем домене. Никаких скрытых доплат за «слишком длинный сайт» или «слишком детальный бриф».",
  },
  {
    q: "Что насчёт мобильной адаптации и SEO?",
    a: "Все генерируемые лендинги — mobile-first, адаптируются от 360px до 4K. SEO-meta-теги (title, description, og:image) генерируются автоматически на основе ТЗ.",
  },
];

export default function SitesLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans overflow-x-hidden">
      {/* Shared landing navbar — sky theme */}
      <LandingNavbar
        theme={THEMES.sites}
        anchors={[
          { href: "#how", label: "Как работает" },
          { href: "#pricing", label: "Тарифы" },
          { href: "#faq", label: "FAQ" },
        ]}
        ctaLabel="Создать сайт"
      />
      <div className="h-16" aria-hidden />

      {/* ── 1. HERO ─────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-300/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.span {...REVEAL} className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-sky-600 mb-6">
            🌐 Создание сайтов · Beta
          </motion.span>

          <motion.h1
            {...REVEAL}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Продающий лендинг
            <br />
            за <span className="text-sky-500">минуту</span>
          </motion.h1>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            ИИ собирает single-page сайт по твоему ТЗ — с заголовками, выгодами,
            фото товара и CTA-блоком. Опубликуй на нашем домене одной кнопкой
            или скачай HTML.
          </motion.p>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/sites/new"
              className="group bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-sky-500/30 flex items-center gap-2 transition-all hover:shadow-sky-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Создать сайт
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/20 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> {SITE_GEN_COST}
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

          {/* Hero mockup — static layout, no per-element motion to avoid flicker */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="mt-16 relative"
          >
            <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-sky-50 via-amber-50 to-blue-50 border border-neutral-200 shadow-2xl">
              <div className="aspect-[16/10] relative p-6 sm:p-12">
                <div className="h-full flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="ml-3 px-3 py-1 rounded-md bg-white/80 border border-white text-[10px] sm:text-xs text-neutral-500 font-mono">
                      aicreative.kz/s/your-landing
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="h-2 sm:h-3 w-32 sm:w-44 rounded-full bg-sky-500/70" />
                    <div className="h-6 sm:h-12 w-3/4 rounded-lg bg-neutral-900" />
                    <div className="h-3 sm:h-5 w-1/2 rounded-md bg-neutral-300" />
                    <div className="grid grid-cols-3 gap-3 mt-4 max-w-2xl w-full">
                      <div className="aspect-square rounded-lg sm:rounded-xl bg-white/80 border border-white shadow-sm" />
                      <div className="aspect-square rounded-lg sm:rounded-xl bg-white/80 border border-white shadow-sm" />
                      <div className="aspect-square rounded-lg sm:rounded-xl bg-white/80 border border-white shadow-sm" />
                    </div>
                    <div className="h-8 sm:h-12 w-32 sm:w-44 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 mt-4 sm:mt-6" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Shared brand-trust bar (logos) */}
      <BrandTrustBar />

      {/* ── 2. STATS BAR ───────────────────────────────────────── */}
      <section className="py-8 px-4 border-y border-neutral-100 bg-neutral-50/40">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: "~1 мин", label: "От брифа до готового сайта" },
            { num: "5+5", label: "Блоков · картинок в каждом" },
            { num: "Claude", label: "Claude Opus 4.7" },
            { num: "0₸", label: "За хостинг — публикуем у себя" },
          ].map((s, i) => (
            <motion.div
              key={i}
              {...REVEAL}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
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
              Почему классическая разработка
              <br />
              <span className="text-rose-500">убивает скорость теста</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { num: "150 000 ₸", title: "Стоимость", text: "Лендинг у фрилансера = копирайтер + дизайнер + верстальщик. 3 подрядчика, 3 NDA, 3 дедлайна. Из них хорошо договоришься с одним." },
              { num: "2-3 недели", title: "Время", text: "От брифа до публикации проходит две-три недели. За это время рынок успевает поменяться, конкуренты — выкатить акцию, аудитория — забыть про тебя." },
              { num: "1 версия", title: "Без A/B", text: "Делать вторую версию для теста гипотезы — ещё 150к и ещё две недели. Поэтому почти никто не делает. И тестируют на интуиции." },
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
            А у тебя на проверку гипотезы — <strong>один день и 5 000 ₸</strong>.
            Старую модель пора ломать.
          </motion.p>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ────────────────────────────────────── */}
      <section id="how" className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-b from-neutral-50/40 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-sky-600 mb-3 block">
              Как работает
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 шага до публикации
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-xl mx-auto">
              Без верстальщика, без копирайтера, без хостинга.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: "01", title: "Опиши продукт", text: "Свободно текстом или через 4 коротких поля. Можно прикрепить референсы — скриншоты лендингов, ссылки на сайты-примеры. ИИ учитывает.", icon: Wand2 },
              { step: "02", title: "Подложи фото", text: "5 image-блоков. Любой можно оставить ИИ или загрузить своё фото — мы его авто-улучшим (студийный свет, чистый фон).", icon: ImageIcon },
              { step: "03", title: "Жди ~1 мин", text: "Параллельно идут текст-ген + image-генерации. Получаешь готовый сайт в превью.", icon: Sparkles },
              { step: "04", title: "Опубликуй", text: "Выбираешь лучший → жмёшь «Опубликовать» → URL aicreative.kz/s/abc. Делишься. Или скачиваешь HTML и вешаешь на свой домен.", icon: Share2 },
            ].map((s, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-neutral-200 p-5 hover:border-sky-500/40 hover:shadow-lg transition-all relative overflow-hidden"
              >
                <div className="text-4xl font-black text-sky-500/20 mb-2">{s.step}</div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
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
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-sky-600 mb-3 block">
              Что внутри
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Не «генератор шаблонов» — <span className="text-sky-500">ассистент-команда</span>
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
              Копирайтер + арт-директор + верстальщик + издатель — за 30⚡ и одну минуту.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Zap, title: "Готовый продающий копирайт", text: "Заголовок-хук + подзаголовок с цифрой/срочностью + CTA в повелительном — а не плейсхолдеры «Lorem ipsum» под перепись.", accent: "bg-sky-500" },
              { icon: Layers, title: "Claude Opus 4.7", text: "Лучшая LLM 2026 года для HTML и копирайта работает над твоим ТЗ. Один результат, top-tier качество.", accent: "bg-violet-500" },
              { icon: ImageIcon, title: "Картинки твои или ИИ", text: "Загрузи фото товара — Nano Banana доводит до студийного света. Или ИИ нарисует с нуля по описанию: hero, фичи, соц-проф.", accent: "bg-emerald-500" },
              { icon: Share2, title: "Публикация одной кнопкой", text: "URL aicreative.kz/s/abc на нашем домене. Без VPS, без SSL-плясок, без покупки доменов на 5 лет вперёд. Скачивание HTML — тоже одной кнопкой.", accent: "bg-rose-500" },
              { icon: Users, title: "Под аудиторию автоматически", text: "Молодёжь / премиум / семейный / женский / мужской — тон ТЗ автоматически меняет язык headline и подачу. Без ручной правки копирайта.", accent: "bg-blue-500" },
              { icon: Rocket, title: "Mobile-first из коробки", text: "Все лендинги адаптируются от 360px до 4K. SEO-meta-теги, og:image, viewport — всё на месте. Готов к Meta Ads Manager и Kaspi прямо сейчас.", accent: "bg-amber-500" },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="bg-white rounded-2xl border border-neutral-200 p-6 hover:border-sky-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
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

      {/* Shared 4-products navigation block */}
      <ProductStack currentProduct="sites" />

      {/* ── 6. UPCOMING ANIMATION / VIDEO / MULTI-PHOTO ────────── */}
      <section className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-sky-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-amber-400/15 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-3 block">
              🔥 В ближайшем апдейте
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Анимации, видео, мультифото
            </h2>
            <p className="text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto">
              Сайт перестаёт быть статичным постером. Hero оживает, блоки
              реагируют на скролл, в нужных местах — твои видео.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Play,
                title: "Видео в hero",
                text: "Загружаешь короткое видео товара (3-5 сек) → ставится фоном в hero на autoplay/loop/muted. Mobile-friendly, не жрёт батарею.",
              },
              {
                icon: Sparkles,
                title: "Анимированные блоки",
                text: "Scroll-reveal, parallax, hover-states на CTA-кнопках. Готовые шаблоны motion-сценариев. Без кода, без After Effects.",
              },
              {
                icon: ImageIcon,
                title: "Мульти-фото в блоке",
                text: "Не одна картинка в блоке, а карусель из 3-5 фото товара. Полезно для одежды, мебели, food. Свайп на mobile, стрелки на desktop.",
              },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-amber-400/40 hover:bg-white/10 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-blue-500 flex items-center justify-center mb-4">
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
            <span className="inline-block px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
              Roadmap · 2026 Q3
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── 7. USE CASES / PERSONAS ────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-sky-600 mb-3 block">
              Для кого
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 сценария — все продающие
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Target, persona: "Таргетолог", text: "Делаешь A/B-тест за час, не за две недели. Заливаешь оба варианта в Meta Ads, берёшь победителя.", color: "from-sky-50 to-blue-50 border-sky-200/50" },
              { icon: TrendingUp, persona: "Селлер на маркетплейсах", text: "Внешний лендинг для перевода трафика с Kaspi/WB на свой канал/Telegram. Без своего сайта, без хостинга.", color: "from-violet-50 to-fuchsia-50 border-violet-200/50" },
              { icon: Users, persona: "Малый бизнес", text: "Лендинг под услугу или товар без агентства. От идеи в голове до публикации — за один обед.", color: "from-emerald-50 to-teal-50 border-emerald-200/50" },
              { icon: Rocket, persona: "Агентство / SMM", text: "Делаешь клиенту лендинг под акцию за минуту. Берёшь свою наценку. Объём и скорость = выручка.", color: "from-rose-50 to-pink-50 border-rose-200/50" },
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
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-sky-600 mb-3 block">
              Сравнение
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Старая модель vs <span className="text-sky-500">AICreative</span>
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
                Фриланс / агентство
              </div>
              <div className="p-4 sm:p-6 bg-gradient-to-br from-sky-500 to-blue-500 font-black text-xs sm:text-sm uppercase tracking-wider text-white text-center">
                AICreative
              </div>

              {[
                { row: "Время до публикации", a: "2-3 недели", b: "~1 мин" },
                { row: "Стоимость", a: "100-300 тыс ₸", b: "1 500 ₸ (30⚡)" },
                { row: "A/B-тест", a: "+1 проект, +1 счёт", b: "Бесплатные итерации — генерируй сколько нужно" },
                { row: "Правки копирайта", a: "Договор, согласование, недели", b: "Клик «Создать ещё один»" },
                { row: "Хостинг + домен", a: "Отдельная задача", b: "Включено — aicreative.kz/s/abc" },
                { row: "Качество дизайна", a: "Зависит от подрядчика", b: "Уровень Linear / Vercel" },
              ].map((r, i) => (
                <div key={r.row} className="contents">
                  <div className={`p-4 sm:p-5 font-bold text-neutral-800 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.row}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-500 text-center border-l border-neutral-200 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.a}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-900 text-center font-bold border-l border-neutral-200 ${i % 2 === 0 ? "bg-sky-50/40" : "bg-white"}`}>
                    {r.b}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Shared pricing — single source of truth across all 4 landings */}
      <PricingSection theme={THEMES.sites} />

      {/* ── 9. FAQ ─────────────────────────────────────────────── */}
      <div id="faq" />

      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-3xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-sky-600 mb-3 block">
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
      <section className="py-24 px-4 border-t border-neutral-100 bg-gradient-to-br from-sky-50 via-blue-50 to-amber-50 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2 {...REVEAL} className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Создай первый сайт сейчас
          </motion.h2>
          <motion.p
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-neutral-600 text-base sm:text-lg mb-8"
          >
            30 импульсов — вариант от Claude Opus 4.7. Опубликуй мгновенно или скачай HTML.
          </motion.p>
          <motion.div
            {...REVEAL}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-500 mb-6"
          >
            {["5 блоков с картинками", "Mobile-first", "Публикация на aicreative.kz", "Скачивание HTML"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> {f}
              </span>
            ))}
          </motion.div>
          <motion.div {...REVEAL} transition={{ duration: 0.4, delay: 0.2 }}>
            <Link
              href="/sites/new"
              className="group bg-neutral-900 hover:bg-black text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2 mx-auto w-fit transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-5 h-5" />
              Начать
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/15 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> {SITE_GEN_COST}
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
            <Link href="/presentations" className="font-bold text-violet-600 hover:text-violet-800 underline">
              Презентации →
            </Link>
            {" · "}
            <Link href="/products" className="font-bold text-emerald-600 hover:text-emerald-800 underline">
              Карточки товара →
            </Link>
            {" · "}
            <Link href="/editor" className="font-bold text-sky-600 hover:text-sky-800 underline">
              Креативы для таргета →
            </Link>
          </motion.p>
        </div>
      </section>
      {/* Shared footer */}
      <LandingFooter />
    </main>
  );
}
