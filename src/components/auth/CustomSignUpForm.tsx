"use client";

import { useState, useRef, useEffect } from "react";
// Legacy hook surface — exposes isLoaded/setActive/signUp.create() that
// we use here. The default @clerk/nextjs export is the new Signal-based
// API which doesn't have those.
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Lock, Sparkles, Zap, ArrowRight, AlertCircle, Loader2, Check, Shield } from "lucide-react";
import Link from "next/link";

/**
 * Custom multi-step phone-based sign-up form. Replaces Clerk's hosted
 * <SignUp /> modal. Clerk stays as the silent auth backend (password
 * hashing, sessions, etc.) but every visible UI element is ours.
 *
 * Flow (Clerk dashboard config: Phone enabled, SMS verification ON):
 *   1. Phone — user enters Kazakh-format phone (+7XXX...)
 *   2. Password — 8+ chars, with live strength meter
 *   3. SMS code — Clerk sends a 6-digit code, user enters it
 *   4. Success — animated +7⚡ counter, then redirect
 *
 * Variant prop:
 *   "page" — full-screen layout for /register route
 *   "inline" — compact card layout for embedding in the landing hero
 *
 * Mobile-first: text-base inputs (16px = no iOS zoom), py-4 buttons.
 */

type Step = "phone" | "password" | "code" | "loading" | "success";
type Variant = "page" | "inline";

