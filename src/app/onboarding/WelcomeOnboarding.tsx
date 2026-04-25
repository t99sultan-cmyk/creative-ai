"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Phone,
  ArrowRight,
  PartyPopper,
  Image as ImageIcon,
  Pencil,
  Palette,
  Zap,
  Smartphone,
  Laptop,
  Check,
  Clock,
  Download,
  Send,
  MessageCircle,
  Link as LinkIcon,
  AlertCircle,
  Gift,
  ChevronDown,
} from "lucide-react";
import { savePhone } from "@/actions/savePhone";
import { DeadlineBanner } from "@/components/DeadlineBanner";
import { Confetti } from "@/components/Confetti";

/**
 * One-shot post-signup welcome screen.
 *
 * Mounted only when /onboarding page.tsx determines `welcomeShown` is
 * still false. On successful phone submit, savePhone flips the flag so
 * this component never renders again for this account.
 *
 * The two CTAs differ only in where they send the user:
 *   - "Создать первый креатив" → /editor (main CTA)
 *   - "Позже, зайду с ноутбука" → /account (escape hatch for mobile users
 *     who want to continue later on desktop; they still see their balance)
 * Both still require a valid phone number — it's the only signup-time
 * signal the support team has for out-of-band contact.
 */
export function WelcomeOnboarding() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [destination, setDestination] = useState<"editor" | "account">("editor");
  const [copied, setCopied] = useState(false);
  const [phoneFlash, setPhoneFlash] = useState(false);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const isPhoneFilled = phone.trim().length > 0;

  function focusPhoneAndScroll() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      phoneRef.current?.focus({ preventScroll: true });
      setPhoneFlash(true);
      setTimeout(() => setPhoneFlash(false), 1500);
    }, 350);
  }

  const siteUrl = "https://aicreative.kz";
  // Our public support contacts. Same values as /checkout — when we move
  // them into env vars, update both in one go.
  const WA_NUMBER_E164 = "77765282788"; // +7 776 528 27 88
  const TG_USERNAME = "ai_creativekz"; // t.me/ai_creativekz
  const greeting = "Привет! Я только что зарегистрировался на AICreative 🎉";
  const waHref = `https://wa.me/${WA_NUMBER_E164}?text=${encodeURIComponent(greeting)}`;
  const tgHref = `https://t.me/${TG_USERNAME}?text=${encodeURIComponent(greeting)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (old Safari, insecure origin) — fall back
      // to a visible prompt so the user can copy manually.
      window.prompt("Скопируй ссылку:", siteUrl);
    }
  }

  // Both CTAs ("Создать первый креатив" and "Позже, зайду с ноутбука")
  // route to /editor — that's where the user can actually do something.
  // The "later" copy is a marketing nudge for desktop, not a different
  // destination. `target` is kept only so the spinner shows on the
  // pressed button, not both.
  function submit(target: "editor" | "account") {
    setError("");
    setDestination(target);
    startTransition(async () => {
      const result = await savePhone(phone, telegram);
      if (result.success) {
        router.push("/editor");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 relative overflow-x-hidden pb-24 md:pb-0">
      {/* ambient background glows */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-hermes-600/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[0%] left-[30%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* brand header */}
      <header className="relative z-10 px-6 py-6 pt-10 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">
            AICreative
          </span>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-xl mx-auto px-5 pb-12">
        {/* ---------------- HERO ---------------- */}
        <section className="relative text-center pt-4 pb-10">
          {/* celebratory confetti (auto-stops after ~4.5s) */}
          <Confetti pieces={70} durationMs={5000} />

          {/* radial glow behind the whole hero */}
          <div className="absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(ellipse_at_center_top,rgba(243,112,33,0.35),transparent_70%)] pointer-events-none -z-10" />

          <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-hermes-500/20 to-amber-500/20 border border-hermes-500/40 text-hermes-200 text-xs font-semibold mb-5 animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
            <PartyPopper className="w-4 h-4" />
            Регистрация завершена
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-hermes-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-hermes-400" />
          </div>

          <h1 className="text-[30px] md:text-5xl font-black text-white tracking-tight leading-[1.05] mb-5 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            Поздравляем!
          </h1>

          {/* Giant "7" + label below — impossible to miss. Count-up + scale
              entrance for extra celebration. */}
          <div className="relative mb-5 flex flex-col items-center animate-in fade-in zoom-in-90 duration-700 delay-200 fill-mode-both">
            <div className="relative">
              {/* halo */}
              <div className="absolute inset-0 bg-gradient-to-br from-hermes-400 to-amber-400 blur-3xl opacity-40 scale-110 pointer-events-none" />
              <div className="relative flex items-baseline gap-0">
                <span
                  className="text-[120px] md:text-[160px] font-black leading-none bg-gradient-to-br from-hermes-300 via-amber-300 to-hermes-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,168,110,0.35)]"
                  style={{ WebkitTextStroke: "0.5px rgba(255,255,255,0.15)" }}
                >
                  <CountUp target={7} durationMs={1000} />
                </span>
                <span className="ml-2 text-2xl md:text-3xl">
                  <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-amber-300 animate-pulse" />
                </span>
              </div>
            </div>
            <p className="text-lg md:text-2xl font-extrabold text-white tracking-tight mt-1">
              Импульсов в подарок
            </p>
            <p className="text-[13px] md:text-sm text-hermes-200 font-semibold mt-1">
              Зачислены на баланс · действительны сегодня
            </p>
          </div>

          <p className="relative text-neutral-300 text-base md:text-lg font-medium leading-relaxed max-w-md mx-auto animate-in fade-in duration-700 delay-500 fill-mode-both">
            Этого хватит, чтобы бесплатно сделать{" "}
            <strong className="text-white">1 статичный</strong> и{" "}
            <strong className="text-white">1 анимированный</strong> креатив.
            Потрать их прямо сейчас и посмотри, на что способен ИИ.
          </p>

          {/* quick stats chips */}
          <div className="relative flex flex-wrap items-center justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-700 fill-mode-both">
            <Chip icon={<Clock className="w-3.5 h-3.5" />} label="60 секунд" />
            <Chip icon={<Check className="w-3.5 h-3.5" />} label="Без дизайнера" />
            <Chip icon={<Zap className="w-3.5 h-3.5" />} label="Качество 4K" />
          </div>
        </section>

        {/* ---------------- DEADLINE BANNER ---------------- */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-[850ms] fill-mode-both">
          <DeadlineBanner variant="hero-card" />
        </section>

        {/* ---------------- EXAMPLES (live autoplay) ---------------- */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider mb-3 text-center opacity-80">
            Вот что ты сможешь создать
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            <VideoTile src="/auto.mp4" label="Авто" />
            <VideoTile src="/fitnes.mp4" label="Фитнес" />
            <VideoTile src="/zub.mp4" label="Услуги" />
          </div>
          <p className="text-neutral-500 text-xs text-center mt-3">
            Все эти креативы сделаны ИИ из одного фото + короткого описания
          </p>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider mb-4 text-center opacity-80">
            Как это работает
          </h2>
          <div className="space-y-2.5">
            <HowStep
              num={1}
              icon={<ImageIcon className="w-5 h-5" />}
              title="Загрузи фото товара или услуги"
              desc="Продукт, упаковка, блюдо, оборудование, интерьер салона — что угодно, о чём хочешь рассказать. Снимок со смартфона подойдёт: ИИ сам уберёт лишнее и доведёт до рекламного качества."
            />
            <HowStep
              num={2}
              icon={<Pencil className="w-5 h-5" />}
              title="Опиши идею одной фразой"
              desc="«Яркая реклама кофейни для Reels», «Скидка 50% на стоматологию», «Запуск нового курса английского». Чем конкретнее про целевую аудиторию и оффер — тем точнее попадёт в запрос."
            />
            <HowStep
              num={3}
              icon={<Palette className="w-5 h-5" />}
              title="Выбери формат и стиль"
              desc="9:16 для Stories и Reels, 1:1 для Instagram-ленты, 16:9 для YouTube и Facebook. Можно добавить референс — картинку стиля, под который ИИ соберёт креатив."
            />
            <HowStep
              num={4}
              icon={<Download className="w-5 h-5" />}
              title="Скачай и запусти в рекламу"
              desc="Через 60 секунд — готовый файл PNG или MP4 в 4K без водяных знаков. Подходит для Meta Ads, TikTok, Яндекс.Директ и Kaspi-рекламы."
            />
          </div>
        </section>

        {/* ---------------- FEATURES ---------------- */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[400ms] fill-mode-both">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider mb-4 text-center opacity-80">
            Что ты получишь
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Feature text="Статичные и анимированные креативы" />
            <Feature text="3 формата: 9:16, 1:1, 16:9" />
            <Feature text="Автоудаление фона и артефактов" />
            <Feature text="4K качество без водяных знаков" />
            <Feature text="Библиотека стилей и шаблонов" />
            <Feature text="Все креативы хранятся в профиле" />
          </div>
        </section>

        {/* ---------------- DEVICES ---------------- */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider mb-4 text-center opacity-80">
            Работает на любом устройстве
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <DeviceCard
              icon={<Smartphone className="w-6 h-6" />}
              title="Смартфон"
              lines={["Быстро попробовать", "Загрузка фото с камеры"]}
              tone="subtle"
            />
            <DeviceCard
              icon={<Laptop className="w-6 h-6" />}
              title="Ноутбук / ПК"
              lines={["Крупный экран", "Удобнее для работы"]}
              tone="accent"
              badge="Рекомендуем"
            />
          </div>
        </section>

        {/* ---------------- PHONE + CTA ---------------- */}
        <section
          ref={formRef}
          id="welcome-form"
          className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-[650ms] fill-mode-both scroll-mt-6"
        >
          <div className="relative bg-white rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/40 ring-2 ring-hermes-500/30">
            {/* "почти готово" progress strip */}
            <div className="absolute -top-px left-6 right-6 h-1 rounded-full bg-gradient-to-r from-hermes-500 via-amber-400 to-hermes-500" />

            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-hermes-500/10 text-hermes-700 text-[11px] font-black uppercase tracking-wider mb-3">
                <Gift className="w-3.5 h-3.5" />
                Шаг 1 из 1 — почти готово
              </div>
              <h3 className="text-neutral-900 text-xl md:text-2xl font-black leading-tight">
                Последний шаг — забери бонус
              </h3>
              <p className="text-neutral-600 text-sm font-medium mt-2 max-w-sm mx-auto">
                Введи номер, чтобы{" "}
                <strong className="text-hermes-600">7 Импульсов</strong>{" "}
                появились на балансе. Без номера кнопка не сработает.
              </p>
            </div>

            <label
              htmlFor="phone"
              className="flex items-center justify-between text-[11px] font-bold text-neutral-700 mb-1.5 px-1"
            >
              <span>Телефон / WhatsApp</span>
              <span className="text-red-500 font-black uppercase tracking-wider">
                обязательно
              </span>
            </label>
            <div
              className={`relative mb-3 transition-all ${
                phoneFlash ? "animate-[ping_0.7s_ease-out_2]" : ""
              }`}
            >
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                id="phone"
                ref={phoneRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (777) 123-45-67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full rounded-2xl border-2 py-3.5 pl-12 pr-4 bg-neutral-50 text-neutral-900 outline-none transition-all font-medium ${
                  phoneFlash
                    ? "border-red-500 ring-4 ring-red-500/20"
                    : "border-neutral-200 focus:border-hermes-500 focus:ring-4 focus:ring-hermes-500/15"
                }`}
                required
              />
            </div>

            <label
              htmlFor="telegram"
              className="flex items-center justify-between text-[11px] font-bold text-neutral-700 mb-1.5 px-1"
            >
              <span>Telegram (если есть)</span>
              <span className="text-neutral-400 font-semibold">по желанию</span>
            </label>
            <div className="relative mb-3">
              <Send className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                id="telegram"
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@username"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 focus:border-hermes-500 focus:ring-4 focus:ring-hermes-500/15 py-3.5 pl-12 pr-4 bg-neutral-50 text-neutral-900 outline-none transition-all font-medium"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium mb-3 text-center">
                {error}
              </p>
            )}

            {!isPhoneFilled && (
              <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold animate-in fade-in slide-in-from-top-1 duration-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Заполни номер выше — без него кнопки заблокированы и бонус
                  не зачислится.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                isPhoneFilled ? submit("editor") : focusPhoneAndScroll()
              }
              disabled={isPending}
              aria-disabled={!isPhoneFilled || isPending}
              className={`w-full rounded-2xl py-4 font-bold text-base md:text-lg transition-all flex items-center justify-center gap-2 mb-2.5 active:scale-[0.99] ${
                isPhoneFilled
                  ? "bg-gradient-to-r from-hermes-500 to-hermes-600 hover:from-hermes-600 hover:to-hermes-700 text-white shadow-lg shadow-hermes-500/30"
                  : "bg-neutral-200 text-neutral-500 cursor-pointer"
              }`}
            >
              {isPending && destination === "editor" ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPhoneFilled ? (
                <>
                  Создать первый креатив
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Сначала заполни номер
                  <ChevronDown className="w-5 h-5 animate-bounce" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                isPhoneFilled ? submit("account") : focusPhoneAndScroll()
              }
              disabled={isPending}
              className="w-full bg-white hover:bg-neutral-50 disabled:opacity-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-2xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {isPending && destination === "account" ? (
                <span className="inline-block w-4 h-4 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
              ) : (
                "Позже, зайду с ноутбука"
              )}
            </button>
          </div>

          {/* Greet-us block. One click opens a chat with our public WA or
              TG pre-filled with a hello — the user initiates the thread
              (so WA/TG ToS are fine), and our support side replies with
              a welcome message + a link they can't lose. Copy-link is a
              no-messenger fallback for users who want the URL in another
              channel (email to themselves, notes, etc.). */}
          <div className="mt-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-hermes-500/20 text-hermes-300 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">
                  Получи поздравление и ссылку
                </p>
                <p className="text-neutral-400 text-[11px] leading-tight mt-0.5">
                  Напиши нам — пришлём ссылку на сайт и подскажем с первым
                  креативом
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-[11px] font-bold">WhatsApp</span>
              </a>
              <a
                href={tgHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 border border-[#2AABEE]/30 text-[#2AABEE] transition-colors"
              >
                <Send className="w-5 h-5" />
                <span className="text-[11px] font-bold">Telegram</span>
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-hermes-400" />
                ) : (
                  <LinkIcon className="w-5 h-5" />
                )}
                <span className="text-[11px] font-bold">
                  {copied ? "Готово" : "Скопировать"}
                </span>
              </button>
            </div>
          </div>

          <p className="text-neutral-500 text-xs text-center mt-5 flex items-center justify-center gap-1.5 px-4">
            <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
            На ноутбуке или компьютере работать удобнее — крупный экран и все
            инструменты под рукой
          </p>
        </section>
      </main>

      {/* Mobile-only sticky CTA. While the phone field is empty, tapping
          this scrolls + flashes the input so the user understands the
          form is the gate. Once filled, the same button submits and
          routes to /editor — same destination as the primary CTA. */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          type="button"
          onClick={() =>
            isPhoneFilled ? submit("editor") : focusPhoneAndScroll()
          }
          disabled={isPending}
          className={`w-full rounded-2xl py-3.5 font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-2xl ${
            isPhoneFilled
              ? "bg-gradient-to-r from-hermes-500 to-hermes-600 text-white shadow-hermes-500/40"
              : "bg-white text-neutral-800 ring-2 ring-hermes-500 shadow-black/40"
          }`}
        >
          {isPending && destination === "editor" ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPhoneFilled ? (
            <>
              Создать первый креатив
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <>
              <Gift className="w-5 h-5 text-hermes-500" />
              Заполни номер и забери 7 Импульсов
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Animated integer count-up from 0 → target over durationMs with ease-out. */
function CountUp({
  target,
  durationMs = 900,
}: {
  target: number;
  durationMs?: number;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return <>{value}</>;
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-200 text-xs font-semibold backdrop-blur-sm">
      {icon}
      {label}
    </span>
  );
}

function VideoTile({ src, label }: { src: string; label: string }) {
  return (
    <div className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-800 border border-white/10">
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      <span className="absolute bottom-2 left-2 text-white text-[11px] font-bold tracking-wide">
        {label}
      </span>
    </div>
  );
}

function HowStep({
  num,
  icon,
  title,
  desc,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-hermes-500/20 to-hermes-500/5 border border-hermes-500/30 text-hermes-300 flex items-center justify-center">
          {icon}
        </div>
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-hermes-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-neutral-950">
          {num}
        </span>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[15px] font-bold text-white leading-snug">{title}</p>
        <p className="text-[13px] text-neutral-400 mt-1 leading-snug">{desc}</p>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
      <Check className="w-4 h-4 text-hermes-400 flex-shrink-0 mt-0.5" />
      <span className="text-[13px] text-neutral-200 leading-snug font-medium">
        {text}
      </span>
    </div>
  );
}

function DeviceCard({
  icon,
  title,
  lines,
  tone,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  tone: "subtle" | "accent";
  badge?: string;
}) {
  const base =
    tone === "accent"
      ? "bg-gradient-to-br from-hermes-500/15 to-hermes-500/5 border-hermes-500/40"
      : "bg-white/5 border-white/10";
  const iconTone =
    tone === "accent"
      ? "bg-hermes-500/20 text-hermes-300"
      : "bg-white/10 text-neutral-300";

  return (
    <div
      className={`relative p-4 rounded-2xl border ${base} backdrop-blur-sm flex flex-col gap-2`}
    >
      {badge && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-hermes-500 text-white text-[10px] font-black tracking-wide">
          {badge}
        </span>
      )}
      <div
        className={`w-10 h-10 rounded-xl ${iconTone} flex items-center justify-center`}
      >
        {icon}
      </div>
      <p className="text-white text-sm font-bold leading-tight">{title}</p>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li
            key={l}
            className="text-[12px] text-neutral-400 flex items-center gap-1.5 leading-snug"
          >
            <Check className="w-3 h-3 text-hermes-400 flex-shrink-0" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
