"use client";

import { useState, useTransition, useEffect } from "react";
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
  Flame,
} from "lucide-react";
import { savePhone } from "@/actions/savePhone";

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

  function submit(target: "editor" | "account") {
    setError("");
    setDestination(target);
    startTransition(async () => {
      const result = await savePhone(phone, telegram);
      if (result.success) {
        router.push(target === "editor" ? "/editor" : "/account");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-x-hidden">
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
        <section className="text-center pt-4 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
          <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-hermes-500/20 to-amber-500/20 border border-hermes-500/40 text-hermes-200 text-xs font-semibold mb-5">
            <PartyPopper className="w-4 h-4" />
            Регистрация завершена
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-hermes-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-hermes-400" />
          </div>

          <h1 className="text-[32px] md:text-5xl font-black text-white tracking-tight leading-[1.05] mb-4">
            Поздравляем!
            <br />
            Тебе начислено{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-hermes-300 to-amber-300 bg-clip-text text-transparent">
                7 Импульсов
              </span>
              <span className="absolute inset-x-0 bottom-0 h-3 bg-hermes-500/30 rounded-md -z-0" />
            </span>
          </h1>

          <p className="text-neutral-300 text-base md:text-lg font-medium leading-relaxed max-w-md mx-auto">
            Этого хватит, чтобы бесплатно сделать{" "}
            <strong className="text-white">1 статичный</strong> и{" "}
            <strong className="text-white">1 анимированный</strong> креатив.
            Потрать их прямо сейчас и посмотри, на что способен ИИ.
          </p>

          {/* quick stats chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <Chip icon={<Clock className="w-3.5 h-3.5" />} label="60 секунд" />
            <Chip icon={<Check className="w-3.5 h-3.5" />} label="Без дизайнера" />
            <Chip icon={<Zap className="w-3.5 h-3.5" />} label="Качество 4K" />
          </div>
        </section>

        {/* ---------------- DEADLINE BANNER ---------------- */}
        <DeadlineBanner />

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
        <section className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-[650ms] fill-mode-both">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/40">
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-semibold mb-2">
                <Phone className="w-3 h-3" />
                Последний шаг
              </div>
              <h3 className="text-neutral-900 text-lg font-extrabold">
                Оставь контакты
              </h3>
              <p className="text-neutral-500 text-xs mt-1">
                Чтобы мы могли присылать материалы и подсказки по работе с сервисом
              </p>
            </div>

            <label
              htmlFor="phone"
              className="flex items-center justify-between text-[11px] font-bold text-neutral-700 mb-1.5 px-1"
            >
              <span>Телефон / WhatsApp</span>
              <span className="text-neutral-400 font-semibold">обязательно</span>
            </label>
            <div className="relative mb-3">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (777) 123-45-67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 focus:border-hermes-500 focus:ring-4 focus:ring-hermes-500/15 py-3.5 pl-12 pr-4 bg-neutral-50 text-neutral-900 outline-none transition-all font-medium"
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

            <button
              type="button"
              onClick={() => submit("editor")}
              disabled={isPending || !phone.trim()}
              className="w-full bg-gradient-to-r from-hermes-500 to-hermes-600 hover:from-hermes-600 hover:to-hermes-700 disabled:opacity-50 disabled:saturate-50 text-white rounded-2xl py-4 font-bold text-base md:text-lg transition-all shadow-lg shadow-hermes-500/30 flex items-center justify-center gap-2 mb-2.5 active:scale-[0.99]"
            >
              {isPending && destination === "editor" ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Создать первый креатив
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => submit("account")}
              disabled={isPending || !phone.trim()}
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
    </div>
  );
}

/**
 * Urgency banner: "Акция действует до сегодня, 25 апреля, 23:59" with a
 * live countdown. The deadline rolls over automatically every midnight
 * Almaty time, so every visitor sees the offer ending *today*.
 *
 * Client-only — we gate the first render on a mounted flag so SSR and
 * hydration don't disagree about what "now" is.
 */
function DeadlineBanner() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Reserve the same height so the layout doesn't jump on hydration.
    return <div className="h-[88px] mb-10" aria-hidden />;
  }

  // Day label in Russian, e.g. "25 апреля".
  const dayLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
  }).format(now);

  // Build today-23:59:59 in Almaty. en-CA gives ISO YYYY-MM-DD in parts.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // Almaty is UTC+5 year-round (no DST), so we anchor the deadline in
  // that offset. This keeps the countdown correct regardless of the
  // visitor's device timezone.
  const deadline = new Date(
    `${parts.year}-${parts.month}-${parts.day}T23:59:59+05:00`,
  );
  const msLeft = Math.max(0, deadline.getTime() - now.getTime());
  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  const seconds = Math.floor((msLeft % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-75 fill-mode-both">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-hermes-600/30 via-red-500/20 to-amber-500/30 border border-hermes-500/40 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-hermes-500 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Flame className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] md:text-sm font-bold leading-tight">
              Бонус 7 Импульсов — только сегодня
            </p>
            <p className="text-hermes-200 text-[11px] md:text-xs leading-tight mt-0.5">
              Акция активна до <strong>{dayLabel}, 23:59</strong> · потом
              только платно
            </p>
          </div>
          <div className="flex-shrink-0 flex items-baseline gap-1 font-mono tabular-nums text-white">
            <TimeBox value={pad(hours)} unit="ч" />
            <TimeBox value={pad(minutes)} unit="м" />
            <TimeBox value={pad(seconds)} unit="с" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TimeBox({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-sm md:text-base font-black leading-none bg-black/30 rounded-md px-1.5 py-1 min-w-[28px] text-center">
        {value}
      </span>
      <span className="text-[9px] md:text-[10px] text-neutral-300 font-semibold mt-0.5">
        {unit}
      </span>
    </span>
  );
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
