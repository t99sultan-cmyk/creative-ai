"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Sparkles, ArrowRight, Upload, Wand2, Play, Image as ImageIcon, Zap, Target, BarChart3, TrendingUp, Key, XCircle, CheckCircle2, ChevronDown, Star, ShoppingBag, ShoppingCart, MessageSquare, Menu, X, LayoutDashboard } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

// Dummy data for gallery (6 static + 6 animated)
const galleryItems = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  isAnimated: i % 2 !== 0,
  before: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Товар+До",
  after: "https://placehold.co/400x500/101010/d95e16?text=Креатив+После"
}));

// Reviews
const reviews = [
  { name: "Амиржан Д.", role: "Таргетолог", text: "Раньше ждал креосы от дизов по 2 дня. Сейчас генерю 30 штук за час и сразу в тест." },
  { name: "Алина К.", role: "Владелец магазина", text: "Снизила стоимость клика в 3 раза, картинки просто космос, как из реальной студии." },
  { name: "Руслан М.", role: "SMM Студия", text: "Очень круто работает анимация. Клиенты в шоке, что мы стали отдавать ролики так быстро." },
  { name: "Мадина С.", role: "Селлер Kaspi", text: "Для карточек товаров самое то! Идеально вырезает фон и ставит на красивый подиум." },
  { name: "Ильяс О.", role: "Предприниматель", text: "Забыл, что такое искать фрилансера на Kwork. ИИ делает баннеры за 1 минуту." }
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [calcBudget, setCalcBudget] = useState<number>(14980);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<number | null>(null);

  const lockBodyScroll = (lock: boolean) => {
    if (typeof window !== "undefined") {
      document.body.style.overflow = lock ? "hidden" : "auto";
    }
  };

  useEffect(() => {
    lockBodyScroll(isMobileMenuOpen || lightboxItem !== null);
    return () => lockBodyScroll(false);
  }, [isMobileMenuOpen, lightboxItem]);

  const activeGalleryItem = lightboxItem !== null ? galleryItems.find(i => i.id === lightboxItem) : null;

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  } as any;
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  } as any;

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-hermes-200">
      
      {/* Navigation */}
      <nav className="w-full p-4 lg:p-6 max-w-7xl mx-auto sticky top-0 bg-white/95 backdrop-blur-md z-[50] border-b border-neutral-100 transition-all flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg lg:text-xl tracking-tight">AICreative.kz</span>
        </div>
        
        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8 font-bold text-sm text-neutral-600">
          <a href="#how-it-works" className="hover:text-hermes-600 transition-colors">Как это работает</a>
          <a href="#gallery" className="hover:text-hermes-600 transition-colors">Примеры</a>
          <a href="#pricing" className="hover:text-hermes-600 transition-colors">Тарифы</a>
        </div>

        {/* Desktop Auth */}
        <div className="hidden lg:flex items-center gap-3">
          {!isSignedIn ? (
             <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                <button className="min-h-[48px] px-6 text-sm font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl transition-all flex items-center">
                  Личный кабинет
                </button>
             </SignInButton>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/editor" className="min-h-[48px] px-6 text-sm font-bold bg-hermes-50 text-hermes-600 hover:bg-hermes-100 rounded-xl transition-all flex items-center gap-2">
                 <LayoutDashboard className="w-4 h-4" />
                 В редактор
              </Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 shadow-md" } }} />
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button className="lg:hidden p-2 text-neutral-600" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-7 h-7" />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col p-6 lg:hidden"
          >
             <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight">AICreative.kz</span>
                </div>
                <button className="p-2 bg-neutral-100 rounded-full text-neutral-600" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
             </div>

             <div className="flex flex-col gap-6 text-2xl font-bold text-neutral-800 flex-1">
                <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>Как это работает</a>
                <a href="#gallery" onClick={() => setIsMobileMenuOpen(false)}>Примеры креативов</a>
                <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>Прайс-лист</a>
             </div>

             <div className="pb-12">
                {!isSignedIn ? (
                  <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                    <button className="min-h-[60px] w-full text-lg font-bold bg-hermes-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-hermes-500/20 active:scale-95 transition-transform" onClick={() => setIsMobileMenuOpen(false)}>
                      Личный кабинет
                    </button>
                  </SignInButton>
                ) : (
                  <Link href="/editor" className="min-h-[60px] w-full text-lg font-bold bg-hermes-500 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-hermes-500/20 active:scale-95 transition-transform" onClick={() => setIsMobileMenuOpen(false)}>
                    <LayoutDashboard className="w-5 h-5"/>
                    Открыть Редактор
                  </Link>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-12 lg:pt-20 pb-16 lg:pb-32 overflow-hidden flex items-center min-h-[60vh] lg:min-h-[80vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-hermes-100/60 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 lg:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10 relative">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-left">
            
            <motion.h1 variants={fadeUp} className="text-[2.5rem] md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight mb-5 leading-[1.05]">
              Генерируй продающие <br className="hidden md:block" /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-500 to-[#d95e16]">
                креативы за 60 секунд
              </span>
            </motion.h1>
            
            <motion.h2 variants={fadeUp} className="text-lg md:text-2xl text-neutral-600 mb-8 font-medium">
              Без дизайнера. Без ожидания. От 79 ₸ за штуку.
            </motion.h2>
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              {!isSignedIn ? (
                <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                  <button className="min-h-[56px] lg:min-h-[64px] group w-full sm:w-auto flex items-center justify-center gap-2 px-8 bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold rounded-[1.25rem] text-lg transition-all shadow-xl shadow-hermes-500/20">
                    <Zap className="w-5 h-5 fill-white" />
                    Получить 17 Импульсов бесплатно
                  </button>
                </SignInButton>
              ) : (
                <Link href="/editor" className="min-h-[56px] lg:min-h-[64px] group w-full sm:w-auto flex items-center justify-center gap-2 px-8 bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold rounded-[1.25rem] text-lg transition-all shadow-xl shadow-hermes-500/20">
                  <Zap className="w-5 h-5 fill-white" />
                  Перейти к генерации
                </Link>
              )}
              <a href="#gallery" className="min-h-[56px] lg:min-h-[64px] w-full sm:w-auto flex items-center justify-center px-8 font-bold rounded-[1.25rem] text-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all">
                Посмотреть примеры
              </a>
            </motion.div>
          </motion.div>
          
          {/* Visual CSS Simulation Before/After */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full aspect-[4/5] lg:aspect-square bg-neutral-100 rounded-[2rem] border border-neutral-200 shadow-2xl overflow-hidden group"
          >
            <div className="absolute inset-0 flex">
               <div className="w-1/2 h-full bg-white relative overflow-hidden border-r border-neutral-200/50">
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-300">
                     <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                     <p className="font-bold uppercase tracking-widest text-xs">Товар на белом фоне</p>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-black/5 backdrop-blur-md text-neutral-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-black/5">Было</div>
               </div>
               <div className="w-1/2 h-full relative overflow-hidden bg-gradient-to-br from-hermes-600 via-hermes-500 to-purple-900">
                  {/* Cyberpunk CSS Effect Simulator */}
                  <motion.div 
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-30 mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                     <Sparkles className="w-16 h-16 mb-4 hidden md:block animate-pulse fill-white text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                     <p className="font-black text-white text-sm md:text-xl uppercase drop-shadow-md tracking-wide">Неоновый<br/>Киберпанк<br/>Стиль</p>
                     
                     <div className="mt-4 px-3 py-1 bg-white/20 border border-white/40 rounded backdrop-blur-md text-white text-[10px] md:text-xs tracking-widest uppercase animate-pulse font-bold">
                       CTR +47%
                     </div>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-white/10 text-white backdrop-blur-md text-[10px] md:text-xs font-bold px-3 py-1.5 border border-white/20 rounded-lg z-20">Стало через 60 сек</div>
               </div>
            </div>
            
            {/* The Before/After sweeping line simulator */}
            <motion.div 
              animate={{ x: ["-10%", "100%", "-10%"] }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
              className="absolute inset-y-0 w-1 bg-white/80 shadow-[0_0_10px_white] z-20"
            />
          </motion.div>
        </div>
      </section>

      {/* INFINITE MARQUEE BRANDS */}
      <section className="py-10 border-y border-neutral-100 overflow-hidden bg-neutral-50/50 flex">
        <div className="animate-marquee">
          {[1, 2].map((group) => (
             <div key={group} className="flex-1 flex justify-around items-center opacity-40 grayscale gap-12 px-6">
                <span className="text-xl md:text-3xl font-black tracking-tighter">KASPI.KZ</span>
                <span className="text-xl md:text-3xl font-black italic">Wildberries</span>
                <span className="text-xl md:text-3xl font-bold">OZON</span>
                <span className="text-xl md:text-3xl font-black drop-shadow-sm">META ADS</span>
                <span className="text-xl md:text-3xl font-extrabold tracking-tight">ARBUZ.KZ</span>
                <span className="text-xl md:text-3xl font-black">CHOCO</span>
             </div>
          ))}
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Что генерирует наш ИИ</h2>
            <p className="text-neutral-500 md:text-lg">Статичные баннеры и анимированные видео — 60 секунд</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {galleryItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setLightboxItem(item.id)}
                className="group relative rounded-2xl overflow-hidden bg-neutral-100 aspect-[4/5] cursor-pointer"
              >
                <div className="absolute top-2 left-2 z-10 hidden sm:block">
                  <span className={clsx(
                    "px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-lg shadow-sm backdrop-blur-md flex items-center gap-1",
                    item.isAnimated ? "bg-black/80 text-white" : "bg-white/90 text-neutral-800"
                  )}>
                    {item.isAnimated ? <><Play className="w-3 h-3 fill-white" /> Анимированный + Reels</> : <><ImageIcon className="w-3 h-3" /> Статичный</>}
                  </span>
                </div>

                <div className="absolute inset-0 flex">
                   <div className="w-1/2 bg-neutral-200 border-r border-white/50 flex items-center justify-center text-neutral-400 font-bold text-xs">До</div>
                   <div className="w-1/2 bg-neutral-800 flex items-center justify-center text-white font-bold text-xs relative">
                     После
                     <div className="absolute inset-0 bg-transparent group-hover:bg-hermes-500/20 transition-colors" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {activeGalleryItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
             <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors" onClick={() => setLightboxItem(null)}>
               <X className="w-8 h-8" />
             </button>
             
             <div className="relative bg-neutral-900 rounded-[2rem] w-full max-w-lg aspect-[4/5] overflow-hidden flex flex-col items-center justify-center text-white shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
                <span className="absolute top-4 left-4 bg-hermes-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  {activeGalleryItem.isAnimated ? 'Анимированный креатив + 9:16 Reels' : 'Статичный креатив'}
                </span>
                
                <div className="flex w-full h-full text-center">
                   <div className="w-1/2 h-full flex flex-col items-center justify-center border-r border-white/10 opacity-70">
                      <ImageIcon className="w-12 h-12 mb-3" />
                      <span className="font-bold">Исходник товара</span>
                   </div>
                   <div className="w-1/2 h-full flex flex-col items-center justify-center bg-gradient-to-b from-hermes-800 to-hermes-500 relative">
                     {activeGalleryItem.isAnimated && <Play className="absolute w-16 h-16 opacity-20 fill-white" />}
                     <Sparkles className="w-12 h-12 mb-3 fill-white text-white z-10" />
                     <span className="font-bold z-10">Готовый результат</span>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social Proof Blocks */}
      <section className="py-16 md:py-24 bg-white/50 border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-16 md:mb-24">
             <div className="bg-neutral-50 rounded-[2rem] p-6 lg:p-8 border border-neutral-100 text-center">
                <TrendingUp className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl lg:text-3xl font-black mb-2">+47% CTR</h4>
                <p className="text-neutral-500 text-sm">Увеличение кликабельности в таргете</p>
             </div>
             <div className="bg-neutral-50 rounded-[2rem] p-6 lg:p-8 border border-neutral-100 text-center">
                <BarChart3 className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl lg:text-3xl font-black mb-2">–6x дешевле</h4>
                <p className="text-neutral-500 text-sm">Стоимость создания одного креатива ниже дизов</p>
             </div>
             <div className="bg-neutral-50 rounded-[2rem] p-6 lg:p-8 border border-neutral-100 text-center">
                <Target className="w-10 h-10 text-hermes-500 mx-auto mb-4" />
                <h4 className="text-2xl lg:text-3xl font-black mb-2">15 минут</h4>
                <p className="text-neutral-500 text-sm">Вместо дней ожиданий. Вы полностью независимы.</p>
             </div>
          </div>

          <div className="text-center mb-8 md:mb-12">
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Результаты пользователей</h3>
          </div>
          
          {/* Horizontal scroll on mobile layout */}
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide px-4 lg:px-0 -mx-4 lg:mx-0 lg:grid lg:grid-cols-5">
            {reviews.map((rev, i) => (
              <div key={i} className="min-w-[280px] lg:min-w-0 snap-center bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex-shrink-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    <Star className="w-3.5 h-3.5 text-hermes-500 fill-hermes-500" />
                    <Star className="w-3.5 h-3.5 text-hermes-500 fill-hermes-500" />
                    <Star className="w-3.5 h-3.5 text-hermes-500 fill-hermes-500" />
                    <Star className="w-3.5 h-3.5 text-hermes-500 fill-hermes-500" />
                    <Star className="w-3.5 h-3.5 text-hermes-500 fill-hermes-500" />
                  </div>
                  <p className="text-neutral-700 text-sm mb-6 font-medium leading-relaxed">«{rev.text}»</p>
                </div>
                <div className="flex items-center gap-3 border-t border-neutral-100 pt-4 mt-auto">
                  <div className="w-10 h-10 rounded-full bg-neutral-200/60 font-bold flex items-center justify-center text-sm text-neutral-500">
                    {rev.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight">{rev.name}</h4>
                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">{rev.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24 bg-neutral-50/80">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Выгодные пакеты Импульсов ⚡</h2>
            <p className="text-neutral-500 md:text-lg mb-8">
              Внутренняя валюта прозрачна: 1 статика = 3 Импульса, 1 видео = 4 Импульса.
            </p>

            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
              <h4 className="font-bold md:text-lg mb-4">Сколько креативов я получу за ... ?</h4>
              <input 
                type="range" min="1990" max="49980" step="1000" 
                value={calcBudget} 
                onChange={(e) => setCalcBudget(Number(e.target.value))}
                className="w-full accent-hermes-500 mb-4"
              />
              <div className="flex justify-between items-center text-sm mb-4">
                <span className="font-bold text-lg md:text-xl">{calcBudget.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="p-4 bg-hermes-50 rounded-xl text-hermes-800 font-medium text-sm border border-hermes-100">
                Мощностей хватит на <b>~{Math.floor((calcBudget / 14980) * 151)}</b> статичных креативов без переплат дизайнерам.
              </div>
            </div>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mt-12">
            
            {/* Start Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 flex flex-col h-full">
              <h3 className="text-xl font-bold mb-2">Старт</h3>
              <p className="text-neutral-500 text-sm mb-4">На 1–3 товара.</p>
              <span className="text-3xl font-extrabold text-neutral-900 mb-4 block">1 990 ₸</span>
              <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold mb-6">
                <span>Баланс:</span><span className="text-hermes-600">45 ⚡</span>
              </div>
              <SignInButton mode="modal" fallbackRedirectUrl="/editor">
                <button className="min-h-[48px] w-full mb-6 bg-neutral-900 text-white rounded-xl font-bold text-sm">Выбрать</button>
              </SignInButton>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>15 статичных</b></li>
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>11 анимированных</b></li>
              </ul>
            </div>

            {/* Creator Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 flex flex-col h-full">
              <h3 className="text-xl font-bold mb-2">Креатор</h3>
              <p className="text-neutral-500 text-sm mb-4">Без команды.</p>
              <span className="text-3xl font-extrabold text-neutral-900 mb-4 block">4 980 ₸</span>
              <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold mb-6">
                <span>Баланс:</span><span className="text-hermes-600">126 ⚡</span>
              </div>
              <SignInButton mode="modal" fallbackRedirectUrl="/editor">
                <button className="min-h-[48px] w-full mb-6 bg-neutral-900 text-white rounded-xl font-bold text-sm">Выбрать</button>
              </SignInButton>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>42 статичных</b></li>
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>31 видео</b></li>
              </ul>
            </div>

            {/* Studio Plan */}
            <div className="bg-neutral-900 relative p-6 md:p-8 rounded-[2rem] flex flex-col h-full border-2 border-hermes-500 shadow-2xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase">Хит</div>
              <h3 className="text-xl font-bold mb-2 text-white mt-2">Студия</h3>
              <p className="text-neutral-400 text-sm mb-4">A/B тесты.</p>
              <span className="text-3xl font-extrabold text-white mb-4 block">14 980 ₸</span>
              <div className="py-2.5 px-3 bg-neutral-800 rounded-xl border border-neutral-700 flex items-center justify-between text-sm font-bold mb-6 text-white">
                <span>Баланс:</span><span className="text-hermes-400">453 ⚡</span>
              </div>
              <SignInButton mode="modal" fallbackRedirectUrl="/editor">
                <button className="min-h-[48px] w-full mb-6 bg-hermes-500 text-white rounded-xl font-bold text-sm hover:bg-hermes-600 active:scale-95 transition-all">Выбрать</button>
              </SignInButton>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-center gap-2 text-sm text-neutral-200"><CheckCircle2 className="w-4 h-4 text-hermes-500" /> До <b>151 статичного</b></li>
                <li className="flex items-center gap-2 text-sm text-neutral-200"><CheckCircle2 className="w-4 h-4 text-hermes-500" /> До <b>113 видео</b></li>
              </ul>
            </div>

            {/* Business Plan */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-200 flex flex-col h-full">
              <h3 className="text-xl font-bold mb-2">Бизнес</h3>
              <p className="text-neutral-500 text-sm mb-4">Для агентств.</p>
              <span className="text-3xl font-extrabold text-neutral-900 mb-4 block">49 980 ₸</span>
              <div className="py-2.5 px-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-sm font-bold mb-6">
                <span>Баланс:</span><span className="text-hermes-600">1 899 ⚡</span>
              </div>
              <SignInButton mode="modal" fallbackRedirectUrl="/editor">
                <button className="min-h-[48px] w-full mb-6 bg-neutral-900 text-white rounded-xl font-bold text-sm">Выбрать</button>
              </SignInButton>
              <ul className="space-y-3 mt-auto">
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>633 статичных</b></li>
                <li className="flex items-center gap-2 text-sm text-neutral-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> До <b>474 видео</b></li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 text-neutral-400 text-sm mb-[80px] lg:mb-0 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
           <div className="col-span-2 md:col-span-1">
             <div className="flex items-center gap-2 mb-4">
               <Sparkles className="w-5 h-5 text-hermes-500" />
               <span className="font-bold text-white text-lg tracking-tight">AICreative.kz</span>
             </div>
             <p className="text-neutral-500 text-xs">Платформа генерации рекламных креативов на основе ИИ. Для таргетологов, селлеров и студий.</p>
           </div>
           
           <div>
              <h4 className="font-bold text-white mb-4">Продукт</h4>
              <div className="flex flex-col gap-2">
                 <a href="#how-it-works" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Как это работает</a>
                 <a href="#gallery" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Примеры креативов</a>
                 <a href="#pricing" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Пакеты Импульсов</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Юридическое</h4>
              <div className="flex flex-col gap-2">
                 <a href="#" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Политика безопасности</a>
                 <a href="#" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Правила пользования (FAQ)</a>
                 <a href="#" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Оферта</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Связь с нами</h4>
              <div className="flex flex-col gap-2">
                 <a href="https://t.me/" target="_blank" rel="noreferrer" className="hover:text-hermes-400 transition flex items-center gap-2 min-h-[32px]">
                   Телеграм-поддержка
                 </a>
                 <a href="mailto:support@aicreative.kz" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">support@aicreative.kz</a>
                 <button className="min-h-[48px] w-full text-center bg-white/10 text-white rounded-lg font-bold mt-2 hover:bg-white/20 transition-colors">Сотрудничество</button>
              </div>
           </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center text-xs gap-4">
           <span>© {new Date().getFullYear()} AICreative.kz. Сделано в Казахстане 🇰🇿</span>
           <div className="flex gap-4">
             <span className="text-white">Kaspi</span>
             <span>Visa / Mastercard</span>
           </div>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-[40] safe-area-bottom pb-6">
         {!isSignedIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
               <button className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold text-lg py-4 rounded-[1.25rem] shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-all">
                  <Zap className="w-5 h-5 fill-white/20" /> Получить 17 Импульсов
               </button>
            </SignInButton>
          ) : (
            <Link href="/editor" className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold text-lg py-4 rounded-[1.25rem] shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-all">
               <Zap className="w-5 h-5 fill-white/20" /> Открыть в редакторе
            </Link>
          )}
      </div>
    </main>
  );
}
