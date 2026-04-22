"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef } from "react";
import {
  Sparkles, Play, Image as ImageIcon, Zap, Target,
  CheckCircle2, ChevronDown, Star,
  MessageSquare, Menu, X,
  ArrowRight, Gift,
  DollarSign, Check, RefreshCw, Building2,
  Shield, CreditCard, Lock
} from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { PRICING_TIERS } from "@/lib/pricing";
import { GoldParticles } from "@/components/landing/GoldParticles";
import { TiltCard } from "@/components/landing/TiltCard";
import { CountUp } from "@/components/landing/CountUp";

// --- DATA ---
type Transformation = {
  id: number;
  name: string;
  style: string;
  time: string;
  ctr: string;
  videoGen: string;
};

const transformations: Transformation[] = [
  { id: 1, name: "Автосалон", style: "Lead Gen / Тест-драйв", time: "45 сек", ctr: "+82%", videoGen: "/auto.mp4" },
  { id: 2, name: "Стоматология", style: "Trust / Скидка на брекеты", time: "52 сек", ctr: "+67%", videoGen: "/zub.mp4" },
  { id: 3, name: "Фитнес-студия", style: "Dynamic / Бесплатная тренировка", time: "58 сек", ctr: "+55%", videoGen: "/fitnes.mp4" },
];

// TODO: заменить на реальные логотипы клиентов. Формат: { name, src } (src — путь к SVG в /public/logos/).
// Сейчас текстовые плейсхолдеры стилизованы как бренд-бар.
const clientLogos = [
  "Kaspi", "Magnum", "Chocofamily", "Technodom", "Halyk", "Beeline", "Forte", "mChocolate"
];

// Pricing is imported from @/lib/pricing (single source of truth).
// The landing page, admin financial dashboard, and any future checkout
// MUST all read the same tier data — this is how we guarantee prices
// never drift between pages.
const pricingTiers = PRICING_TIERS;

