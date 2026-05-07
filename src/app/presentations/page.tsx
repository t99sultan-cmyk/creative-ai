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
  PieChart,
  Play,
  Presentation,
  Rocket,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { PRESENTATION_GEN_COST } from "@/lib/pricing";
import { THEMES } from "@/lib/landing-themes";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { BrandTrustBar } from "@/components/landing/BrandTrustBar";
import { PricingSection } from "@/components/landing/PricingSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

const REVEAL = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 } as const,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const FAQ_ITEMS = [
  {
    q: "Чем это отличается от PowerPoint и Keynote?",
    a: "PowerPoint даёт пустой шаблон — вёрстку, текст, картинки делаешь сам. AICreative пишет копию для всех 7 слайдов, рисует образы, расставляет blocks под канон pitch-слайдов. Без шаблонов. Под твой продукт.",
  },
  {
    q: "Презентация открывается в браузере или скачивается файл?",
    a: "В браузере — это HTML-слайды. После публикации даём короткий URL aicreative.kz/p/abc — открывается на любом устройстве, листается стрелками или свайпом, full-screen. HTML можно скачать и открывать локально.",
  },
  {
    q: "А PDF / PPTX можно?",
    a: "В планах — добавим экспорт в PDF в следующем апдейте. Для PPTX путь сложнее (нужен серверный рендер через python-pptx или OpenXML), но если будет много запросов — сделаем.",
  },
  {
    q: "Я могу подложить свои фото в слайды?",
    a: "Да. На шаге 2 любой из 7 image-слотов можно переключить на «Я загружу» — твоё фото пройдёт через Nano Banana studio polish и встанет в слайд.",
  },
  {
    q: "Что значит «вариант от Claude Opus 4.7»?",
    a: "С одним и тем же ТЗ работают параллельно Claude Opus 4.7 — лучшая LLM 2026 года для копи и HTML. Получаешь готовый результат уровня top-tier production studio.",
  },
  {
    q: "Сколько стоит и что входит?",
    a: "30 импульсов за одну презентацию. Включено: вариант от Claude Opus 4.7 + 7 сгенерированных или авто-улучшенных картинок + публикация на aicreative.kz/p/abc. Никаких доплат «за длинную презентацию».",
  },
];