export function CustomSignUpForm({
  redirectUrl = "/onboarding",
  variant = "page",
}: {
  redirectUrl?: string;
  variant?: Variant;
}) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [impulseCount, setImpulseCount] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the active input on each step. iOS will sometimes block
  // programmatic focus outside a user gesture — that's OK, the user
  // taps the visible input themselves and the form still works.
  useEffect(() => {
    if (step === "phone") {
      const t = setTimeout(() => phoneInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    if (step === "password") {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    if (step === "code") {
      const t = setTimeout(() => codeInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Resend SMS button cooldown — Clerk rate-limits SMS to once every
  // 30s per number. We mirror that on the client so users don't spam.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Success-step impulse counter — 0 → 7 over ~1.5s, then auto-redirect.
  useEffect(() => {
    if (step !== "success") return;
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setImpulseCount(i);
      if (i < 7) setTimeout(tick, 180);
      else setTimeout(() => router.push(redirectUrl), 800);
    };
    setTimeout(tick, 300);
    return () => {
      cancelled = true;
    };
  }, [step, redirectUrl, router]);

  function handlePhoneNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = normalizePhone(phone);
    if (!isValidKzPhone(cleaned)) {
      setError("Введи телефон в формате +7XXXXXXXXXX (10 цифр после +7)");
      return;
    }
    setPhone(cleaned);
    setStep("password");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    if (password.length < 8) {
      setError("Пароль должен быть от 8 символов");
      return;
    }

    setStep("loading");
    try {
      // Create the SignUp resource with phone + password.
      await signUp.create({ phoneNumber: phone, password });
      // Trigger SMS code delivery.
      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      setResendCooldown(30);
      setStep("code");
    } catch (err: unknown) {
      const message = parseClerkError(err);
      setError(message);
      setStep("password");
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    if (code.length < 4) {
      setError("Введи код из SMS — обычно 6 цифр");
      return;
    }

    setStep("loading");
    try {
      const result = await signUp.attemptPhoneNumberVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("success");
      } else {
        setError("Не получилось подтвердить. Проверь код и попробуй ещё.");
        setStep("code");
      }
    } catch (err: unknown) {
      const message = parseClerkError(err);
      setError(message);
      setStep("code");
    }
  }

  async function handleResendCode() {
    if (!isLoaded || resendCooldown > 0) return;
    setError(null);
    try {
      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      setResendCooldown(30);
    } catch (err: unknown) {
      setError(parseClerkError(err));
    }
  }

  // Color tokens swap by variant: dark-on-glass for /register page,
  // light-on-card for hero inline embedding (white card on neutral-50
  // page background).
  const dark = variant === "page";
  const cls = {
    bg: dark ? "bg-neutral-800/80 border-neutral-700" : "bg-white border-neutral-200",
    bgHover: dark ? "focus:border-hermes-500 focus:ring-hermes-500/20" : "focus:border-hermes-500 focus:ring-hermes-500/20",
    text: dark ? "text-white placeholder:text-neutral-500" : "text-neutral-900 placeholder:text-neutral-400",
    label: dark ? "text-neutral-400" : "text-neutral-500",
    title: dark ? "text-white" : "text-neutral-900",
    subtitle: dark ? "text-neutral-400" : "text-neutral-500",
    iconColor: dark ? "text-neutral-400" : "text-neutral-400",
    divider: dark ? "bg-neutral-700" : "bg-neutral-200",
  };

  return (
    <div className={variant === "inline" ? "w-full" : "w-full max-w-md mx-auto px-5"}>
      <StepDots step={step} dark={dark} />

      <AnimatePresence mode="wait">
        {step === "phone" && (
          <motion.form
            key="phone"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handlePhoneNext}
            className="space-y-5"
          >
            {variant === "page" && (
              <div className="text-center mb-6">
                <h1 className={`text-2xl sm:text-3xl font-black ${cls.title} mb-2`}>
                  Готов сделать первый креатив?
                </h1>
                <p className={`${cls.subtitle} text-sm`}>
                  Введи номер телефона — отправим SMS-код
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-wider ${cls.label} ml-1`}>
                Телефон
              </label>
              <div className="relative">
                <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${cls.iconColor} pointer-events-none`} />
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  placeholder="+77001234567"
                  className={`w-full ${cls.bg} border ${cls.bgHover} focus:ring-2 rounded-2xl pl-12 pr-4 py-4 text-base ${cls.text} outline-none transition-all`}
                />
              </div>
            </div>

            {error && <ErrorBanner message={error} dark={dark} />}

            <button
              type="submit"
              disabled={phone.length < 7}
              className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-[0.98] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-hermes-500/30 flex items-center justify-center gap-2"
            >
              Дальше
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className={`flex items-center justify-center gap-2 text-xs ${cls.subtitle}`}>
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-semibold">7 импульсов в подарок · без карты</span>
            </div>

            <p className={`text-center text-xs ${cls.subtitle} pt-1`}>
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-hermes-500 font-bold hover:text-hermes-600">
                Войти
              </Link>
            </p>
          </motion.form>
        )}

        {step === "password" && (
          <motion.form
            key="password"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handlePasswordSubmit}
            className="space-y-5"
          >
            {variant === "page" && (
              <div className="text-center mb-6">
                <h1 className={`text-2xl sm:text-3xl font-black ${cls.title} mb-2`}>
                  Придумай пароль
                </h1>
                <p className={`${cls.subtitle} text-sm`}>
                  От 8 символов — он защитит твой аккаунт
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-wider ${cls.label} ml-1 flex items-center justify-between`}>
                <span>Пароль</span>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className={`text-xs font-medium ${cls.subtitle} hover:opacity-80 normal-case tracking-normal`}
                >
                  ← Изменить телефон
                </button>
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${cls.iconColor} pointer-events-none`} />
                <input
                  ref={passwordInputRef}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  minLength={8}
                  className={`w-full ${cls.bg} border ${cls.bgHover} focus:ring-2 rounded-2xl pl-12 pr-4 py-4 text-base ${cls.text} outline-none transition-all`}
                />
              </div>
              <PasswordStrength value={password} dark={dark} />
            </div>

            {error && <ErrorBanner message={error} dark={dark} />}

            <button
              type="submit"
              disabled={password.length < 8}
              className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-[0.98] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-hermes-500/30 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Создать аккаунт
            </button>

            <p className={`text-center text-xs ${cls.subtitle} pt-1`}>
              Регистрируясь, ты соглашаешься с{" "}
              <Link href="/terms" className={`underline ${dark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-600 hover:text-neutral-800"}`}>
                условиями
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className={`underline ${dark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-600 hover:text-neutral-800"}`}>
                политикой конфиденциальности
              </Link>
              .
            </p>
            {/* Clerk's CAPTCHA mount target — bot-protection challenge
                renders here on suspicious signups. Required by Clerk
                even when invisible. */}
            <div id="clerk-captcha" />
          </motion.form>
        )}

        {step === "code" && (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handleCodeSubmit}
            className="space-y-5"
          >
            {variant === "page" && (
              <div className="text-center mb-6">
                <h1 className={`text-2xl sm:text-3xl font-black ${cls.title} mb-2`}>
                  Введи код из SMS
                </h1>
                <p className={`${cls.subtitle} text-sm`}>
                  Отправили на <span className={`font-bold ${cls.title}`}>{phone}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-wider ${cls.label} ml-1`}>
                Код из SMS
              </label>
              <div className="relative">
                <Shield className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${cls.iconColor} pointer-events-none`} />
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  placeholder="123456"
                  className={`w-full ${cls.bg} border ${cls.bgHover} focus:ring-2 rounded-2xl pl-12 pr-4 py-4 text-2xl tracking-[0.4em] font-mono ${cls.text} outline-none transition-all text-center`}
                />
              </div>
            </div>

            {error && <ErrorBanner message={error} dark={dark} />}

            <button
              type="submit"
              disabled={code.length < 4}
              className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-[0.98] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-hermes-500/30 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Подтвердить
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("password")}
                className={`${cls.subtitle} hover:opacity-80 font-medium`}
              >
                ← Изменить номер
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className={`${resendCooldown > 0 ? "opacity-40 cursor-not-allowed" : "text-hermes-500 hover:text-hermes-600"} font-bold`}
              >
                {resendCooldown > 0 ? `Отправить заново (${resendCooldown}с)` : "Отправить код заново"}
              </button>
            </div>
          </motion.form>
        )}

        {step === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-hermes-500 to-amber-500 flex items-center justify-center shadow-2xl shadow-hermes-500/30">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h2 className={`text-2xl font-black ${cls.title} mb-2`}>
              Один момент...
            </h2>
            <p className={`${cls.subtitle} text-sm`}>Создаём твой аккаунт</p>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
            >
              <Check className="w-12 h-12 text-white stroke-[3]" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-3xl font-black ${cls.title} mb-3`}
            >
              Готово! 🎉
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`${cls.subtitle} text-sm mb-8`}
            >
              Открываем студию...
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-4"
            >
              <Zap className="w-7 h-7 text-amber-400 fill-amber-400" />
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider font-bold text-amber-300">
                  Начислено импульсов
                </div>
                <motion.div
                  key={impulseCount}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`text-3xl font-black tabular-nums ${dark ? "text-white" : "text-amber-700"}`}
                >
                  +{impulseCount} ⚡
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepDots({ step, dark }: { step: Step; dark: boolean }) {
  // Phone=1, password=2, code=3, loading/success collapse to "active"
  const active = step === "phone" ? 1 : step === "password" ? 2 : step === "code" ? 3 : 4;
  const inactiveBg = dark ? "bg-neutral-700" : "bg-neutral-200";
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n === active
              ? "w-8 bg-hermes-500"
              : n < active
                ? "w-2 bg-emerald-500"
                : `w-2 ${inactiveBg}`
          }`}
        />
      ))}
    </div>
  );
}

