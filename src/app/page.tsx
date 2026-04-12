"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, ArrowRight, Upload, Wand2, Download, CheckCircle2, Zap, Target, BarChart3, TrendingUp, Key, Gem, XCircle, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Для каких рекламных плейсментов подходят креативы?",
      a: "Наши ИИ-алгоритмы генерируют медиаматериалы, идеально подходящие для таргетированной рекламы (Instagram, Facebook Ads, TikTok), а также для посевов в Telegram. Интеллектуальный ресайзинг позволяет делать статичные постеры 1:1, 4:5 и мощные Reels/Shorts 9:16."
    },
    {
      q: "Нужны ли мне навыки дизайна для создания видео-рекламы?",
      a: "Нет. Наш алгоритм разработан специально для владельцев бизнеса и таргетологов, чтобы обходить этап поиска дизайнера. ИИ сам вырезает фон, строит премиальную композицию, накладывает динамические освещения и рендерит MP4-анимацию."
    },
    {
      q: "Как быстро я получу видеоролик для рекламы?",
      a: "В среднем процесс занимает 60-90 секунд от нажатия кнопки до готового MP4 файла, который можно сразу загружать в Ads Manager."
    },
    {
      q: "Сможет ли ИИ вписать мой продукт в креативную среду?",
      a: "Да, вы можете задать любой референс или ТЗ. Например: 'Уходовая сыворотка левитирует в джунглях, стилистика киберпанк, яркие неоновые акценты'. ИИ поймет это и создаст композицию с идеальными тенями."
    }
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  } as any;
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  } as any;

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-hermes-200">
      
      {/* Navigation */}
      <nav className="w-full flex items-center justify-between p-6 max-w-6xl mx-auto sticky top-0 bg-white/90 backdrop-blur-md z-50 border-b border-neutral-100 transition-all">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Creative AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-neutral-600">
          <a href="#how-it-works" className="hover:text-hermes-600 transition-colors">Как это работает</a>
          <a href="#comparison" className="hover:text-hermes-600 transition-colors">Сравнение</a>
          <a href="#pricing" className="hover:text-hermes-600 transition-colors">Тарифы</a>
          <a href="#faq" className="hover:text-hermes-600 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
              <button className="text-sm font-bold border-2 border-neutral-200 text-neutral-800 px-5 py-2 rounded-xl hover:border-hermes-500 hover:text-hermes-600 transition-all">
                Войти
              </button>
            </SignInButton>
          ) : (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 shadow-md" } }} />
          )}
          {!isSignedIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
              <button className="text-sm font-bold bg-neutral-900 text-white px-5 py-2.5 rounded-xl hover:bg-hermes-500 hover:shadow-lg hover:shadow-hermes-500/30 transition-all hidden sm:block">
                Доступ в Редактор
              </button>
            </SignInButton>
          ) : (
            <Link href="/editor" className="text-sm font-bold bg-neutral-900 text-white px-5 py-2.5 rounded-xl hover:bg-hermes-500 hover:shadow-lg hover:shadow-hermes-500/30 transition-all hidden sm:block">
              Доступ в Редактор
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-hermes-100/50 rounded-full blur-3xl -z-10" />
        <div className="absolute top-20 -left-20 w-[300px] h-[300px] bg-hermes-200/30 rounded-full blur-3xl -z-10 animate-float" />
        <div className="absolute top-40 -right-20 w-[200px] h-[200px] bg-amber-100/40 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '2s' }} />
        
        <motion.div 
          className="max-w-4xl mx-auto px-6 text-center z-10 relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp} className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-hermes-50 border border-hermes-200 text-hermes-700 text-sm font-semibold mb-8">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hermes-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-hermes-500"></span>
            </span>
            Снижение стоимости клика (CPC) за счет мощного визуала
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Продающие рекламные креативы <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-500 to-[#d95e16]">
              для бизнеса и таргета
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-xl text-neutral-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Избавьтесь от долгих ожиданий и мучений с дизайнерами. Наш ИИ генерирует шикарные статичные баннеры и динамичные видеоролики для Meta, TikTok и Telegram в 1 клик.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isSignedIn ? (
              <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-hermes-500 hover:bg-hermes-600 text-white font-bold rounded-2xl text-lg transition-all shadow-xl shadow-hermes-500/20 hover:-translate-y-1">
                  <Zap className="w-5 h-5 fill-white" />
                  Сгенерировать креатив
                </button>
              </SignInButton>
            ) : (
              <Link href="/editor" className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-hermes-500 hover:bg-hermes-600 text-white font-bold rounded-2xl text-lg transition-all shadow-xl shadow-hermes-500/20 hover:-translate-y-1">
                <Zap className="w-5 h-5 fill-white" />
                Сгенерировать креатив
              </Link>
            )}
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-xs text-neutral-400">
            Свободный демо-доступ. Дарим <b className="text-neutral-600">17 ⚡ Пульсов</b> (Тест).
          </motion.p>
        </motion.div>
      </section>

      {/* Ticker / Marquee Section */}
      <section className="bg-neutral-900 py-6 border-y border-neutral-800 overflow-hidden relative shadow-inner">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-neutral-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-neutral-900 to-transparent z-10 pointer-events-none" />
        <div className="animate-marquee flex items-center gap-12 font-extrabold text-neutral-700 text-2xl tracking-widest uppercase hover:[animation-play-state:paused] cursor-default">
           <span className="hover:text-white transition-colors">INSTAGRAM REELS</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">FACEBOOK ADS</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">TIKTOK CREATIVES</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">TELEGRAM ПРОМО</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">GOOGLE PERFORMANCE MAX</span>
           <span className="text-hermes-500">✦</span>
           {/* Duplicate for infinite effect */}
           <span className="hover:text-white transition-colors">INSTAGRAM REELS</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">FACEBOOK ADS</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">TIKTOK CREATIVES</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">TELEGRAM ПРОМО</span>
           <span className="text-hermes-500">✦</span>
           <span className="hover:text-white transition-colors">GOOGLE PERFORMANCE MAX</span>
        </div>
      </section>

      {/* Target Audiences / Benefits */}
      <section id="how-it-works" className="py-24 bg-neutral-50/50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="mb-16 md:flex justify-between items-end"
          >
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Как ИИ спасает маркетинг</h2>
              <p className="text-neutral-500 text-lg">Три шага к снижению CPL и пробитию баннерной слепоты.</p>
            </div>
            <Link href="/login" className="hidden md:flex items-center gap-2 text-hermes-600 font-bold hover:text-hermes-700 transition-colors">
              Попробовать в редакторе <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="space-y-24">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:w-1/2 flex justify-center"
              >
                <div className="relative w-full max-w-sm aspect-square bg-white rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-8 flex flex-col items-center justify-center text-center animate-float">
                   <div className="absolute top-4 left-4 w-8 h-8 bg-hermes-100 text-hermes-600 font-bold rounded-lg flex items-center justify-center shadow-sm">1</div>
                   <Upload className="w-16 h-16 text-neutral-300 mb-6" />
                   <p className="font-bold text-neutral-400">Загрузите ваш исходник <br/> или продукт</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:w-1/2 space-y-4 text-center md:text-left"
              >
                <h3 className="text-2xl font-bold">Устранение рутины (Удаление Фона)</h3>
                <p className="text-neutral-500 text-lg leading-relaxed">
                  Больше никакой возни с Pen Tool в Photoshop. Нейросеть самостоятельно определяет центральный объект, идеально вырезает его (даже сложные волосы или мех) и подготавливает для рекламной сцены.
                </p>
              </motion.div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:w-1/2 flex justify-center"
              >
                <div className="relative w-full max-w-sm aspect-square bg-white rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-8 flex flex-col items-center justify-center text-center">
                   <div className="absolute top-4 left-4 w-8 h-8 bg-hermes-100 text-hermes-600 font-bold rounded-lg flex items-center justify-center shadow-sm">2</div>
                   <div className="w-full h-32 bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-left shadow-inner">
                      <p className="text-neutral-400 font-mono text-sm leading-relaxed text-balance">"Неон, стиль киберпанк, яркое красное освещение слева, крупная типографика..."</p>
                   </div>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:w-1/2 space-y-4 text-center md:text-left"
              >
                <h3 className="text-2xl font-bold">Опишите задачу нейросети</h3>
                <p className="text-neutral-500 text-lg leading-relaxed">
                  Нужен строгий B2B-баннер или дерзкий постер для молодежной аудитории? Опишите это своими словами, или загрузите референс стиля. Наш алгоритм поймет, что от него требуется, и соберет макет.
                </p>
              </motion.div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:w-1/2 flex justify-center"
              >
                <div className="relative w-full max-w-sm aspect-square bg-gradient-to-br from-hermes-400 to-[#d95e16] rounded-3xl shadow-2xl shadow-hermes-500/40 border border-neutral-100 p-8 flex flex-col items-center justify-center text-center text-white">
                   <div className="absolute top-4 left-4 w-8 h-8 bg-white/20 font-bold rounded-lg flex items-center justify-center backdrop-blur-md">3</div>
                   <Sparkles className="w-16 h-16 mb-4 animate-pulse" />
                   <h4 className="text-2xl font-bold">Рендер за 99 секунд!</h4>
                   <p className="opacity-80 mt-2">Ваш MP4 ролик или PNG готовы к запуску РК.</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:w-1/2 space-y-4 text-center md:text-left"
              >
                <h3 className="text-2xl font-bold">Тестируйте гипотезы быстрее</h3>
                <p className="text-neutral-500 text-lg leading-relaxed">
                  Пока конкуренты ждут ответа от агентства, вы создаете 20-30 вариаций креативов и запускаете их в сплит-тест (A/B тест). Больше тестов — ниже стоимость привлечения клиента.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-hermes-50 border border-hermes-200 font-semibold text-hermes-700 mt-2 shadow-sm text-sm">
                   Статика: 3 Пульса (⚡) | Видео: 4 Пульса (⚡)
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Niches / Application Areas */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Незаменимый инструмент для бизнеса</h2>
            <p className="text-neutral-500 text-lg">Создаем медиаресурсы, которые "пробивают" баннерную слепоту.</p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              {
                icon: <Target className="w-7 h-7" />,
                title: "Для Таргетологов",
                desc: "Запускайте пачками динамичные макеты для Reels, TikTok и VK Рекламы. Быстро находите связки с высоким CTR без привлечения моушн-дизайнеров.",
                bg: "bg-blue-100",
                text: "text-blue-600"
              },
              {
                 icon: <BarChart3 className="w-7 h-7" />,
                 title: "Для Владельцев бизнеса",
                 desc: "Сокращайте расходы на дизайн. Нейросеть сгенерирует десятки сочных и конвертящих баннеров для таргета и контекстной рекламы без посредников.",
                 bg: "bg-amber-100",
                 text: "text-amber-600"
               },
               {
                 icon: <TrendingUp className="w-7 h-7" />,
                 title: "Для SMM-агентств",
                 desc: "Создавайте сотни видео-креативов в месяц для десятков клиентов. Экономьте 80% бюджета на продакшене и выделяйте своих клиентов среди конкурентов.",
                 bg: "bg-emerald-100",
                 text: "text-emerald-600"
               }
            ].map((niche, idx) => (
              <motion.div 
                key={idx}
                variants={fadeUp}
                className="rounded-3xl bg-neutral-50 overflow-hidden border border-neutral-100 p-8 flex flex-col h-full hover:shadow-xl hover:bg-white transition-shadow cursor-pointer group"
              >
                <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", niche.bg, niche.text)}>
                  {niche.icon}
                </div>
                <h3 className="font-bold text-xl mb-3">{niche.title}</h3>
                <p className="text-neutral-600 text-sm flex-1 leading-relaxed">
                  {niche.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="comparison" className="py-24 bg-neutral-900 text-white relative overflow-hidden border-y border-neutral-800">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-hermes-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-hermes-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Агентство дизайна vs Creative AI</h2>
            <p className="text-neutral-400 text-lg">Зачем платить агентству, если нейросеть делает это моментально?</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="bg-neutral-800/50 rounded-3xl overflow-hidden border border-neutral-700/50 shadow-xl backdrop-blur-xl"
          >
            <div className="grid grid-cols-3 border-b border-neutral-700/50 bg-neutral-800/80 p-6">
              <div className="font-bold text-neutral-400 pl-4">Характеристика</div>
              <div className="font-bold text-center text-neutral-300">Классика (Дизайнер)</div>
              <div className="font-extrabold text-center text-hermes-400 flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" /> Creative AI
              </div>
            </div>
            <div className="divide-y divide-neutral-700/30">
              <div className="grid grid-cols-3 p-6 items-center hover:bg-neutral-800/40 transition-colors">
                <div className="font-medium text-neutral-400 pl-4">Скорость работы</div>
                <div className="text-center text-neutral-300 font-medium opacity-80">От 1 до 3 дней (с ТЗ)</div>
                <div className="text-center text-white font-bold text-lg animate-pulse">Моментально (до 15 сек)</div>
              </div>
              <div className="grid grid-cols-3 p-6 items-center bg-neutral-800/20 hover:bg-neutral-800/60 transition-colors">
                <div className="font-medium text-neutral-400 pl-4">Стоимость креатива</div>
                <div className="text-center text-neutral-300 font-medium opacity-80">От 5 000 ₸ за штуку</div>
                <div className="text-center text-white font-bold text-lg">От 79 ₸ (в 60 раз дешевле)</div>
              </div>
              <div className="grid grid-cols-3 p-6 items-center hover:bg-neutral-800/40 transition-colors">
                <div className="font-medium text-neutral-400 pl-4">Тестирование новых гипотез</div>
                <div className="text-center text-neutral-300 font-medium opacity-80 flex flex-col items-center"><XCircle className="w-5 h-5 text-red-400/50 mb-1" /> Дополнительная оплата и время</div>
                <div className="text-center text-hermes-400 font-medium flex flex-col items-center"><CheckCircle2 className="w-6 h-6 mb-1" /> Бесконечные тесты в пару кликов</div>
              </div>
              <div className="grid grid-cols-3 p-6 items-center bg-neutral-800/20 hover:bg-neutral-800/60 transition-colors">
                <div className="font-medium text-neutral-400 pl-4">Видео-анимация для таргета</div>
                <div className="text-center text-neutral-300 font-medium opacity-80 flex justify-center"><XCircle className="w-5 h-5 text-red-400/50" /></div>
                <div className="text-center text-hermes-400 font-medium flex justify-center"><CheckCircle2 className="w-6 h-6 drop-shadow-md" /></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section in Tenge */}
      <section id="pricing" className="py-24 bg-neutral-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Цены без сюрпризов (в Тенге)</h2>
            <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
              Мы используем внутреннюю валюту — Пульсы ⚡. <br />
              <b>1 статичный креатив = 3 Пульса, 1 анимированный = 4 Пульса.</b><br/>Вы можете тратить их в любом сочетании.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch max-w-7xl mx-auto"
          >
            {/* Start Plan */}
            <motion.div variants={fadeUp} className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-neutral-400" />
                  <h3 className="text-xl font-bold">Старт</h3>
                </div>
                <p className="text-neutral-500 text-sm h-14">Тестовый запуск на 1–3 товара.</p>
                <div className="my-4">
                  <span className="text-3xl font-extrabold text-neutral-900">1 990 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold">
                  <span>Баланс:</span>
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 45 Пульсов</span>
                </div>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>15 статичных</b>
                </li>
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>11 анимированных</b>
                </li>
                <li className="flex items-start gap-2 text-xs text-neutral-400 mt-2 bg-neutral-50 p-2 rounded-lg">
                  ≈ 133 ₸ / статичный креатив
                </li>
              </ul>
            </motion.div>

            {/* Creator Plan */}
            <motion.div variants={fadeUp} className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-neutral-400" />
                  <h3 className="text-xl font-bold">Креатор</h3>
                </div>
                <p className="text-neutral-500 text-sm h-14">Небольшим магазинам и авторам.</p>
                <div className="my-4">
                  <span className="text-3xl font-extrabold text-neutral-900">4 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold">
                  <span>Баланс:</span>
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 126 Пульсов</span>
                </div>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>42 статичных</b>
                </li>
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>31 анимированных</b>
                </li>
                <li className="flex items-start gap-2 text-xs text-neutral-400 mt-2 bg-neutral-50 p-2 rounded-lg">
                  ≈ 119 ₸ / статичный креатив
                </li>
              </ul>
            </motion.div>

            {/* Studio Plan */}
            <motion.div variants={fadeUp} className="bg-neutral-900 p-6 md:p-8 rounded-3xl shadow-2xl shadow-hermes-500/30 flex flex-col h-full relative transform lg:scale-105 border-2 border-hermes-500 z-10 group hover:shadow-hermes-500/40 transition-shadow">
              <div className="absolute top-0 right-4 -translate-y-1/2 bg-gradient-to-r from-hermes-400 to-[#d95e16] text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-lg group-hover:animate-pulse">
                Самый выгодный
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-hermes-400" />
                  <h3 className="text-xl font-bold text-white">Студия</h3>
                </div>
                <p className="text-neutral-400 text-sm h-14">Оптимально для ежедневного запуска рекламы.</p>
                <div className="my-4 text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                  <span className="text-3xl font-extrabold">14 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-800 rounded-xl border border-neutral-700 flex items-center justify-between text-sm font-bold text-white group-hover:bg-neutral-700 transition-colors">
                  <span>Баланс:</span>
                  <span className="text-hermes-400 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 453 Пульса</span>
                </div>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                <li className="flex items-start gap-2 text-sm text-neutral-200">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>151 статичного</b>
                </li>
                <li className="flex items-start gap-2 text-sm text-neutral-200">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>113 анимированных</b>
                </li>
                <li className="flex items-start gap-2 text-xs text-neutral-400 mt-2 bg-neutral-800 p-2 rounded-lg">
                  ≈ 99 ₸ / статичный креатив
                </li>
              </ul>
            </motion.div>

            {/* Business Plan */}
            <motion.div variants={fadeUp} className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-neutral-400" />
                  <h3 className="text-xl font-bold">Бизнес</h3>
                </div>
                <p className="text-neutral-500 text-sm h-14">Огромный объем для агентств перформанс-маркетинга.</p>
                <div className="my-4">
                  <span className="text-3xl font-extrabold text-neutral-900">49 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold">
                  <span>Баланс:</span>
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 1 899 Пульсов</span>
                </div>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>633 статичных</b>
                </li>
                <li className="flex items-start gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="w-4 h-4 text-hermes-500 shrink-0 mt-0.5" />
                  До <b>474 анимированных</b>
                </li>
                <li className="flex items-start gap-2 text-xs text-neutral-400 mt-2 bg-neutral-50 p-2 rounded-lg">
                  ≈ 79 ₸ / статичный креатив
                </li>
              </ul>
            </motion.div>
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             viewport={{ once: true }}
             transition={{ delay: 0.6 }}
             className="text-center mt-12"
          >
             <Link href="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-hermes-50/80 hover:bg-neutral-900 hover:text-white border border-hermes-100 text-hermes-700 font-bold rounded-2xl transition-all shadow-sm group">
               <Key className="w-5 h-5 group-hover:rotate-12 transition-transform" />
               У вас есть секретный промокод? Активировать доступ →
             </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-white border-t border-neutral-100">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Вопрос - Ответ</h2>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-4"
          >
            {faqs.map((faq, idx) => (
              <motion.div 
                variants={fadeUp}
                key={idx} 
                className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between focus:outline-none bg-neutral-50/30 hover:bg-neutral-50 transition-colors"
                >
                  <span className="font-bold text-neutral-900 text-lg pr-8">{faq.q}</span>
                  <ChevronDown className={clsx("w-5 h-5 text-neutral-400 transition-transform duration-300 shrink-0", openFaq === idx && "transform rotate-180 text-hermes-500")} />
                </button>
                <div 
                  className={clsx(
                    "px-6 text-neutral-500 leading-relaxed overflow-hidden transition-all duration-300",
                    openFaq === idx ? "max-h-64 pt-2 pb-5 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {faq.a}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 border-t border-neutral-800 text-neutral-500 text-sm">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-hermes-500" />
            <span className="font-bold text-white text-lg tracking-tight hover:text-white transition-colors cursor-pointer">Creative AI Ads</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors">Условия использования</a>
            <a href="#" className="hover:text-white transition-colors">Оферта</a>
          </div>
          <div>
            © {new Date().getFullYear()} Target AI Technologies
          </div>
        </div>
      </footer>
    </main>
  );
}