export default function PresentationsLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans overflow-x-hidden">
      <LandingNavbar
        theme={THEMES.presentations}
        anchors={[
          { href: "#how", label: "Как работает" },
          { href: "#pricing", label: "Тарифы" },
          { href: "#faq", label: "FAQ" },
        ]}
        ctaLabel="Создать слайды"
      />
      <div className="h-16" aria-hidden />

      {/* ── 1. HERO ─────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-fuchsia-300/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.span {...REVEAL} className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-violet-600 mb-6">
            📊 Создание презентаций · Beta
          </motion.span>

          <motion.h1
            {...REVEAL}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Pitch-слайды
            <br />
            <span className="text-violet-500">за минуту</span>
          </motion.h1>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            7 слайдов по канону: титул → проблема → решение → 3 фичи → CTA. ИИ
            собирает структуру, копирайт и образы. Открывается по ссылке,
            листается стрелками.
          </motion.p>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/presentations/new"
              className="group bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-violet-500/30 flex items-center gap-2 transition-all hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Создать презентацию
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/20 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> {PRESENTATION_GEN_COST}
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

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="mt-16 relative"
          >
            <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 border border-neutral-200 shadow-2xl">
              <div className="aspect-[16/10] relative p-6 sm:p-12">
                <div className="h-full flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="ml-3 px-3 py-1 rounded-md bg-white/80 border border-white text-[10px] sm:text-xs text-neutral-500 font-mono">
                      aicreative.kz/p/your-deck
                    </div>
                    <div className="ml-auto text-[10px] sm:text-xs font-mono text-neutral-400">3 / 7</div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 mt-2">
                    <div className="aspect-video rounded-xl bg-white shadow-md border border-neutral-200 flex flex-col p-2 gap-1">
                      <div className="h-1.5 w-3/4 rounded bg-neutral-300" />
                      <div className="h-1 w-1/2 rounded bg-neutral-200" />
                    </div>
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md ring-2 ring-violet-500 ring-offset-2 ring-offset-violet-50" />
                    <div className="aspect-video rounded-xl bg-white shadow-md border border-neutral-200 flex flex-col p-2 gap-1">
                      <div className="h-1.5 w-1/2 rounded bg-neutral-300" />
                      <div className="h-1 w-2/3 rounded bg-neutral-200" />
                    </div>
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-md" />
                    <div className="aspect-video rounded-xl bg-white shadow-md border border-neutral-200 flex items-center justify-center">
                      <div className="h-1.5 w-12 rounded bg-neutral-400" />
                    </div>
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-md" />
                  </div>
                  <div className="mt-2 flex justify-center gap-3 text-[10px] sm:text-xs text-neutral-400 font-mono">
                    ← →
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
            { num: "~1 мин", label: "От идеи до готовой презентации" },
            { num: "7+7", label: "Слайдов · картинок full-screen" },
            { num: "Claude", label: "Claude Opus 4.7" },
            { num: "0₸", label: "За хостинг — открывается по ссылке" },
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
              PowerPoint в 2026 году —
              <br />
              <span className="text-rose-500">боль и трата времени</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { num: "4-6 часов", title: "Полдня вёрстки", text: "На дизайн 7 слайдов в Figma уходит полдня. Потом редактируешь под клиента и теряешь ещё столько же. Итого день на одну презентацию." },
              { num: "Шаблоны", title: "Все одинаковые", text: "Бесплатные шаблоны Canva и SlidesGo выглядят как презентации десятого класса. Платные шаблоны видели все, кто на них учился." },
              { num: "Файлы", title: "PPT/PDF боль", text: "Отправляешь .pptx — у клиента слетают шрифты. Отправляешь PDF — теряешь анимации. Отправляешь Google Slides — никто не открывает после первого клика." },
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
            Вместо: <strong>один URL</strong>, открывается за секунду в любом браузере.
            Никаких файлов, никаких шаблонов, никакой Canva.
          </motion.p>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ────────────────────────────────────── */}
      <section id="how" className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-b from-neutral-50/40 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-3 block">
              Как работает
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 шага до готовой презентации
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: "01", title: "Опиши идею", text: "Что презентуешь, какую боль решает, для какой аудитории. Можно прикрепить ссылки на чужие презентации — для inspiration по стилю.", icon: Wand2 },
              { step: "02", title: "Картинки слайдов", text: "7 image-слотов. Любой можно оставить ИИ или подложить свою фотку — мы её авто-улучшим (Nano Banana).", icon: ImageIcon },
              { step: "03", title: "Жди ~1 мин", text: "Параллельно идут текст-ген + image-генерации. Получаешь готовую презентацию в превью.", icon: Sparkles },
              { step: "04", title: "Делись", text: "Выбираешь лучшую → жмёшь «Опубликовать» → URL aicreative.kz/p/abc. Кидаешь клиенту в Telegram. Или скачиваешь HTML.", icon: Share2 },
            ].map((s, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-neutral-200 p-5 hover:border-violet-500/40 hover:shadow-lg transition-all relative overflow-hidden"
              >
                <div className="text-4xl font-black text-violet-500/20 mb-2">{s.step}</div>
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
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
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-3 block">
              Что внутри
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Дека уровня <span className="text-violet-500">YC pitch-day</span>
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
              Не «слайды на шаблоне», а готовая ставящая на сцену сценарная конструкция.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Presentation, title: "7 слайдов по канону", text: "Структура pitch-слайдов топовых YC: hook → проблема → решение → 3 фичи → CTA. Не теряешь зрителя на втором слайде.", accent: "bg-violet-500" },
              { icon: Layers, title: "Claude Opus 4.7", text: "Claude Opus 4.7 собирают по своей версии параллельно. Сравниваешь, берёшь ту что круче зашла. Цена одна.", accent: "bg-fuchsia-500" },
              { icon: ImageIcon, title: "Кинематографичные слайды", text: "Каждый слайд — full-screen с премиум-образом. 16:9 ratio, magazine-look. Без stock-фото и человечков-фигурок.", accent: "bg-rose-500" },
              { icon: Share2, title: "URL вместо файла", text: "Жмёшь «Опубликовать» — выдаём короткий URL. Отправляешь в Telegram, в почте. Клик — и презентация в браузере, full-screen.", accent: "bg-amber-500" },
              { icon: Users, title: "Стрелки ← →", text: "Никаких импортов, плагинов, Office-365. Презентация — обычная веб-страница. Работает в любом браузере, в Zoom share, в Loom-записи.", accent: "bg-blue-500" },
              { icon: Rocket, title: "30⚡ против дня в Figma", text: "Альтернатива: пол-дня в Figma + копирайтер на фрилансе ≈ 50 000 ₸. Здесь — 30 имп ≈ 1 500 ₸ и минута ожидания.", accent: "bg-emerald-500" },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="bg-white rounded-2xl border border-neutral-200 p-6 hover:border-violet-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
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

      {/* ── 6. UPCOMING ANIMATION / VIDEO / MULTI-PHOTO ────────── */}
      <section className="py-20 px-4 border-t border-neutral-100 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-fuchsia-400/15 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400 mb-3 block">
              🔥 В ближайшем апдейте
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Анимации, видео-вставки, мультифото
            </h2>
            <p className="text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto">
              Презентация перестаёт быть статичной. Слайды летят, продукт
              крутится, в нужных местах — твоё видео.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Sparkles, title: "Smooth-переходы", text: "Кросс-фейды и parallax между слайдами. Контент-плагин для PPT-вайба, без актуального PPT." },
              { icon: Play, title: "Видео в слайде", text: "Загружаешь демо-видео продукта (5-10 сек) → автоплей в slot слайда. Полезно для стартапов и физических товаров." },
              { icon: ImageIcon, title: "Мульти-фото", text: "В слайде вместо одной картинки — карусель из 3-5. Свайп / тап-навигация. Для маркетплейсов и dataset-докладов." },
            ].map((b, i) => (
              <motion.div
                key={i}
                {...REVEAL}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-fuchsia-400/40 hover:bg-white/10 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
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
            <span className="inline-block px-4 py-1.5 rounded-full bg-fuchsia-400/20 text-fuchsia-300 text-xs font-bold uppercase tracking-wider border border-fuchsia-400/30">
              Roadmap · 2026 Q3
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── 7. USE CASES / PERSONAS ────────────────────────────── */}
      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-3 block">
              Для кого
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              4 сценария, в которых презентация решает
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Rocket, persona: "Стартап", text: "Pitch-слайды для инвестора за вечер. Без агентства, без шаблонов из 2018-го. Уровень — YC demo day.", color: "from-violet-50 to-fuchsia-50 border-violet-200/50" },
              { icon: TrendingUp, persona: "Sales / KYC", text: "Презентация продукта клиенту за обед — со всеми фичами, ценами, контактами. Кидаешь URL в чат, не файл.", color: "from-fuchsia-50 to-rose-50 border-fuchsia-200/50" },
              { icon: Users, persona: "Internal pitch", text: "Питч новой инициативы команде или борду. Хорошо выглядит на проекторе, в Zoom-share, в Loom-записи.", color: "from-rose-50 to-amber-50 border-rose-200/50" },
              { icon: Target, persona: "Образование / контент", text: "Slide-deck к посту в LinkedIn, к лекции в Telegram, к выступлению на митапе. Embed-friendly URL.", color: "from-emerald-50 to-teal-50 border-emerald-200/50" },
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
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-3 block">
              Сравнение
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              PowerPoint vs <span className="text-violet-500">AICreative</span>
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
                PowerPoint / Keynote
              </div>
              <div className="p-4 sm:p-6 bg-gradient-to-br from-violet-500 to-fuchsia-500 font-black text-xs sm:text-sm uppercase tracking-wider text-white text-center">
                AICreative
              </div>

              {[
                { row: "Время на 7 слайдов", a: "4-6 часов", b: "~1 мин" },
                { row: "Стоимость", a: "Office-365 + время дизайнера", b: "1 500 ₸ (30⚡)" },
                { row: "Формат отдачи", a: "Файл .pptx (слетают шрифты)", b: "URL aicreative.kz/p/abc" },
                { row: "Шрифты у получателя", a: "Зависит от Office", b: "Веб-шрифты, всегда работают" },
                { row: "Открытие", a: "Скачать → открыть → подождать", b: "Клик и открылось" },
                { row: "Шаблоны", a: "Все видели уже сто раз", b: "Уникальный дизайн под продукт" },
              ].map((r, i) => (
                <div key={r.row} className="contents">
                  <div className={`p-4 sm:p-5 font-bold text-neutral-800 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.row}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-500 text-center border-l border-neutral-200 ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                    {r.a}
                  </div>
                  <div className={`p-4 sm:p-5 text-neutral-900 text-center font-bold border-l border-neutral-200 ${i % 2 === 0 ? "bg-violet-50/40" : "bg-white"}`}>
                    {r.b}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <PricingSection theme={THEMES.presentations} />

      {/* ── 9. FAQ ─────────────────────────────────────────────── */}
      <div id="faq" />

      <section className="py-20 px-4 border-t border-neutral-100">
        <div className="max-w-3xl mx-auto">
          <motion.div {...REVEAL} className="text-center mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-3 block">
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
      <section className="py-24 px-4 border-t border-neutral-100 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2 {...REVEAL} className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            Создай первую презентацию сейчас
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
            {["7 слайдов", "Стрелки ← →", "aicreative.kz/p/{slug}", "Скачивание HTML"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> {f}
              </span>
            ))}
          </motion.div>
          <motion.div {...REVEAL} transition={{ duration: 0.4, delay: 0.2 }}>
            <Link
              href="/presentations/new"
              className="group bg-neutral-900 hover:bg-black text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2 mx-auto w-fit transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-5 h-5" />
              Начать
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/15 px-2 py-0.5 rounded">
                <Zap className="w-3.5 h-3.5" /> {PRESENTATION_GEN_COST}
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