function PasswordStrength({ value, dark }: { value: string; dark: boolean }) {
  const score = strengthScore(value);
  const labels = ["Слабый", "Слабый", "Средний", "Хороший", "Сильный"];
  const colors = [
    "bg-red-500",
    "bg-red-400",
    "bg-amber-400",
    "bg-emerald-400",
    "bg-emerald-500",
  ];
  if (value.length === 0) return null;
  const inactive = dark ? "bg-neutral-700" : "bg-neutral-200";
  const labelColor = dark ? "text-neutral-400" : "text-neutral-500";
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex-1 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : inactive
            }`}
          />
        ))}
      </div>
      <span className={`text-xs ${labelColor} font-medium w-16 text-right`}>
        {value.length < 8 ? `${value.length}/8` : labels[score]}
      </span>
    </div>
  );
}

function ErrorBanner({ message, dark }: { message: string; dark: boolean }) {
  const bg = dark ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-red-50 border-red-200 text-red-700";
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 ${bg} border rounded-xl px-4 py-3 text-sm`}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}

function normalizePhone(input: string): string {
  // Strip everything that isn't a digit or leading +. KZ numbers
  // come in many shapes — "8 700 ...", "+7 (700) ...", "77001234567" —
  // we collapse to E.164 "+7XXXXXXXXXX".
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return "+7";
  // 87001234567 → 77001234567 → +77001234567 (KZ "8" prefix → "7")
  let body = digits;
  if (body.startsWith("8")) body = "7" + body.slice(1);
  if (body.startsWith("7") && body.length === 11) return "+" + body;
  if (body.startsWith("77") && body.length === 11) return "+" + body;
  if (!body.startsWith("7")) body = "7" + body;
  return "+" + body;
}

function isValidKzPhone(phone: string): boolean {
  // E.164 KZ: +7 followed by exactly 10 digits.
  return /^\+7\d{10}$/.test(phone);
}

function strengthScore(pwd: string): number {
  if (pwd.length < 8) return 0;
  let score = 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 0.5;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 0.5;
  return Math.min(4, Math.round(score));
}

function parseClerkError(err: unknown): string {
  if (typeof err === "object" && err !== null && "errors" in err) {
    const errors = (err as { errors?: Array<{ code?: string; message?: string }> }).errors;
    if (errors && errors.length > 0) {
      const code = errors[0].code;
      if (code === "form_identifier_exists") {
        return "Этот номер уже зарегистрирован. Войди вместо регистрации.";
      }
      if (code === "form_password_pwned") {
        return "Этот пароль попал в утечки. Придумай другой.";
      }
      if (code === "form_password_length_too_short") {
        return "Пароль слишком короткий. Минимум 8 символов.";
      }
      if (code === "form_param_format_invalid" || code === "form_param_format_invalid_phone_number") {
        return "Номер некорректный. Формат: +7XXXXXXXXXX";
      }
      if (code === "form_code_incorrect") {
        return "Неверный код. Проверь SMS и введи ещё раз.";
      }
      if (code === "verification_expired") {
        return "Код устарел. Жми «Отправить заново».";
      }
      return errors[0].message || "Не получилось. Попробуй ещё раз.";
    }
  }
  return "Что-то пошло не так. Попробуй ещё раз.";
}
