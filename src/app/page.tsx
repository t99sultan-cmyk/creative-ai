"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { 
  Sparkles, Play, Image as ImageIcon, Zap, Target, 
  BarChart3, CheckCircle2, ChevronDown, Star, 
  MessageSquare, Menu, X, MousePointerClick, Download, 
  ArrowRight, Rocket, Crown, Gift, Quote,
  DollarSign, Smartphone, Video, Check, RefreshCw, Building2
} from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

// --- DATA ---
const transformations = [
  { id: 1, name: "Автосалон", style: "Lead Gen / Тест-драйв", time: "45 сек", ctr: "+82%", imgRaw: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", imgGen: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", videoGen: "/auto.mp4" },
  { id: 2, name: "Стоматология", style: "Trust / Скидка на брекеты", time: "52 сек", ctr: "+67%", imgRaw: "https://images.unsplash.com/photo-1598256989728-66236b28eb99?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", imgGen: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", videoGen: "/zub.mp4" },
  { id: 3, name: "Фитнес-студия", style: "Dynamic / Бесплатная тренировка", time: "58 сек", ctr: "+55%", imgRaw: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", imgGen: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", videoGen: "/fitnes.mp4" },
];

const pricingTiers = [
  { name: "Старт", desc: "На 1–3 ниши", price: "~1 990 ₸", impulses: 60, features: ["~15 статичных креативов", "ИЛИ ~11 анимированных", "Высокое качество 4K", "Без водяных знаков"], btn: "Начать со Старта", action: "buy" },
  { name: "Креатор", desc: "Для малого бизнеса", price: "~4 980 ₸", impulses: 150, features: ["~42 статичных креатива", "ИЛИ ~31 анимированных", "Удаление фона", "Все форматы (9:16, 1:1)"], btn: "Выбрать Креатор", action: "buy" },
  { name: "Студия", desc: "ХИТ. A/B тесты", isHit: true, price: "~14 980 ₸", impulses: 453, features: ["~151 статичных креативов", "ИЛИ ~113 анимированных", "Студийный свет и тени", "Приоритет в очереди"], btn: "Купить Студию", action: "buy" },
  { name: "Бизнес", desc: "Для мощных агентств", price: "~49 980 ₸", impulses: 1900, features: ["~633 статичных креативов", "ИЛИ ~474 анимированных", "Управление командой", "Единый бренд-стиль"], btn: "Купить Бизнес", action: "buy" }
];

const faqs = [
  { q: "Для каких платформ подходят креативы AICreative?", a: "Мы создаём креативы специально для Instagram, TikTok и YouTube Shorts (формат 9:16). Статичные креативы отлично работают в ленте Instagram и Kaspi (формат 1:1)." },
  { q: "Сколько Импульсов дают бесплатно при регистрации?", a: "Вы получаете 7 Импульсов. Этого хватит, чтобы сделать 1 статичный + 1 анимированный креатив абсолютно бесплатно и без привязки карты." },
  { q: "Можно ли генерировать в едином бренд-стиле всей линейки товаров?", a: "Да! Выбирайте один промпт-стиль — ИИ будет сохранять единый визуальный язык (цвета, освещение, настроение). Отлично подходит для создания цельной концепции магазина." },
  { q: "Что если результат мне не понравится?", a: "На старте вы можете менять промпты бесплатно. При покупке мы дарим +20 импульсов, чтобы у вас был свободный буфер на творческие эксперименты." },
  { q: "Нужно ли уметь дизайнить или снимать видео?", a: "Нет. Достаточно обычного фото товара (даже снятое на телефон на складе). ИИ сам превращает его в профессиональный продающий креатив за 60 секунд." },
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
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans overflow-x-hidden selection:bg-hermes-500/30">
      {/* BACKGROUND GLOWS */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-400/20 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute top-[30%] right-[-10%] w-[40%] h-[60%] bg-hermes-500/15 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] bg-yellow-400/20 blur-[150px] rounded-full mix-blend-screen" />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-neutral-50/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hermes-500 to-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
               <Sparkles className="w-5 h-5 text-neutral-900" />
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
                 <Link href="/editor" className="text-sm font-bold text-neutral-900 bg-neutral-100 border-neutral-200 hover:bg-neutral-200 border-neutral-300 px-4 py-2 rounded-full border border-neutral-200 backdrop-blur-md transition-all">
                   В студию
                 </Link>
                 <UserButton afterSignOutUrl="/" />
               </div>
            ) : (
               <>
                 <SignInButton mode="modal">
                   <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Войти</button>
                 </SignInButton>
                 <SignInButton mode="modal">
                   <button className="text-sm font-bold text-white bg-hermes-500 hover:bg-zinc-200 px-5 py-2 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all">
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
                  className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-neutral-900 to-neutral-600"
               >
                 ИИ делает продающие креативы за <span className="inline-block animate-[bounce_2s_infinite] text-transparent bg-clip-text bg-gradient-to-r from-hermes-600 to-amber-500">60 секунд.</span><br/>
                 <span className="text-4xl md:text-5xl lg:text-6xl text-neutral-900">Без дизайнера. Без съёмок.</span>
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
                        <button className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-hermes-500 text-white shadow-hermes-500/30 font-bold font-bold text-lg px-8 py-4 rounded-2xl overflow-hidden hover:scale-105 transition-all shadow-xl shadow-hermes-500/20">
                           Перейти в редактор
                           <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                           <div className="absolute inset-0 bg-white/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                     </Link>
                  ) : (
                     <SignInButton mode="modal">
                        <button className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-hermes-500 text-white shadow-hermes-500/30 font-bold font-bold text-lg px-8 py-4 rounded-2xl overflow-hidden hover:scale-105 transition-all shadow-xl shadow-hermes-500/20">
                           Создать первый креатив бесплатно
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
                     <div className="text-3xl font-black text-neutral-900">2400+</div>
                     <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">Креативов<br/>за неделю</div>
                  </div>
                  <div>
                     <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-hermes-600">+47%</div>
                     <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">Рост CTR<br/>в среднем</div>
                  </div>
                  <div>
                     <div className="text-3xl font-black text-neutral-900">58<span className="text-xl">с</span></div>
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
               <img src="/hero_visual_light.png" alt="AI Generated Graphic Interface" className="relative z-10 w-full h-auto drop-shadow-[0_0_50px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-transform duration-700" />
            </motion.div>
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
                              {/* Если есть видео — показываем только видео (без заставки "ДО") */}
                              {t.videoGen ? (
                                 <video src={t.videoGen} className="absolute inset-0 w-full h-full object-contain opacity-100" autoPlay loop muted playsInline />
                              ) : (
                                 <>
                                    <img src={t.imgRaw} alt="Before" className="absolute inset-0 w-full h-full object-contain opacity-100 group-hover:opacity-0 transition-all duration-700 grayscale group-hover:grayscale-0" />
                                    <img src={t.imgGen} alt="After" className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                 </>
                              )}
                              
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                                 <div className="flex items-center justify-between">
                                    <div>
                                       <div className="text-xs text-hermes-400 font-bold mb-1 tracking-wide uppercase">Гипотеза: {t.style}</div>
                                       <div className="text-xl font-bold text-white">{t.name}</div>
                                    </div>
                                    <button className="w-10 h-10 bg-hermes-500 text-white shadow-hermes-500/30 font-bold rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0">
                                       <Play fill="currentColor" className="w-4 h-4 ml-0.5" />
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Bottom Stats */}
                        <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-neutral-200 bg-neutral-50">
                           <div className="p-4 text-center">
                              <div className="text-xs text-neutral-500 uppercase">CTR</div>
                              <div className="font-bold text-green-400 text-lg">{t.ctr}</div>
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
                     <div className="bg-neutral-50 border-neutral-100 border border-neutral-200 rounded-2xl p-6 hover:bg-neutral-100 border-neutral-200 transition-colors h-full flex flex-col">
                        <div className="w-12 h-12 bg-white shadow-xl rounded-xl border border-neutral-100 flex items-center justify-center mb-6 text-neutral-600">
                           <item.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-3">{item.title}</h3>
                        <p className="text-neutral-600 text-sm leading-relaxed mb-6 flex-grow">{item.text}</p>
                        <div className="mt-auto px-3 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold rounded-lg self-start">
                           {item.stat}
                        </div>
                     </div>
                  </Reveal>
               ))}
            </div>
         </div>
      </section>

      {/* HOW IT WORKS (STEPS) */}
      <section id="how" className="py-24 relative border-y border-neutral-100 bg-white shadow-xl/30">
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
                        <img src="/avatar_m.png" alt="User" className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
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
                           <div className="text-2xl font-bold text-green-400">-60%</div>
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
                        <img src="/avatar_f.png" alt="User" className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
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
                           <div className="text-2xl font-bold text-green-400">-75%</div>
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
                     <div className={clsx(
                        "relative bg-white shadow-xl rounded-3xl p-8 border flex flex-col h-full hover:-translate-y-2 transition-all duration-300",
                        tier.isHit ? "border-hermes-500 shadow-[0_0_30px_rgba(6,182,212,0.15)]" : "border-neutral-200 hover:border-neutral-300"
                     )}>
                        {tier.isHit && (
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-hermes-500 text-black text-xs font-black uppercase tracking-wider py-1 px-3 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3" /> Хит продаж
                           </div>
                        )}
                        {tier.bonus && (
                           <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 text-xs font-bold py-1 px-2 rounded-lg border border-green-500/20">
                              {tier.bonus}
                           </div>
                        )}
                        
                        <div className="mb-2 text-neutral-600 text-sm font-medium uppercase tracking-widest">{tier.name}</div>
                        <div className="text-4xl font-extrabold text-neutral-900 mb-2">{tier.price}</div>
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

                        <SignInButton mode="modal">
                           <button className={clsx(
                              "w-full py-4 rounded-xl font-bold text-sm transition-all",
                              tier.isHit 
                                 ? "bg-gradient-to-r from-hermes-500 to-amber-500 text-neutral-900 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:opacity-90"
                                 : "bg-neutral-100 border-neutral-200 text-neutral-900 hover:bg-neutral-200 border-neutral-300"
                           )}>
                              {tier.btn}
                           </button>
                        </SignInButton>
                     </div>
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
                <a href="https://t.me/aicreative_support" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#2AABEE] text-neutral-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                   <MessageSquare className="w-5 h-5" /> Задать вопрос в Telegram
                </a>
             </div>
          </Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 md:py-40 relative overflow-hidden bg-hermes-500">
         <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/50 to-transparent" />
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
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-neutral-500 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-hermes-500" />
            <span className="font-bold text-neutral-900 text-lg">AICreative</span>
          </div>
          <div>© {new Date().getFullYear()} AICreative.kz. Все права защищены.</div>
          <div className="flex gap-4">
             <a href="#" className="hover:text-neutral-900 transition-colors">Политика конфеденциальности</a>
             <a href="#" className="hover:text-neutral-900 transition-colors">Оферта</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
