"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, ArrowRight, Upload, Wand2, Play, Image as ImageIcon, Zap, Target, BarChart3, TrendingUp, Key, XCircle, CheckCircle2, ChevronDown, Star, ShoppingBag, ShoppingCart, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

// Dummy data for gallery
const galleryItems = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  isAnimated: i % 2 === 0,
  before: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Before",
  after: "https://placehold.co/400x500/ffcca8/f37021?text=After"
}));

// Dummy reviews
const reviews = [
  { name: "Амиржан Д.", role: "Таргетолог", text: "Раньше ждал креосы от дизов по 2 дня. Сейчас генерю 30 штук за час и сразу в тест." },
  { name: "Алина К.", role: "Владелец магазина", text: "Снизила стоимость клика в 3 раза, картинки просто космос, как из реальной студии." },
  { name: "Руслан М.", role: "SMM Студия", text: "Очень круто работает анимация. Клиенты в шоке, что мы стали отдавать ролики так быстро." },
  { name: "Мадина С.", role: "Селлер Kaspi", text: "Для карточек товаров самое то! Идеально вырезает фон и ставит на красивый подиум." }
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [calcBudget, setCalcBudget] = useState<number>(10000);

  const faqs = [
    {
      q: "Для каких рекламных плейсментов подходят креативы?",
      a: "Наши ИИ-алгоритмы генерируют медиаматериалы, идеально подходящие для таргетированной рекламы (Instagram, Facebook Ads, TikTok), а также для посевов в Telegram. Интеллектуальный ресайзинг позволяет делать статичные постеры 1:1, 4:5 и мощные Reels/Shorts 9:16."
    },
    {
      q: "Нужны ли мне навыки дизайна?",
      a: "Нет. Наш алгоритм разработан специально для владельцев бизнеса и таргетологов, чтобы обходить этап поиска дизайнера. ИИ сам вырезает фон, строит премиальную композицию, накладывает динамические освещения и рендерит."
    },
    {
      q: "Как быстро я получу ролик?",
      a: "В среднем процесс занимает 60 секунд от нажатия кнопки до готового файла, который можно сразу загружать в Ads Manager."
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
          <span className="font-bold text-xl tracking-tight">AICreative.kz</span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-neutral-600">
          <a href="#gallery" className="hover:text-hermes-600 transition-colors">Примеры</a>
          <a href="#how-it-works" className="hover:text-hermes-600 transition-colors">Как это работает</a>
          <a href="#pricing" className="hover:text-hermes-600 transition-colors">Тарифы</a>
  <a href="#faq" className="hover:text-hermes-600 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
              <button className="text-sm font-bold border-2 border-neutral-200 text-neutral-800 px-5 py-2 rounded-xl hover:border-hermes-500 hover:text-hermes-600 transition-all">
                Личный кабинет
              </button>
            </SignInButton>
          ) : (
            <div className="flex items-center gap-3">
  <Link href="/editor" className="hidden sm:block text-sm font-bold text-hermes-600 hover:text-hermes-700 transition">В редактор →</Link>
  <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 shadow-md" } }} />
</div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-16 md:pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-hermes-100/50 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center z-10 relative">
          <motion.div 
            initial="hidden" animate="visible" variants={staggerContainer}
            className="text-left"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hermes-50 border border-hermes-200 text-hermes-700 text-sm font-semibold mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hermes-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-hermes-500"></span>
              </span>
              Creative AI Ads
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              Генерируй продающие <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-500 to-[#d95e16]">
                креативы за 60 секунд
              </span>
            </motion.h1>
            
            <motion.h2 variants={fadeUp} className="text-xl md:text-2xl text-neutral-600 mb-8 font-medium">
              Без дизайнера. Без ожидания. От 79 ₸ за креатив.
            </motion.h2>
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              {!isSignedIn ? (
                <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                  <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-5 bg-hermes-500 hover:bg-hermes-600 text-white font-bold rounded-2xl text-lg transition-all shadow-xl shadow-hermes-500/20 hover:-translate-y-1">
                    <Zap className="w-5 h-5 fill-white" />
                    Получить 17 Импульсов бесплатно
                  </button>
                </SignInButton>
              ) : (
                <Link href="/editor" className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-5 bg-hermes-500 hover:bg-hermes-600 text-white font-bold rounded-2xl text-lg transition-all shadow-xl shadow-hermes-500/20 hover:-translate-y-1">
                  <Zap className="w-5 h-5 fill-white" />
                  Перейти к генерации
                </Link>
              )}
              <a href="#gallery" className="w-full sm:w-auto text-center px-8 py-5 font-bold rounded-2xl text-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors">
                Посмотреть примеры
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12 flex flex-wrap items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex items-center gap-1 font-bold text-sm"><ShoppingCart className="w-4 h-4"/> Kaspi</div>
              <div className="flex items-center gap-1 font-bold text-sm"><ShoppingBag className="w-4 h-4"/> Wildberries</div>
              <div className="flex items-center gap-1 font-bold text-sm"><ShoppingBag className="w-4 h-4"/> Ozon</div>
              <div className="flex items-center gap-1 font-bold text-sm"><Target className="w-4 h-4"/> Meta Ads</div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full aspect-[4/5] lg:aspect-square bg-neutral-100 rounded-[2rem] border border-neutral-200 shadow-2xl overflow-hidden group"
          >
            {/* Split Before/After Mockup */}
            <div className="absolute inset-0 flex">
               <div className="w-1/2 h-full bg-white relative overflow-hidden border-r border-neutral-200/50">
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-300">
                     <ImageIcon className="w-16 h-16 mb-4" />
                     <p className="font-bold">Original Product</p>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm text-xs font-bold px-3 py-1 rounded-lg">Было</div>
               </div>
               <div className="w-1/2 h-full bg-gradient-to-br from-hermes-400 to-[#d95e16] relative overflow-hidden">
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                     <Sparkles className="w-16 h-16 mb-4 animate-pulse fill-white" />
                     <p className="font-bold text-white">AI Ad Creative</p>
                  </div>
                   <div className="absolute bottom-4 left-4 bg-black/40 text-white backdrop-blur-sm text-xs font-bold px-3 py-1 rounded-lg">Стало за 60 секунд</div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-24 bg-neutral-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Что генерирует наш ИИ</h2>
            <p className="text-neutral-500 text-lg">Реальные примеры статичных и анимированных креативов</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {galleryItems.map((item) => (
              <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-white shadow-sm border border-neutral-200 aspect-[4/5] hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className="absolute top-3 left-3 z-10">
                  <span className={clsx(
                    "px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm backdrop-blur-md flex items-center gap-1",
                    item.isAnimated ? "bg-black/70 text-white" : "bg-white/90 text-neutral-800"
                  )}>
                    {item.isAnimated ? <><Play className="w-3 h-3 fill-white" /> Анимированный</> : <><ImageIcon className="w-3 h-3" /> Статичный</>}
                  </span>
                </div>
                
                {/* Before / After Image Placeholder */}
                <div className="absolute inset-0 transition-opacity duration-300 opacity-100 group-hover:opacity-0 bg-neutral-100 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-neutral-400 mb-2">ОРИГИНАЛ</span>
                  <ImageIcon className="w-8 h-8 text-neutral-300" />
                </div>
                <div className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100 bg-hermes-100 flex flex-col items-center justify-center">
                   <span className="text-sm font-bold text-hermes-600 mb-2">РЕЗУЛЬТАТ</span>
                   <Sparkles className="w-8 h-8 text-hermes-400 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Blocks */}
      <section className="py-24 bg-white border-y border-neutral-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          {/* A. Нам доверяют */}
          <div className="text-center mb-20">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-8">Нам доверяют лучшие бренды и продавцы</h3>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-60 grayscale">
              <span className="text-2xl font-black">KASPI.KZ</span>
               <span className="text-2xl font-black italic">Wildberries</span>
               <span className="text-2xl font-bold text-blue-600">OZON</span>
               <span className="text-2xl font-extrabold tracking-tight">ARBUZ.KZ</span>
               <span className="text-2xl font-black">CHOCO</span>
               <span className="text-2xl font-bold font-serif">MAGNUM</span>
            </div>
          </div>

          {/* B. Результаты */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
             <div className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 text-center">
                <TrendingUp className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl font-extrabold mb-2">Увеличили CTR на 47%</h4>
                <p className="text-neutral-500 text-sm">В среднем за 2 недели тестов ИИ-креативов</p>
             </div>
             <div className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 text-center">
                <BarChart3 className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl font-extrabold mb-2">Снизили цену в 6 раз</h4>
                <p className="text-neutral-500 text-sm">Стоимость производства креатива упала значительно</p>
             </div>
             <div className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 text-center">
                <Target className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl font-extrabold mb-2">180 креативов / мес</h4>
                <p className="text-neutral-500 text-sm">Генерирует один таргетолог без дизайнера</p>
             </div>
          </div>

          {/* C. Отзывы */}
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold">Что говорят пользователи</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reviews.map((rev, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm relative pt-12">
                <div className="absolute top-0 right-6 -translate-y-1/2 flex items-center gap-1 bg-hermes-50 px-3 py-1 rounded-full border border-hermes-100">
                  <Star className="w-3 h-3 text-hermes-500 fill-hermes-500" />
                  <Star className="w-3 h-3 text-hermes-500 fill-hermes-500" />
                  <Star className="w-3 h-3 text-hermes-500 fill-hermes-500" />
                  <Star className="w-3 h-3 text-hermes-500 fill-hermes-500" />
                  <Star className="w-3 h-3 text-hermes-500 fill-hermes-500" />
                </div>
                <p className="text-neutral-700 text-sm mb-6 pb-6 border-b border-neutral-100 italic">«{rev.text}»</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-200" />
                  <div>
                    <h4 className="font-bold text-sm">{rev.name}</h4>
                    <p className="text-xs text-neutral-400">{rev.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-neutral-900 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Как это работает</h2>
            <p className="text-neutral-400 text-lg">Сокращаем рутину до трех простых действий</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-neutral-800/50 rounded-[2rem] p-8 border border-neutral-700/50 relative overflow-hidden backdrop-blur-sm">
              <div className="text-6xl font-black text-white/5 absolute -right-4 -bottom-4">1</div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Загрузи товар</h3>
              <p className="text-neutral-400 leading-relaxed">
                Загрузите фото товара с телефона или камеры. ИИ моментально вырежет фон (даже волосы и мех) и подготовит чистый объект.
              </p>
            </div>
            
            <div className="bg-neutral-800/50 rounded-[2rem] p-8 border border-neutral-700/50 relative overflow-hidden backdrop-blur-sm">
              <div className="text-6xl font-black text-white/5 absolute -right-4 -bottom-4">2</div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Опиши сцену</h3>
              <p className="text-neutral-400 leading-relaxed">
                Напиши промпт или выбери стиль: "Киберпанк, неон, подиум" или "Уютная кухня, солнце из окна". 
              </p>
            </div>

            <div className="bg-gradient-to-br from-hermes-500 to-[#d95e16] rounded-[2rem] p-8 border border-hermes-400 relative overflow-hidden shadow-2xl shadow-hermes-500/20">
              <div className="text-6xl font-black text-white/10 absolute -right-4 -bottom-4">3</div>
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Готовый креатив</h3>
              <p className="text-white/90 leading-relaxed">
                Получи статичный постер (PNG) или динамичное видео (MP4 9:16) через минуту. Готово к загрузке в кабинет.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section in Tenge */}
      <section id="pricing" className="py-24 bg-neutral-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Выгодные пакеты Импульсов ⚡</h2>
            <p className="text-neutral-500 text-lg max-w-2xl mx-auto mb-8">
              Внутренняя валюта: <br />
              <b>1 статичный креатив = 3 Импульса, 1 анимированный = 4 Импульса.</b>
            </p>

            {/* Calculator */}
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
              <h4 className="font-bold mb-4">Сколько креативов я получу?</h4>
              <input 
                type="range" min="1990" max="49980" step="1000" 
                value={calcBudget} 
                onChange={(e) => setCalcBudget(Number(e.target.value))}
                className="w-full accent-hermes-500 mb-4"
              />
              <div className="flex justify-between items-center text-sm mb-4">
                <span className="text-neutral-400">Бюджет:</span>
                <span className="font-bold text-lg">{calcBudget.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="p-3 bg-hermes-50 rounded-xl text-hermes-700 font-medium text-sm">
                Вы сгенерируете около <b>{Math.floor(calcBudget / 79)}</b> креативов!
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch max-w-7xl mx-auto mt-16">
            {/* Start Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
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
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 45 Импульсов</span>
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
                  ≈ 133 ₸ / креатив
                </li>
              </ul>
            </div>

            {/* Creator Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-neutral-400" />
                  <h3 className="text-xl font-bold">Креатор</h3>
                </div>
                <p className="text-neutral-500 text-sm h-14">Небольшим магазинам и авторам без команды.</p>
                <div className="my-4">
                  <span className="text-3xl font-extrabold text-neutral-900">4 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold">
                  <span>Баланс:</span>
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 126 Импульсов</span>
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
                  ≈ 119 ₸ / креатив
                </li>
              </ul>
            </div>

            {/* Studio Plan */}
            <div className="bg-neutral-900 p-6 md:p-8 rounded-[2rem] shadow-2xl shadow-hermes-500/30 flex flex-col h-full relative transform lg:scale-105 border-2 border-hermes-500 z-10 group hover:shadow-hermes-500/40 transition-shadow">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase shadow-lg">
                Самый популярный
              </div>
              <div className="mb-6 pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-hermes-400" />
                  <h3 className="text-xl font-bold text-white">Студия</h3>
                </div>
                <p className="text-neutral-400 text-sm h-14">Идеально для постоянных A/B тестов.</p>
                <div className="my-4 text-white">
                  <span className="text-3xl font-extrabold">14 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-800 rounded-xl border border-neutral-700 flex items-center justify-between text-sm font-bold text-white">
                  <span>Баланс:</span>
                  <span className="text-hermes-400 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 453 Импульса</span>
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
                  ≈ 99 ₸ / креатив
                </li>
              </ul>
            </div>

            {/* Business Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full relative cursor-default">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-neutral-400" />
                  <h3 className="text-xl font-bold">Бизнес</h3>
                </div>
                <p className="text-neutral-500 text-sm h-14">Для агентств перформанс-маркетинга.</p>
                <div className="my-4">
                  <span className="text-3xl font-extrabold text-neutral-900">49 980 ₸</span>
                </div>
                <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold">
                  <span>Баланс:</span>
                  <span className="text-hermes-600 flex items-center gap-1.5"><Zap className="w-4 h-4"/> 1 899 Импульсов</span>
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
                  ≈ 79 ₸ / креатив
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 text-neutral-400 text-sm mb-[80px] sm:mb-0 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-8 mb-8">
           <div className="col-span-1 md:col-span-1">
             <div className="flex items-center gap-2 mb-4">
               <Sparkles className="w-5 h-5 text-hermes-500" />
               <span className="font-bold text-white text-lg tracking-tight">AICreative.kz</span>
             </div>
             <p className="text-neutral-500 text-xs">Система генерации рекламных креативов на основе ИИ, снижающая CPL и затраты на дизайн.</p>
           </div>
           
           <div>
              <h4 className="font-bold text-white mb-4">Продукт</h4>
              <div className="flex flex-col gap-2">
                 <a href="#how-it-works" className="hover:text-hermes-400 transition">Как это работает</a>
                 <a href="#gallery" className="hover:text-hermes-400 transition">Примеры</a>
                 <a href="#pricing" className="hover:text-hermes-400 transition">Прайсинг</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Документы</h4>
              <div className="flex flex-col gap-2">
                 <a href="#" className="hover:text-hermes-400 transition">Политика конфиденциальности</a>
                 <a href="#" className="hover:text-hermes-400 transition">Пользовательское соглашение</a>
                 <a href="#" className="hover:text-hermes-400 transition">Оферта</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Поддержка</h4>
              <div className="flex flex-col gap-2">
                 <a href="https://t.me/aicreative_bot" target="_blank" rel="noreferrer" className="hover:text-hermes-400 transition flex items-center gap-2">
                   Telegram-бот / Поддержка
                 </a>
                 <a href="mailto:support@aicreative.kz" className="hover:text-hermes-400 transition">support@aicreative.kz</a>
              </div>
           </div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6 pt-8 border-t border-neutral-800 text-center text-xs">
           © {new Date().getFullYear()} AICreative.kz. Все права защищены.
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/90 to-transparent z-50 safe-area-bottom pb-6">
         {!isSignedIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
               <button className="w-full bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                  <Zap className="w-5 h-5 fill-white/20" /> Открыть приложение
               </button>
            </SignInButton>
          ) : (
            <Link href="/editor" className="w-full bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
               <Zap className="w-5 h-5 fill-white/20" /> Открыть в редакторе
            </Link>
          )}
      </div>
    </main>
  );
}
