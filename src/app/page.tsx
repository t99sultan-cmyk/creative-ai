"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Sparkles, Play, Image as ImageIcon, Zap, Target, BarChart3, TrendingUp, CheckCircle2, ChevronDown, Star, ShoppingBag, ShoppingCart, MessageSquare, Menu, X, LayoutDashboard, Upload, Eye, MousePointerClick, Download, ArrowRight, HelpCircle } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

// Dummy data for gallery (7 static + 7 animated)
const galleryItems = Array.from({ length: 14 }).map((_, i) => ({
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

const faqs = [
  { q: "Для каких платформ подходят креативы AICreative?", a: "Мы создаём креативы специально для Instagram, TikTok и YouTube Shorts. Анимированные креативы идеально подходят для Reels, Stories, TikTok и YouTube Shorts (формат 9:16). Статичные креативы отлично работают в ленте Instagram и Stories (формат 1:1 и 9:16). Готовые файлы можно сразу загружать в рекламу или органический контент." },
  { q: "Сколько Импульсов дают бесплатно при регистрации?", a: "Сразу после регистрации вы получаете 17 Импульсов бесплатно. Этого хватает, чтобы сделать 3 статичных + 2 анимированных креатива и полностью протестировать сервис. Карта не нужна." },
  { q: "В чём разница между статичным и анимированным креативом?", a: "Статичный — готовое изображение (идеально для ленты Instagram и Stories). Анимированный — короткая динамичная анимация (9:16), которая сильно повышает вовлечённость в Reels, TikTok и YouTube Shorts. 1 статичный креатив = 3 Импульса, 1 анимированный креатив = 4 Импульса." },
  { q: "Нужно ли уметь дизайнить или снимать видео?", a: "Нет. Достаточно обычного фото товара (даже снятое на телефон). ИИ сам превращает его в профессиональный продающий креатив за 60 секунд. Никаких навыков дизайна или монтажа не требуется." },
  { q: "Какие форматы фото можно загружать?", a: "Поддерживаются JPEG, PNG, WebP и HEIC (фото с iPhone). Для лучшего результата рекомендуем фото минимум 1024×1024 px." },
  { q: "Сколько времени занимает генерация?", a: "Статичный креатив — в среднем 50–70 секунд. Анимированный креатив — в среднем 80–110 секунд. Текущая скорость всегда отображается на главной странице." },
  { q: "Что такое Импульсы и как они тратятся?", a: "Импульсы — это ваша внутренняя валюта. Покупаете пакет один раз и тратите по мере создания креативов. Остаток всегда видно в личном кабинете. После окончания можно докупить Импульсы или взять следующий пакет." },
  { q: "Можно ли делать все креативы в едином стиле (для всей серии постов)?", a: "Да! Выбирайте один стиль — ИИ будет сохранять единый визуальный язык (цвета, освещение, настроение). Отлично подходит для создания цельной ленты Instagram или серии Reels." },
  { q: "Что делать, если закончились Импульсы?", a: "Можно в любой момент докупить дополнительные Импульсы по выгодной цене или перейти на больший пакет. В личном кабинете есть удобный калькулятор, который показывает, какой пакет будет самым выгодным именно для вас." },
  { q: "Подходят ли анимированные креативы для Reels, TikTok и YouTube Shorts?", a: "Да, идеально! Все анимированные креативы генерируются в вертикальном формате 9:16 — это готовый контент для Instagram Reels, TikTok и YouTube Shorts. Пользователи отмечают рост вовлечённости в 2–4 раза по сравнению со статичными постами." }
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  
  // States
  const [calcBudget, setCalcBudget] = useState<number>(14980);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<number | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'all'|'static'|'animated'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(90);
  const [priceCounter, setPriceCounter] = useState(290);

  useEffect(() => {
    let currentCount = 90;
    let currentPrice = 290;
    const interval = setInterval(() => {
      let changed = false;
      if (currentCount > 60) {
        currentCount -= 1;
        setCountdown(currentCount);
        changed = true;
      }
      if (currentPrice > 79) {
        currentPrice -= 5;
        if (currentPrice < 79) currentPrice = 79;
        setPriceCounter(currentPrice);
        changed = true;
      }
      if (!changed) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, []);

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
  
  const filteredGallery = galleryItems.filter(item => {
    if (galleryFilter === 'all') return true;
    if (galleryFilter === 'static') return !item.isAnimated;
    return item.isAnimated;
  });

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

  // Real Maths Calculation for Pricing
  const calcImpulses = Math.floor((calcBudget / 14980) * 453); // Using Studio as baseline: 14980 = 453 Impulses
  const countStatic = Math.floor(calcImpulses / 3);
  const countAnimated = Math.floor(calcImpulses / 4);

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-hermes-200">
      
      {/* Navigation */}
      <nav className="w-full p-4 lg:p-6 max-w-7xl mx-auto sticky top-0 bg-white/95 backdrop-blur-md z-[50] border-b border-neutral-100 transition-all flex items-center justify-between">
        <div className="flex items-center gap-2 relative z-[101]">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg lg:text-xl tracking-tight">AICreative.kz</span>
        </div>
        
        <div className="hidden lg:flex items-center gap-8 font-bold text-sm text-neutral-600">
          <a href="#how-it-works" className="hover:text-hermes-600 transition-colors">Как это работает</a>
          <a href="#gallery" className="hover:text-hermes-600 transition-colors">Примеры</a>
          <a href="#pricing" className="hover:text-hermes-600 transition-colors">Тарифы</a>
          <a href="#faq" className="hover:text-hermes-600 transition-colors">FAQ</a>
        </div>

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
                 <LayoutDashboard className="w-4 h-4" /> В редактор
              </Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 shadow-md" } }} />
            </div>
          )}
        </div>

        <button className="lg:hidden p-2 text-neutral-600 relative z-[101]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
        </button>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col pt-24 px-6 lg:hidden"
          >
             <div className="flex flex-col gap-6 text-2xl font-bold text-neutral-800 flex-1">
                <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>Как это работает</a>
                <a href="#gallery" onClick={() => setIsMobileMenuOpen(false)}>Примеры креативов</a>
                <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>Прайс-лист</a>
                <a href="#faq" onClick={() => setIsMobileMenuOpen(false)}>Вопросы и Ответы</a>
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
                    <LayoutDashboard className="w-5 h-5"/> Открыть Редактор
                  </Link>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-12 lg:pt-20 pb-16 lg:pb-32 overflow-hidden flex items-center lg:min-h-[90vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-hermes-100/60 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 lg:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10 relative">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-left w-full">
            <motion.h1 variants={fadeUp} className="text-[2.5rem] md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight mb-5 leading-[1.05]">
              Создай свой первый продающий <br className="hidden md:block" /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-hermes-500 to-[#d95e16] tabular-nums inline-block w-[300px] md:w-[480px]">
                креатив бесплатно за {countdown} сек
              </span>
            </motion.h1>
            
            <motion.h2 variants={fadeUp} className="text-lg md:text-2xl text-neutral-600 mb-8 font-medium leading-relaxed">
              Через искусственный интеллект. Без дизайнера и монтажа. Для Reels, TikTok, Instagram и YouTube Shorts
            </motion.h2>
            
            <motion.div variants={fadeUp} className="flex flex-col w-full max-w-2xl gap-4">
              <div className="flex flex-col xl:flex-row items-stretch gap-4">
                {!isSignedIn ? (
                  <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                    <button className="min-h-[64px] lg:min-h-[72px] flex-1 w-full flex items-center justify-center gap-2 px-4 shadow-[0_0_20px_rgba(217,94,22,0.4)] bg-gradient-to-r from-hermes-400 to-hermes-600 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(217,94,22,0.5)] active:scale-95 text-white font-black rounded-2xl md:rounded-[1.5rem] text-sm sm:text-lg lg:text-[1.1rem] transition-all">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-white animate-pulse shrink-0" />
                      Создать первый креатив бесплатно
                    </button>
                  </SignInButton>
                ) : (
                  <Link href="/editor" className="min-h-[64px] lg:min-h-[72px] flex-1 w-full flex items-center justify-center gap-2 px-4 shadow-[0_0_20px_rgba(217,94,22,0.4)] bg-gradient-to-r from-hermes-400 to-hermes-600 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(217,94,22,0.5)] active:scale-95 text-white font-black rounded-2xl md:rounded-[1.5rem] text-sm sm:text-lg lg:text-[1.1rem] transition-all">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-white animate-pulse shrink-0" />
                    Перейти к генерации
                  </Link>
                )}
                <a href="#gallery" className="min-h-[56px] lg:min-h-[72px] xl:w-auto px-6 lg:px-8 flex items-center justify-center font-bold rounded-2xl md:rounded-[1.5rem] text-sm sm:text-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all whitespace-nowrap">
                  Как это работает
                </a>
              </div>
              
              <div className="text-[11px] md:text-[13px] text-neutral-500 font-bold mt-2 text-center xl:text-left opacity-90 leading-relaxed border p-4 rounded-xl bg-neutral-50/50">
                При регистрации дарим 17 Импульсов<br/>
                <span className="text-hermes-500">→ 3 статичных + 2 анимированных креатива</span><br/>
                Без карты • Без обязательств • Отмена в один клик
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
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
                  <motion.div 
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-30 mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                     <Sparkles className="w-16 h-16 mb-4 hidden md:block animate-pulse fill-white text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                     <p className="font-black text-white text-sm md:text-xl uppercase drop-shadow-md tracking-wide">Неоновый<br/>Киберпанк<br/>Стиль</p>
                     <div className="mt-4 px-3 py-1 bg-white/20 border border-white/40 rounded backdrop-blur-md text-white text-[10px] md:text-xs tracking-widest uppercase animate-pulse font-bold">CTR +47%</div>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-white/10 text-white backdrop-blur-md text-[10px] md:text-xs font-bold px-3 py-1.5 border border-white/20 rounded-lg z-20">Стало через 60 сек</div>
               </div>
            </div>
            <motion.div animate={{ x: ["-10%", "100%", "-10%"] }} transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }} className="absolute inset-y-0 w-1 bg-white/80 shadow-[0_0_10px_white] z-20" />
          </motion.div>
        </div>
      </section>

      {/* Free Trial Hook Block */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-white to-neutral-50 border-b border-neutral-100 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-neutral-900 mb-6 tracking-tight">Попробуй бесплатно прямо сейчас</h2>
          <p className="text-lg md:text-xl text-neutral-600 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
            Бесплатно разработай свой первый продающий креатив за <span className="font-bold text-hermes-500 tabular-nums">{countdown} секунд</span>. ИИ сделает всю работу — тебе останется только скачать и запустить в рекламу.
          </p>
          
          <div className="flex flex-col items-center">
            {!isSignedIn ? (
              <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
                <button className="min-h-[64px] px-10 bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-black rounded-2xl md:rounded-[1.5rem] text-lg md:text-xl transition-all shadow-xl shadow-hermes-500/30 w-full sm:w-auto">
                  Начать создавать бесплатно
                </button>
              </SignInButton>
            ) : (
              <Link href="/editor" className="min-h-[64px] px-10 flex items-center justify-center bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-black rounded-2xl md:rounded-[1.5rem] text-lg md:text-xl transition-all shadow-xl shadow-hermes-500/30 w-full sm:w-auto">
                  Начать создавать бесплатно
              </Link>
            )}
            <div className="flex items-center gap-2 mt-6 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200 shadow-sm">
               <div className="flex -space-x-2 mr-2">
                 <img src="https://i.pravatar.cc/100?img=1" className="w-8 h-8 rounded-full border-2 border-white"/>
                 <img src="https://i.pravatar.cc/100?img=2" className="w-8 h-8 rounded-full border-2 border-white"/>
                 <img src="https://i.pravatar.cc/100?img=3" className="w-8 h-8 rounded-full border-2 border-white"/>
               </div>
               <p className="text-[11px] md:text-sm font-bold text-neutral-600">Уже более <strong className="text-hermes-500">2400 человек</strong> сделали свой первый креатив бесплатно за последнюю неделю</p>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Social Proof / Integration string */}
      <section className="py-6 bg-neutral-900 border-y border-neutral-800 overflow-hidden relative flex items-center">
         <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-neutral-900 to-transparent z-10" />
         <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-neutral-900 to-transparent z-10" />
         <motion.div 
            animate={{ x: [0, -1500] }}
            transition={{ duration: 25, ease: "linear", repeat: Infinity }}
            className="flex w-max gap-12 px-6"
         >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-12 text-white/50 font-bold md:text-xl whitespace-nowrap">
                <span className="hover:text-white transition-colors cursor-default">Kaspi</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">Wildberries</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">Ozon</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">Instagram</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">TikTok</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">YouTube</span>
                <span className="text-hermes-500/50">•</span>
                <span className="hover:text-white transition-colors cursor-default">Technodom</span>
              </div>
            ))}
         </motion.div>
      </section>

      {/* Gallery Section with Filters */}
      <section id="gallery" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Что генерирует наш ИИ</h2>
            <p className="text-neutral-500 md:text-lg">Мы специализируемся исключительно на коротких коммерческих баннерах и анимации.</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mb-12">
             <button onClick={() => setGalleryFilter('all')} className={clsx("px-5 py-2.5 rounded-full text-sm font-bold transition-all min-h-[48px]", galleryFilter === 'all' ? "bg-hermes-500 text-white shadow-md shadow-hermes-500/20" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>Все работы</button>
             <button onClick={() => setGalleryFilter('static')} className={clsx("px-5 py-2.5 rounded-full text-sm font-bold transition-all min-h-[48px]", galleryFilter === 'static' ? "bg-hermes-500 text-white shadow-md shadow-hermes-500/20" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>Статичные (1:1 / 9:16)</button>
             <button onClick={() => setGalleryFilter('animated')} className={clsx("px-5 py-2.5 rounded-full text-sm font-bold transition-all min-h-[48px]", galleryFilter === 'animated' ? "bg-hermes-500 text-white shadow-md shadow-hermes-500/20" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>Анимированные (Reels/TikTok)</button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredGallery.map((item) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}
                  key={item.id} 
                  onClick={() => setLightboxItem(item.id)}
                  className="group relative rounded-2xl overflow-hidden bg-neutral-100 aspect-[4/5] cursor-pointer"
                >
                  <div className="absolute top-2 left-2 z-10 hidden md:block">
                    <span className={clsx("px-2.5 py-1 text-[10px] font-bold rounded-lg shadow-sm backdrop-blur-md flex items-center gap-1", item.isAnimated ? "bg-black/80 text-white" : "bg-white/90 text-neutral-800")}>
                      {item.isAnimated ? <><Play className="w-3 h-3 fill-white" /> Видео (9:16)</> : <><ImageIcon className="w-3 h-3" /> Статика</>}
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 pointer-events-none p-3 lg:p-4 bg-gradient-to-t from-black/80 to-transparent z-10 flex text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs md:text-sm font-bold">{item.isAnimated ? 'Анимированный креатив (короткая анимация 9:16)' : 'Статичный креатив (лента/stories)'}</p>
                  </div>

                  <div className="absolute inset-0 flex">
                     <div className="w-1/2 bg-neutral-200 border-r border-white/50 flex items-center justify-center text-neutral-400 font-bold text-[10px] md:text-xs">Исходник</div>
                     <div className="w-1/2 bg-neutral-800 flex items-center justify-center text-white font-bold text-[10px] md:text-xs relative">
                       Готовый ИИ
                       <div className="absolute inset-0 bg-transparent group-hover:bg-white/10 transition-colors" />
                     </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {activeGalleryItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 lg:p-10" onClick={() => setLightboxItem(null)}>
             <button className="absolute top-6 right-6 lg:top-8 lg:right-10 text-white/50 hover:text-white transition-colors" onClick={() => setLightboxItem(null)}>
               <X className="w-8 h-8 lg:w-10 lg:h-10" />
             </button>
             
             <div className="w-full flex items-center justify-center gap-4 lg:gap-10 max-w-5xl h-[70vh] lg:h-[80vh] cursor-default" onClick={(e) => e.stopPropagation()}>
                {/* BEFORE */}
                <div className="w-1/2 h-full bg-neutral-800 rounded-3xl overflow-hidden relative flex flex-col items-center justify-center border border-white/10">
                  <span className="absolute top-3 right-3 bg-black/50 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-md">Обычное фото</span>
                  <ImageIcon className="w-16 h-16 text-white/20 mb-4" />
                  <p className="font-bold text-white/50">Исходник</p>
                </div>

                <ArrowRight className="w-8 h-8 text-white/30 hidden md:block shrink-0" />

                {/* AFTER */}
                <div className="w-1/2 h-full bg-hermes-600 rounded-3xl overflow-hidden relative flex flex-col items-center justify-center border-2 border-hermes-400 shadow-[0_0_50px_rgba(243,112,33,0.3)]">
                  <span className="absolute top-3 left-3 bg-hermes-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">Готовый креатив</span>
                  {activeGalleryItem.isAnimated && <Play className="w-20 h-20 text-white opacity-20 absolute" />}
                  <p className="font-black text-white text-2xl z-10 text-center drop-shadow-lg">Результат<br/>из AICreative</p>
                  
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                     <p className="text-white font-bold text-lg md:text-xl">
                       {activeGalleryItem.isAnimated ? 'Анимированный креатив' : 'Статичный креатив'}
                     </p>
                     <p className="text-white/70 text-sm mt-1">
                       {activeGalleryItem.isAnimated ? 'Короткая анимация для 9:16 (Не длинный монтаж!)' : 'Коммерческий баннер высокого разрешения'}
                     </p>
                  </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works Layout */}
      <section id="how-it-works" className="py-16 md:py-24 bg-neutral-50/50 border-t border-neutral-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Как работает приложение</h2>
            <p className="text-neutral-500 md:text-lg">Весь процесс генерации занимает пару кликов и около минуты времени.</p>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-[60px] left-[10%] right-[10%] h-0.5 bg-neutral-200" />
            <div className="grid lg:grid-cols-4 gap-8 lg:gap-4 relative z-10">
               {[
                 { i: <Upload className="w-6 h-6 text-hermes-600"/>, title: "Загрузи фото товара", desc: "Фото на белом фоне или с телефона прямо с производства." },
                 { i: <MousePointerClick className="w-6 h-6 text-hermes-600"/>, title: "Выбери стиль", desc: "Задай формат (статика / анимация) и выбери один из крутых промптов." },
                 { i: <Sparkles className="w-6 h-6 text-hermes-600"/>, title: "Готово за 60 секунд", desc: "Наш ИИ сам вырежет фон, построит сцену и наложит свет." },
                 { i: <Download className="w-6 h-6 text-hermes-600"/>, title: "Используй в рекламе", desc: "Скачивай готовый креатив и сразу загружай его в рекламный кабинет." }
               ].map((step, idx) => (
                 <div key={idx} className="flex flex-col items-center text-center">
                    <div className="w-[120px] h-[120px] rounded-full bg-white border-2 border-hermes-100 flex items-center justify-center shadow-lg shadow-hermes-500/5 mb-6 relative z-10">
                       <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-hermes-100 text-hermes-700 font-bold text-xs flex items-center justify-center">{idx + 1}</div>
                       {step.i}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-neutral-500 text-sm max-w-[250px]">{step.desc}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-16 md:py-24 bg-neutral-900 text-white border-b border-hermes-600/30">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Для кого подойдёт AICreative</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
             <div className="bg-neutral-800 rounded-3xl p-8 border border-neutral-700 hover:border-hermes-500/50 transition-colors">
               <ShoppingBag className="w-10 h-10 text-hermes-500 mb-6" />
               <h3 className="text-2xl font-bold mb-3">Селлеры Kaspi и Wildberries</h3>
               <p className="text-neutral-400">Вам нужно быстро обновить карточку или запустить акцию, а дизайнер просит от 5 000 ₸ за один креатив. Делайте это дешевле и быстрее.</p>
             </div>
             <div className="bg-neutral-800 rounded-3xl p-8 border border-neutral-700 hover:border-hermes-500/50 transition-colors">
               <Target className="w-10 h-10 text-hermes-500 mb-6" />
               <h3 className="text-2xl font-bold mb-3">Таргетологи и SMM</h3>
               <p className="text-neutral-400">Больше никаких задержек от дизайнеров перед заливом кампании. Генерируйте десятки вариантов для A/B тестов самостоятельно.</p>
             </div>
             <div className="bg-neutral-800 rounded-3xl p-8 border border-neutral-700 hover:border-hermes-500/50 transition-colors">
               <TrendingUp className="w-10 h-10 text-hermes-500 mb-6" />
               <h3 className="text-2xl font-bold mb-3">Локальные бренды</h3>
               <p className="text-neutral-400">Те, кто постоянно выпускает новые линейки товаров и хочет поддерживать крутой визуал в Instagram ленте каждый день.</p>
             </div>
             <div className="bg-neutral-800 rounded-3xl p-8 border border-neutral-700 hover:border-hermes-500/50 transition-colors">
               <Zap className="w-10 h-10 text-hermes-500 mb-6" />
               <h3 className="text-2xl font-bold mb-3">Все, кому нужен дизайн быстро</h3>
               <p className="text-neutral-400">Предприниматели и стартапы без бюджета на агентства. Мы заменяем целый отдел контента для ваших соцсетей.</p>
             </div>
          </div>
        </div>
      </section>

      {/* Pricing and Results */}
      <section id="pricing" className="py-16 md:py-24 bg-neutral-50/80">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Выгодные пакеты Импульсов ⚡</h2>
            <p className="text-neutral-500 md:text-lg mb-8">
              Каждый креатив стоит свою цену: 1 статика = 3 Импульса, 1 анимация = 4 Импульса.
            </p>

            <div className="max-w-xl mx-auto md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-neutral-200 md:p-8 text-left">
              <h4 className="font-bold md:text-xl mb-6 text-center">Сколько креативов я получу при бюджете...</h4>
              <input 
                type="range" min="1990" max="49980" step="1000" 
                value={calcBudget} 
                onChange={(e) => setCalcBudget(Number(e.target.value))}
                className="w-full accent-hermes-500 cursor-grab active:cursor-grabbing h-2 mb-6"
              />
              <div className="flex justify-between items-center text-sm mb-6 border-b border-neutral-100 pb-6">
                <span className="text-neutral-500">Ваш бюджет:</span>
                <span className="font-black text-2xl md:text-3xl text-hermes-600">{calcBudget.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="space-y-3">
                 <p className="text-sm text-neutral-600">На эту сумму вы получите <b>~{calcImpulses} Импульсов</b>. Это позволит сгенерировать:</p>
                 <div className="flex items-center gap-3 bg-hermes-50 text-hermes-800 p-4 rounded-xl border border-hermes-100 font-bold">
                   <ImageIcon className="w-5 h-5" /> До {countStatic} статичных креативов
                 </div>
                 <div className="flex items-center justify-center text-neutral-400 font-bold text-xs">ИЛИ</div>
                 <div className="flex items-center gap-3 bg-neutral-900 text-white p-4 rounded-xl font-bold">
                   <Play className="w-5 h-5 text-hermes-400" /> До {countAnimated} анимированных (9:16)
                 </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mt-12">
            {[ 
              { title: "Старт", price: "1 990", impulses: 45, info: "На 1–3 ниши" },
              { title: "Креатор", price: "4 980", impulses: 126, info: "Для малого бизнеса" },
              { title: "Студия", price: "14 980", impulses: 453, info: "ХИТ. A/B тесты", isPro: true },
              { title: "Бизнес", price: "49 980", impulses: 1899, info: "Для мощных агентств" }
            ].map((plan, i) => (
              <div key={i} className={clsx("p-6 md:p-8 rounded-[2rem] flex flex-col h-full relative group", plan.isPro ? "bg-neutral-900 text-white border-2 border-hermes-500 shadow-xl" : "bg-white border border-neutral-200")}>
                 {plan.isPro && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-hermes-400 to-hermes-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-lg shadow-hermes-500/30">Самый частый</div>}
                 <h3 className="text-xl font-bold mb-2">{plan.title}</h3>
                 <p className={clsx("text-sm mb-4 h-10", plan.isPro ? "text-neutral-400" : "text-neutral-500")}>{plan.info}</p>
                 <span className="text-3xl font-extrabold mb-4 block">{plan.price} ₸</span>
                 
                 <div className={clsx("text-center py-3 px-3 rounded-2xl border flex flex-col items-center justify-center mb-6", plan.isPro ? "bg-neutral-800 border-neutral-700/50 shadow-inner" : "bg-hermes-50 border-hermes-100")}>
                   <span className={clsx("text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1", plan.isPro ? 'text-white' : 'text-neutral-500')}>Вы получаете</span>
                   <span className={clsx("text-2xl font-black", plan.isPro ? 'text-hermes-400 drop-shadow-md' : 'text-hermes-600')}>{plan.impulses} <span className="text-sm">Импульсов ⚡</span></span>
                 </div>
                 
                 {!isSignedIn ? (
                   <SignInButton mode="modal" fallbackRedirectUrl={`/checkout?plan=${plan.title}&price=${plan.price}&impulses=${plan.impulses}`}>
                     <button className={clsx("relative overflow-hidden group min-h-[56px] w-full mb-6 rounded-2xl font-extrabold text-sm active:scale-95 transition-all text-white", plan.isPro ? "bg-gradient-to-r from-hermes-400 to-hermes-600 shadow-[0_0_20px_rgba(217,94,22,0.4)] animate-pulse hover:shadow-[0_0_30px_rgba(217,94,22,0.6)]" : "bg-neutral-900 hover:bg-neutral-800")}>
                       <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-12" />
                       Купить пакет "{plan.title}"
                     </button>
                   </SignInButton>
                 ) : (
                   <Link href={`/checkout?plan=${plan.title}&price=${plan.price}&impulses=${plan.impulses}`} className={clsx("relative overflow-hidden group flex items-center justify-center min-h-[56px] w-full mb-6 rounded-2xl font-extrabold text-sm active:scale-95 transition-all text-white", plan.isPro ? "bg-gradient-to-r from-hermes-400 to-hermes-600 shadow-[0_0_20px_rgba(217,94,22,0.4)] animate-pulse hover:shadow-[0_0_30px_rgba(217,94,22,0.6)]" : "bg-neutral-900 hover:bg-neutral-800")}>
                     <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-12" />
                     Купить пакет "{plan.title}"
                   </Link>
                 )}
                 
                 <div className={clsx("mt-auto p-4 rounded-xl", plan.isPro ? "bg-white/5" : "bg-neutral-50")}>
                   <p className="text-[10px] uppercase font-bold text-neutral-500 mb-3 text-center">Этого хватит на:</p>
                   <ul className="space-y-3">
                     <li className="flex items-center gap-3 text-sm"><ImageIcon className={clsx("w-4 h-4 shrink-0", plan.isPro ? "text-hermes-500" : "text-hermes-500")} /> <b className="text-lg">~{Math.floor(plan.impulses/3)}</b> статичных креативов</li>
                     <li className="flex items-center justify-center text-[10px] font-bold text-neutral-400 relative"><span className="bg-neutral-400 w-full h-[1px] absolute opacity-20"></span><span className={clsx("relative px-2", plan.isPro ? "bg-neutral-900" : "bg-neutral-50")}>ЛИБО</span></li>
                     <li className="flex items-center gap-3 text-sm"><Play className={clsx("w-4 h-4 shrink-0", plan.isPro ? "text-hermes-500" : "text-hermes-500")} /> <b className="text-lg">~{Math.floor(plan.impulses/4)}</b> анимированных креативов</li>
                   </ul>
                 </div>
              </div>
            ))}
          </div>

          <div className="mt-16 max-w-5xl mx-auto text-center bg-gradient-to-br from-neutral-900 to-[#120500] p-10 md:p-16 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-color-dodge"></div>
             <motion.div animate={{ rotate: 180 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -top-32 -left-32 w-64 h-64 bg-hermes-500/20 rounded-full blur-[100px]" />
             <Sparkles className="w-12 h-12 text-hermes-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(217,94,22,0.8)]" />
             <h3 className="text-2xl md:text-5xl font-black text-white mb-6 relative z-10 tracking-tight leading-tight">Мы стираем границы между идеей и финальным креативом</h3>
             <p className="text-neutral-400 text-sm md:text-xl max-w-3xl mx-auto leading-relaxed relative z-10 font-medium">
               Больше никаких мучительных согласований с дизайнерами и переплат за тесты. С AI Creative вы получаете премиальные анимации, сочные креативы и высочайший CTR прямо из браузера за несколько минут.
             </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 md:py-24 bg-white border-t border-neutral-100">
         <div className="max-w-3xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Часто задаваемые вопросы</h2>
              <p className="text-neutral-500 md:text-lg">Отвечаем на главные вопросы о работе бота и креативах.</p>
            </div>

            <div className="space-y-4 mb-12">
               {faqs.map((faq, i) => (
                  <div key={i} className="border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
                     <button 
                       className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                       onClick={() => setOpenFaq(openFaq === i ? null : i)}
                     >
                       <span className="font-bold text-neutral-800 pr-4 leading-snug lg:text-lg">{faq.q}</span>
                       <ChevronDown className={clsx("w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-300", openFaq === i && "rotate-180")} />
                     </button>
                     <AnimatePresence>
                       {openFaq === i && (
                         <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="p-5 md:p-6 pt-0 text-neutral-600 text-sm md:text-base leading-relaxed border-t border-neutral-100 mt-2">{faq.a}</div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
               ))}
            </div>

            <div className="text-center p-6 bg-hermes-50 rounded-2xl border border-hermes-100">
               <HelpCircle className="w-8 h-8 text-hermes-500 mx-auto mb-3" />
               <h4 className="font-bold text-lg mb-2">Не нашли свой ответ?</h4>
               <p className="text-sm text-neutral-600 mb-4">Наша служба поддержки с радостью проконсультирует вас в Telegram.</p>
               <a href="https://t.me/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 bg-white border border-neutral-200 shadow-sm rounded-xl font-bold text-sm hover:border-hermes-500 hover:text-hermes-600 transition-colors">
                 Написать в Telegram 💬
               </a>
            </div>
         </div>
      </section>

      {/* FINAL OFFER (CTA) */}
      <section className="py-20 bg-neutral-950 text-white relative overflow-hidden">
         {/* Background Ornaments */}
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/40 via-neutral-950 to-neutral-950" />
         <motion.div animate={{ rotate: -360 }} transition={{ duration: 150, repeat: Infinity, ease: "linear" }} className="absolute -top-[50%] -left-[10%] w-[100vw] h-[100vw] lg:w-[40vw] lg:h-[40vw] border-[1px] border-white/5 rounded-full" />
         <motion.div animate={{ rotate: 360 }} transition={{ duration: 100, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[50%] -right-[10%] w-[80vw] h-[80vw] lg:w-[30vw] lg:h-[30vw] border-[1px] border-white/5 rounded-full" />
         
         <div className="max-w-4xl mx-auto px-4 text-center relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-hermes-400 to-hermes-600 flex items-center justify-center shadow-lg shadow-hermes-500/30 mb-8 border border-white/10">
               <Zap className="w-8 h-8 text-white fill-white" />
            </div>
            
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
              Еще не готовы купить пакет?
            </h2>
            
            <p className="text-neutral-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
              Испытайте мощь ИИ прямо сейчас. Получите <span className="text-hermes-400 font-bold border-b border-hermes-500/50">17 Импульсов</span> абсолютно бесплатно и сгенерируйте свои первые креативы. 
              <br/><br/>
              <span className="text-white bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm shadow-inner text-sm border border-white/5 uppercase tracking-widest">
                💳 Без привязки карты. Без обязательств.
              </span>
            </p>
            
            <SignInButton mode="modal" fallbackRedirectUrl="/editor" signUpFallbackRedirectUrl="/editor">
               <button className="group relative min-h-[72px] px-10 bg-gradient-to-br from-hermes-500 to-[#d95e16] text-white font-black text-lg md:text-xl rounded-full shadow-[0_0_40px_rgba(243,112,33,0.4)] active:scale-95 transition-all w-full md:w-auto overflow-hidden">
                 <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 <span className="relative z-10 flex items-center justify-center gap-3">
                   ПОЛУЧИТЬ 17 ИМПУЛЬСОВ БЕСПЛАТНО <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                 </span>
               </button>
            </SignInButton>
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
             <p className="text-neutral-500 text-sm leading-relaxed">Платформа генерации рекламных креативов на основе ИИ. Для селлеров, таргетологов и локальных студий.</p>
           </div>
           
           <div>
              <h4 className="font-bold text-white mb-4">Продукт</h4>
              <div className="flex flex-col gap-2">
                 <a href="#how-it-works" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Как это работает</a>
                 <a href="#gallery" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Галерея креативов</a>
                 <a href="#pricing" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Пакеты Импульсов</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Абонентам</h4>
              <div className="flex flex-col gap-2">
                 <a href="#faq" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Вопросы и ответы (FAQ)</a>
                 <a href="#" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Политика безопасности</a>
                 <a href="#" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">Оферта</a>
              </div>
           </div>

           <div>
              <h4 className="font-bold text-white mb-4">Связь с нами</h4>
              <div className="flex flex-col gap-2">
                 <a href="https://t.me/" target="_blank" rel="noreferrer" className="hover:text-hermes-400 transition flex items-center gap-2 min-h-[32px]">
                   Телеграм Поддержка
                 </a>
                 <a href="mailto:support@aicreative.kz" className="hover:text-hermes-400 transition min-h-[32px] flex items-center">support@aicreative.kz</a>
                 <button className="min-h-[48px] w-full text-center bg-white/10 text-white rounded-lg font-bold mt-2 hover:bg-white/20 transition-colors">Для партнеров</button>
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
               <button className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold text-lg py-4 rounded-[1.25rem] shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-transform">
                  <Zap className="w-5 h-5 fill-white/20" /> Получить 17 Импульсов
               </button>
            </SignInButton>
          ) : (
            <Link href="/editor" className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-95 text-white font-extrabold text-lg py-4 rounded-[1.25rem] shadow-xl shadow-hermes-500/20 flex items-center justify-center gap-2 transition-transform">
               <Zap className="w-5 h-5 fill-white/20" /> Открыть в редакторе
            </Link>
          )}
      </div>
    </main>
  );
}