const faqs = [
  { q: "Для каких платформ подходят креативы AICreative?", a: "Мы создаём креативы специально для Instagram, TikTok и YouTube Shorts (формат 9:16). Статичные креативы отлично работают в ленте Instagram и Kaspi (формат 1:1)." },
  { q: "Сколько Импульсов дают бесплатно при регистрации?", a: "Вы получаете 7 Импульсов. Этого хватит, чтобы сделать 1 статичный + 1 анимированный креатив абсолютно бесплатно и без привязки карты." },
  { q: "Можно ли генерировать в едином бренд-стиле всей линейки товаров?", a: "Да! Выбирайте один промпт-стиль — ИИ будет сохранять единый визуальный язык (цвета, освещение, настроение). Отлично подходит для создания цельной концепции магазина." },
  { q: "Что если результат мне не понравится?", a: "На старте вы можете менять промпты бесплатно. При покупке мы дарим +20 импульсов, чтобы у вас был свободный буфер на творческие эксперименты." },
  { q: "Нужно ли уметь дизайнить или снимать видео?", a: "Нет. Достаточно обычного фото товара (даже снятое на телефон на складе). ИИ сам превращает его в профессиональный продающий креатив за 60 секунд." },
  { q: "Как оплатить и можно ли вернуть деньги?", a: "Принимаем Kaspi Pay и банковские карты (VISA/Mastercard). Возврат средств возможен в течение 14 дней, если использовано менее 10% купленных Импульсов. Для оплаты для ИП/ТОО выставим закрывающие документы." },
  { q: "Сохраняете ли мои фото и промпты? Кто видит мои данные?", a: "Ваши загруженные фото и промпты доступны только вам через личный кабинет. Мы не передаём данные третьим лицам. Соответствуем Закону РК № 94-V «О персональных данных». Детали — в Политике конфиденциальности." },
  { q: "Можно ли использовать AI-креативы в рекламе — это не нарушает правил Meta/TikTok?", a: "Да, сгенерированные креативы можно запускать в Meta Ads, TikTok Ads и Kaspi Ads. Наши промпты обходят фильтры «недостоверный контент», так как создают иллюстрации товара, а не подделку лиц людей. Промпты на «фейк знаменитостей» мы блокируем заранее." },
  { q: "Что делать, если фото товара плохого качества?", a: "ИИ справляется даже со снимками на телефон при плохом освещении — автоматически убирает фон, выравнивает свет и добавляет студийные отражения. Минимальное требование: товар должен занимать хотя бы 30% кадра и быть в фокусе." },
  { q: "Можно ли работать командой?", a: "На тарифе «Бизнес» доступно управление командой: несколько аккаунтов, общий баланс Импульсов, единый бренд-стиль для всех креативов. Идеально для маркетинговых агентств." },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const { isSignedIn } = useAuth();
  
  // Custom Hook for Scroll Reveal
  const Reveal = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-100px" });
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, delay, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    );
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans overflow-x-hidden selection:bg-hermes-500/30 pb-20 md:pb-0">
      {/* BACKGROUND GLOWS */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-400/20 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute top-[30%] right-[-10%] w-[40%] h-[60%] bg-hermes-500/15 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] bg-yellow-400/20 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-neutral-50/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hermes-500 to-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(243,112,33,0.5)]">
               <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-neutral-900">AICreative</span>
          </div>
          
          <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-600">
            <a href="#how" className="hover:text-neutral-900 transition-colors">Как это работает</a>
            <a href="#gallery" className="hover:text-neutral-900 transition-colors">Галерея</a>
            <a href="#pricing" className="hover:text-neutral-900 transition-colors">Тарифы</a>
            <a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isSignedIn ? (
               <div className="flex items-center gap-4">
                 <Link href="/editor" className="text-sm font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-full border border-neutral-200 backdrop-blur-md transition-all">
                   В студию
                 </Link>
                 <UserButton />
               </div>
            ) : (
               <>
                 <SignInButton mode="modal">
                   <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Войти</button>
                 </SignInButton>
                 <SignInButton mode="modal">
                   <button className="text-sm font-bold text-white bg-hermes-500 hover:bg-hermes-600 px-5 py-2 rounded-full shadow-[0_0_20px_rgba(243,112,33,0.35)] transition-all">
                     Начать бесплатно
                   </button>
                 </SignInButton>
               </>
            )}
          </div>

          <button className="md:hidden text-neutral-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-neutral-200 bg-neutral-50/95 backdrop-blur-xl px-4 py-6 flex flex-col gap-4 overflow-hidden"
            >
               <a href="#how" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-neutral-600">Как это работает</a>
               <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-neutral-600">Галерея</a>
               <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-neutral-600">Тарифы</a>
               {isSignedIn ? (
                 <Link href="/editor" className="mt-4 text-center text-sm font-bold text-neutral-900 bg-gradient-to-r from-hermes-500 to-amber-500 px-5 py-3 rounded-xl transition-all">Перейти в Студию</Link>
               ) : (
                 <SignInButton mode="modal">
                   <button className="mt-4 text-center text-sm font-bold text-white bg-hermes-500 px-5 py-3 rounded-xl transition-all w-full">Начать бесплатно</button>
                 </SignInButton>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 pb-20 px-4 max-w-7xl mx-auto relative">
         <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 z-10">
               <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hermes-500/10 border border-hermes-500/20 text-hermes-600 text-sm font-semibold self-start"
               >
                 <Sparkles className="w-4 h-4" /> ИИ-революция в маркетинге 2026
               </motion.div>
               
               <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15] sm:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-neutral-900 to-neutral-600"
               >
                 ИИ делает продающие креативы за <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-hermes-600 to-amber-500">60 секунд.</span><br/>
                 <span className="text-[1.6rem] sm:text-4xl md:text-5xl lg:text-6xl text-neutral-900">Без дизайнера. Без съёмок.</span>
               </motion.h1>

               <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg md:text-xl text-neutral-600 max-w-xl leading-relaxed"
               >
                 Перестаньте сливать бюджет на тесты. Просто дайте ИИ референс стиля, и он соберет конверсионное видео с <strong className="text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200 ml-1 inline-block">CTR до 47%</strong>. Уже 2400+ маркетологов и селлеров используют AICreative.
               </motion.p>

               <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-4 mt-4"
               >
                  {isSignedIn ? (
                     <Link href="/editor">
                        <button className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-lg px-8 py-4 rounded-2xl overflow-hidden hover:scale-105 transition-all shadow-xl shadow-hermes-500/30">
                           Перейти в редактор
                           <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                           <div className="absolute inset-0 bg-white/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                     </Link>
                  ) : (
                     <SignInButton mode="modal">
                        <button className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-lg px-8 py-4 rounded-2xl overflow-hidden hover:scale-105 transition-all shadow-xl shadow-hermes-500/30">
                           Начать бесплатно
                           <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                           <div className="absolute inset-0 bg-white/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                     </SignInButton>
                  )}
               </motion.div>
               
               <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-4 text-sm text-neutral-500 font-medium"
               >
                  <span className="flex items-center gap-1"><Check className="w-4 h-4 text-hermes-500" /> Без карты</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Gift className="w-4 h-4 text-amber-500" /> 7 импульсов в подарок</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:flex items-center gap-1"><RefreshCw className="w-4 h-4 text-neutral-600" /> Отмена в 1 клик</span>
               </motion.div>

               {/* TRUST STATS */}
               <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="grid grid-cols-3 gap-6 pt-8 mt-4 border-t border-neutral-100"
               >
                  <div>
                     <div className="text-3xl font-black text-neutral-900 tabular-nums">
                        <CountUp to={2400} suffix="+" />
                     </div>
                     <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">Креативов<br/>за неделю</div>
                  </div>
                  <div>
                     <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-hermes-600 tabular-nums">
                        <CountUp to={47} prefix="+" suffix="%" />
                     </div>
                     <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">Рост CTR<br/>в среднем</div>
                  </div>
                  <div>
                     <div className="text-3xl font-black text-neutral-900 tabular-nums">
                        <CountUp to={58} /><span className="text-xl">с</span>
                     </div>
                     <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">Среднее время<br/>генерации</div>
                  </div>
               </motion.div>
            </div>

            {/* HERO VISUAL */}
            <motion.div
               initial={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
               animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
               transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
               className="relative lg:h-[700px] flex items-center justify-center z-0"
            >
               {/* Decorative Ring */}
               <div className="absolute inset-0 bg-gradient-to-tr from-hermes-500/20 to-amber-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
               <Image
                  src="/hero_visual_light.png"
                  alt="AICreative — интерфейс генератора ИИ-креативов"
                  width={1200}
                  height={900}
                  priority
                  sizes="(max-width: 1024px) 90vw, 600px"
                  className="relative z-10 w-full h-auto drop-shadow-[0_0_50px_rgba(243,112,33,0.3)] hover:scale-[1.02] transition-transform duration-700"
               />
            </motion.div>
         </div>
      </section>

      {/* BRAND TRUST BAR */}
      <section aria-label="Наши клиенты" className="py-10 relative border-t border-neutral-100 bg-white/50 backdrop-blur-sm overflow-hidden">
         <div className="max-w-7xl mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-6">
               Нам доверяют более 2400 команд из Казахстана и СНГ
            </p>
            <div className="relative">
               {/* Fade edges */}
               <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-neutral-50 to-transparent z-10 pointer-events-none" />
               <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-neutral-50 to-transparent z-10 pointer-events-none" />
               <div className="animate-marquee">
                  {[...clientLogos, ...clientLogos].map((logo, i) => (
                     <div key={i} className="flex-shrink-0 mx-8 text-2xl md:text-3xl font-black text-neutral-400 hover:text-neutral-600 transition-colors tracking-tight select-none">
                        {logo}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </section>

      {/* BEFORE / AFTER INTERACTIVE SECTION */}
      <section className="py-24 relative border-t border-neutral-100 bg-neutral-50/50 backdrop-blur-xl">
         <div className="max-w-7xl mx-auto px-4">
            <Reveal>
               <div className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-4">От одной идеи — к десяткам <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-600 to-amber-500">связок</span></h2>
                  <p className="text-xl text-neutral-600">Загружаете референс + оффер — забираете пачку готовых креативов для тестов.</p>
               </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6">
               {transformations.map((t, idx) => (
                  <Reveal key={t.id} delay={idx * 0.1}>
                     <div className="group relative rounded-3xl bg-white shadow-xl border border-neutral-200 overflow-hidden cursor-pointer hover:border-hermes-500/50 transition-colors shadow-2xl">
                        {/* Status Label */}
                        <div className="absolute top-4 left-4 z-20 bg-white/90 shadow-sm backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-neutral-200 text-neutral-900 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-hermes-600 animate-pulse" /> Отрендерено
                        </div>

                        {/* Images Container with Free Space Padding */}
                        <div className="p-4 sm:p-6 bg-neutral-100/50">
                           <div className="relative w-full aspect-[9/16] overflow-hidden rounded-2xl shadow-sm border border-neutral-200/60 bg-white">
                              <video src={t.videoGen} className="absolute inset-0 w-full h-full object-contain" autoPlay loop muted playsInline preload="metadata" />

                              {/* Always-visible gradient + label (enhanced on hover) */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent transition-opacity duration-500 flex flex-col justify-end p-5 pointer-events-none">
                                 <div className="flex items-end justify-between gap-3">
                                    <div>
                                       <div className="text-[10px] text-hermes-300 font-bold mb-1 tracking-wide uppercase">Гипотеза: {t.style}</div>
                                       <div className="text-lg font-bold text-white drop-shadow-md">{t.name}</div>
                                    </div>
                                    <div className="w-10 h-10 bg-hermes-500 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                                       <Play fill="currentColor" className="w-4 h-4 ml-0.5" />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Bottom Stats */}
                        <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-neutral-200 bg-neutral-50">
                           <div className="p-4 text-center">
                              <div className="text-xs text-neutral-500 uppercase">CTR</div>
                              <div className="font-bold text-green-700 text-lg">{t.ctr}</div>
                           </div>
                           <div className="p-4 text-center">
                              <div className="text-xs text-neutral-500 uppercase">Время</div>
                              <div className="font-bold text-neutral-900 text-lg">{t.time}</div>
                           </div>
                        </div>
                     </div>
                  </Reveal>
               ))}
            </div>
         </div>
      </section>

      {/* AUDIENCE / USE CASES */}
      <section className="py-24 relative overflow-hidden">
         <div className="max-w-7xl mx-auto px-4">
            <Reveal>
               <h2 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-16 text-center">Кому это нужно <span className="text-hermes-600">вчера</span></h2>
            </Reveal>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                  { icon: Target, title: "Таргетологи и Медиабайеры", text: "Генерируйте десятки видео-связок для тестов за 5 минут. Пробивайте баннерную слепоту и снижайте CPA (цену лида).", stat: "Цена заявки -60%" },
                  { icon: ImageIcon, title: "E-commerce и Магазины", text: "Снижайте стоимость привлечения клиента. Получайте студийные 4K-рендеры товаров без предметного фотографа.", stat: "ROAS (Окупаемость) +45%" },
                  { icon: Building2, title: "Маркетинговые Агентства", text: "Масштабируйте производство Reels и рекламных креативов для клиентов. Без раздувания штата дизайнеров.", stat: "Скорость работы x10" },
                  { icon: DollarSign, title: "Владельцы Бизнеса", text: "Тестируйте гипотезы самостоятельно или усильте своего таргетолога бесконечным потоком свежих AI-концепций.", stat: "Экономия до 300 000 ₸/мес" },
               ].map((item, i) => (
                  <Reveal key={i} delay={i * 0.1}>
                     <div className="bg-white border border-neutral-200 rounded-2xl p-6 hover:bg-neutral-50 hover:border-neutral-300 transition-colors h-full flex flex-col">
                        <div className="w-12 h-12 bg-white shadow-xl rounded-xl border border-neutral-100 flex items-center justify-center mb-6 text-neutral-600">
                           <item.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-3">{item.title}</h3>
                        <p className="text-neutral-600 text-sm leading-relaxed mb-6 flex-grow">{item.text}</p>
                        <div className="mt-auto px-3 py-2 bg-green-500/10 border border-green-500/20 text-green-700 text-sm font-bold rounded-lg self-start">
                           {item.stat}
                        </div>
                     </div>
                  </Reveal>
               ))}
            </div>
         </div>
      </section>

      {/* HOW IT WORKS (STEPS) */}
      <section id="how" className="py-24 relative border-y border-neutral-100 bg-white">
         <div className="max-w-7xl mx-auto px-4">
            <Reveal>
               <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16">
                  Всего <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-600 to-amber-500">4 шага</span> до готового креатива
               </h2>
            </Reveal>
            
            <div className="grid md:grid-cols-4 gap-8 relative">
               {/* Connection Line */}
               <div className="hidden md:block absolute top-12 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
               
               {[
                  { step: "01", title: "Придумай оффер", text: "Опиши текстом, что именно хочешь продать и с какой скидкой." },
                  { step: "02", title: "Загрузи референс", text: "Прикрепи картинку идеального дизайна, на который ИИ должен опереться." },
                  { step: "03", title: "ИИ творит магию", text: "Анализирует твой референс и создает уникальную анимацию и графику." },
                  { step: "04", title: "Скачай и получай заявки", text: "Забирай готовый MP4 ролик или JPEG (4K) за 60 секунд. Запускай таргет!" },
               ].map((item, i) => (
                  <Reveal key={i} delay={i * 0.1}>
                     <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-neutral-900 to-neutral-500 mb-6 shadow-xl">
                           {item.step}
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">{item.title}</h3>
                        <p className="text-neutral-600 text-sm leading-relaxed">{item.text}</p>
                     </div>
                  </Reveal>
               ))}
            </div>
         </div>
      </section>

      {/* CASES AND REVIEWS */}
      <section className="py-24 relative">
         <div className="max-w-7xl mx-auto px-4">
            <Reveal>
               <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-extrabold text-neutral-900 mb-4">Реальные <span className="text-amber-600">результаты</span></h2>
                  <p className="text-neutral-600 text-lg">Они уже зарабатывают больше благодаря AI.</p>
               </div>
            </Reveal>
            
            <div className="grid lg:grid-cols-2 gap-8">
               {/* Case 1 */}
               <Reveal delay={0.1}>
                  <div className="bg-white shadow-xl border border-neutral-200 rounded-3xl p-8 flex flex-col h-full hover:border-amber-500/30 transition-colors">
                     <div className="flex items-center gap-4 mb-8">
                        <Image src="/avatar_m.png" alt="Алибек Сулейменов" width={64} height={64} className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
                        <div>
                           <div className="text-neutral-900 font-bold text-lg">Алибек Сулейменов</div>
                           <div className="text-hermes-600 text-sm">Владелец товарного бизнеса</div>
                        </div>
                     </div>
                     <div className="mb-6 flex gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />)}
                     </div>
                     <p className="text-neutral-600 text-lg italic mb-8 grow">
                        «Раньше платил дизайнеру по 3000 тенге за ОДИН статичный баннер. Сейчас мы выгружаем десятками видео-анимации для тестов гипотез. Стоимость лида упала в 2.5 раза за счет крутого визуала.»
                     </p>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                           <div className="text-sm text-neutral-500 uppercase mb-1">Стоимость Лида (CPL)</div>
                           <div className="text-2xl font-bold text-green-700">-60%</div>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                           <div className="text-sm text-neutral-500 uppercase mb-1">Экономия на фото</div>
                           <div className="text-2xl font-bold text-neutral-900">400к ₸</div>
                        </div>
                     </div>
                  </div>
               </Reveal>

               {/* Case 2 */}
               <Reveal delay={0.2}>
                  <div className="bg-white shadow-xl border border-neutral-200 rounded-3xl p-8 flex flex-col h-full hover:border-hermes-500/30 transition-colors">
                     <div className="flex items-center gap-4 mb-8">
                        <Image src="/avatar_f.png" alt="Мадина К." width={64} height={64} className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
                        <div>
                           <div className="text-neutral-900 font-bold text-lg">Мадина К.</div>
                           <div className="text-amber-600 text-sm">Таргетолог / SMM</div>
                        </div>
                     </div>
                     <div className="mb-6 flex gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />)}
                     </div>
                     <p className="text-neutral-600 text-lg italic mb-8 grow">
                        «Анимации — это разрыв! Закинула обычное фото крема клиента, через минуту ИИ отдал готовый 3D видеоролик с каплями воды. Запустила в таргет Reels — клик упал с 18 центов до 4!»
                     </p>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                           <div className="text-sm text-neutral-500 uppercase mb-1">Стоимость клика (CPC)</div>
                           <div className="text-2xl font-bold text-green-700">-75%</div>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                           <div className="text-sm text-neutral-500 uppercase mb-1">Время на тест</div>
                           <div className="text-2xl font-bold text-neutral-900">1 час</div>
                        </div>
                     </div>
                  </div>
               </Reveal>
            </div>
         </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 relative border-t border-neutral-100 bg-neutral-50">
         <div className="max-w-7xl mx-auto px-4">
            <Reveal>
               <div className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-4">Выберите свой формат</h2>
                  <p className="text-xl text-neutral-600">1 статичный креатив = 3 импульса. 1 видео (анимация) = 4 импульса.</p>
               </div>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
               {pricingTiers.map((tier, idx) => (
                  <Reveal key={idx} delay={idx * 0.1}>
                    <TiltCard maxTiltDeg={5} className="h-full">
                     <div className={clsx(
                        "relative bg-white shadow-xl rounded-3xl p-8 border flex flex-col h-full hover:shadow-2xl transition-shadow duration-300",
                        tier.isHit ? "border-hermes-500 shadow-[0_0_30px_rgba(243,112,33,0.2)]" : "border-neutral-200 hover:border-neutral-300"
                     )}>
                        {tier.isHit && (
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-hermes-500 text-white text-xs font-black uppercase tracking-wider py-1 px-3 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3" /> Хит продаж
                           </div>
                        )}
                        <div className="mb-2 text-neutral-600 text-sm font-medium uppercase tracking-widest">{tier.name}</div>
                        <div className="text-4xl font-extrabold text-neutral-900 mb-2">{tier.priceLabel}</div>
                        <div className="text-sm text-neutral-500 mb-8 pb-8 border-b border-neutral-200">{tier.desc}</div>
                        
                        <div className="flex items-center gap-2 mb-8">
                           <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                           <span className="text-2xl font-bold text-neutral-900">{tier.impulses} <span className="text-base font-normal text-neutral-500">импульсов</span></span>
                        </div>

                        <ul className="space-y-4 mb-8 flex-grow">
                           {tier.features.map((feat, i) => (
                              <li key={i} className="flex gap-3 text-sm text-neutral-600">
                                 <CheckCircle2 className="w-5 h-5 text-hermes-500 shrink-0" />
                                 {feat}
                              </li>
                           ))}
                        </ul>

                        {/* Checkout URL carries tier name, price, impulses as
                            query params. /checkout already reads searchParams.
                            Signed-in users go straight there; unsigned users
                            are bounced through Clerk sign-in and Clerk's
                            `forceRedirectUrl` brings them back to the same
                            checkout URL. */}
                        {(() => {
                          const checkoutHref =
                            `/checkout?plan=${encodeURIComponent(tier.name)}` +
                            `&price=${encodeURIComponent(tier.priceLabel.replace(/[^0-9]/g, ''))}` +
                            `&impulses=${tier.impulses}`;
                          const buttonClass = clsx(
                            "w-full py-4 rounded-xl font-bold text-sm transition-all",
                            tier.isHit
                              ? "bg-gradient-to-r from-hermes-500 to-amber-500 text-white shadow-[0_0_20px_rgba(243,112,33,0.35)] hover:opacity-90 active:scale-[0.98]"
                              : "bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200 hover:border-neutral-300 active:scale-[0.98]",
                          );
                          return isSignedIn ? (
                            <Link href={checkoutHref} className={buttonClass + " inline-block text-center"}>
                              {tier.btn}
                            </Link>
                          ) : (
                            <SignInButton mode="modal" forceRedirectUrl={checkoutHref}>
                              <button className={buttonClass}>{tier.btn}</button>
                            </SignInButton>
                          );
                        })()}
                     </div>
                    </TiltCard>
                  </Reveal>
               ))}
            </div>
         </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 relative border-t border-neutral-100 bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4">
          <Reveal>
             <h2 className="text-3xl md:text-5xl font-extrabold text-neutral-900 text-center mb-16">Частые вопросы</h2>
          </Reveal>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                 <details className="group bg-white shadow-xl border border-neutral-200 rounded-2xl open:border-hermes-500/50 transition-colors">
                   <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-6 text-lg text-neutral-900">
                     <span>{faq.q}</span>
                     <span className="transition group-open:rotate-180 bg-neutral-50 border-neutral-100 p-2 rounded-full">
                        <ChevronDown className="w-5 h-5" />
                     </span>
                   </summary>
                   <div className="text-neutral-600 px-6 pb-6 leading-relaxed">
                     {faq.a}
                   </div>
                 </details>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
             <div className="mt-12 text-center bg-orange-400/10 border border-amber-500/20 rounded-2xl p-8 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Остались вопросы?</h3>
                <p className="text-neutral-600 mb-6">Наша поддержка на связи 24/7 и готова помочь с генерациями.</p>
                <a href="https://t.me/aicreative_support" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#2AABEE] text-white font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                   <MessageSquare className="w-5 h-5" /> Задать вопрос в Telegram
                </a>
             </div>
          </Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 md:py-40 relative overflow-hidden bg-hermes-500">
         <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/50 to-transparent" />
         {/* Gold particles — lazy-loaded via IntersectionObserver */}
         <GoldParticles />
         <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <Reveal>
               <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-6 drop-shadow-sm">
                  Готовы взорвать продажи?
               </h2>
               <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-2xl mx-auto font-medium">
                  Хватит платить за дорогие студии и неделями ждать тестов. Получите первую конверсионную связку от ИИ уже через 60 секунд.
               </p>
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <SignInButton mode="modal">
                     <button className="bg-white text-hermes-600 font-black text-xl px-12 py-6 rounded-2xl hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-2xl w-full sm:w-auto">
                        Начать бесплатно (7 импульсов)
                        <Sparkles className="w-6 h-6 text-amber-500" />
                     </button>
                  </SignInButton>
               </div>
            </Reveal>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 bg-neutral-50 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 pb-10 border-b border-neutral-200">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hermes-500 to-amber-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-neutral-900">AICreative</span>
              </div>
              <p className="text-sm text-neutral-600 max-w-md leading-relaxed">
                ИИ-генератор рекламных креативов для Instagram, TikTok и Kaspi. За 60 секунд — от идеи до готового ролика.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-5 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Безопасно</span>
                <span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Kaspi Pay / VISA / MC</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> SSL</span>
              </div>
            </div>

            {/* Nav */}
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-4">Продукт</div>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><a href="#how" className="hover:text-neutral-900 transition-colors">Как это работает</a></li>
                <li><a href="#gallery" className="hover:text-neutral-900 transition-colors">Галерея</a></li>
                <li><a href="#pricing" className="hover:text-neutral-900 transition-colors">Тарифы</a></li>
                <li><a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal & Contact */}
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-4">Документы</div>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><Link href="/privacy" className="hover:text-neutral-900 transition-colors">Политика конфиденциальности</Link></li>
                <li><Link href="/terms" className="hover:text-neutral-900 transition-colors">Публичная оферта</Link></li>
                <li><a href="mailto:support@aicreative.kz" className="hover:text-neutral-900 transition-colors">support@aicreative.kz</a></li>
                <li><a href="https://t.me/aicreative_support" target="_blank" rel="noreferrer" className="hover:text-neutral-900 transition-colors">Telegram-поддержка</a></li>
              </ul>
            </div>
          </div>

          {/* Legal requisites row */}
          <div className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-neutral-500">
            <div>
              {/* TODO: заменить на реальные реквизиты ТОО/ИП. Без них Kaspi/банк не подключат эквайринг, налоговая может придраться. */}
              © {new Date().getFullYear()} ТОО «[НАИМЕНОВАНИЕ]», БИН [ХХХХХХХХХХХХ], г. [ГОРОД], [АДРЕС]. Все права защищены.
            </div>
            <div>AICreative.kz</div>
          </div>
        </div>
      </footer>

      {/* STICKY MOBILE CTA */}
      {!isSignedIn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-neutral-200 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <SignInButton mode="modal">
            <button className="w-full bg-hermes-500 hover:bg-hermes-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-hermes-500/30 transition-colors">
              Начать бесплатно
              <Sparkles className="w-4 h-4" />
            </button>
          </SignInButton>
        </div>
      )}
    </main>
  );
}
