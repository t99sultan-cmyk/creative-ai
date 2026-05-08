"use client";

import { useState, useRef, useEffect } from "react";
// Use the legacy hook surface: @clerk/nextjs's default useSignUp is the
// new Signal-based API (returns { signUp, errors, fetchStatus }) which
// doesn't expose isLoaded/setActive directly. The /legacy export keeps
// the imperative create()/setActive() ergonomics we need here.
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Sparkles, Zap, ArrowRight, AlertCircle, Loader2, Check } from "lucide-react";
import Link from "next/link";

/**
 * Custom multi-step sign-up form. Replaces Clerk's hosted <SignUp /> modal,
 * which loads slowly inside webviews (Instagram, TikTok) and shows
 * unstyled fallback CSS on old Android browsers — both kill conversion.
 *
 * This form lives entirely on our domain in our DOM, no iframe. Talks
 * to Clerk via the useSignUp() hook directly. Same auth backend, same
 * users, just our UI.
 *
 * Flow (no verification, per Clerk dashboard config):
 *   step 1 — email
 *   step 2 — password
 *   step 3 — loading (~1-2s while Clerk creates the account)
 *   step 4 — success animation showing impulse award, then redirect
 *
 * Game-feel touches:
 *   - One field per screen with big inputs (no overwhelming form)
 *   - Step counter dots at top (1 ● 2 ○ 3 ○) — progress visible
 *   - Animated impulse counter on success (+1 +2 ... +7 ⚡)
 *   - framer-motion slide-in transitions between steps
 *
 * Mobile-first: full-bleed, big text, big tap targets.
 */

type Step = "email" | "password" | "loading" | "success";

export function CustomSignUpForm({ redirectUrl = "/onboarding" }: { redirectUrl?: string }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [impulseCount, setImpulseCount] = useState(0);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on each step transition. iOS sometimes blocks
  // programmatic focus outside a user gesture — that's OK, the user
  // taps the input themselves on iOS.
  useEffect(() => {
    if (step === "email") {
      const t = setTimeout(() => emailInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    if (step === "password") {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Success-step impulse counter — counts up 0 → 7 over ~1.5s for a
  // small "you got rewarded" beat before redirect. Not gambling-grade,
  // just a friendly confirmation.
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

  function handleEmailNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Введи корректный email — без него не пришлём подтверждение");
      return;
    }
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
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("success");
      } else {
        // Clerk requires extra verification despite our config — fall
        // back to the hosted page so the user can finish there.
        setError("Дополнительная проверка. Попробуй обычную форму.");
        setStep("password");
      }
    } catch (err: unknown) {
      const message = parseClerkError(err);
      setError(message);
      setStep("password");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-5">
      {/* Step dots — visual progress (1 of 3). Loading and success
          collapse to the same active "doing the thing" indicator. */}
      <StepDots step={step} />

      <AnimatePresence mode="wait">
        {step === "email" && (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handleEmailNext}
            className="space-y-5"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Готов сделать первый креатив?
              </h1>
              <p className="text-neutral-400 text-sm">
                Введи свой email — это займёт меньше минуты
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                <input
                  ref={emailInputRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="ivan@example.com"
                  className="w-full bg-neutral-800/80 backdrop-blur border border-neutral-700 focus:border-hermes-500 focus:ring-2 focus:ring-hermes-500/20 rounded-2xl pl-12 pr-4 py-4 text-base text-white placeholder:text-neutral-500 outline-none transition-all"
                />
              </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={!email}
              className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-[0.98] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-hermes-500/20 flex items-center justify-center gap-2"
            >
              Дальше
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-semibold">7 импульсов в подарок · без карты</span>
            </div>

            <p className="text-center text-xs text-neutral-500 pt-2">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-hermes-400 font-bold hover:text-hermes-300">
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
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Отлично! Теперь пароль
              </h1>
              <p className="text-neutral-400 text-sm">
                От 8 символов — он защищает твой аккаунт и креативы
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1 flex items-center justify-between">
                <span>Пароль</span>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-300 normal-case tracking-normal"
                >
                  ← Изменить email
                </button>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
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
                  className="w-full bg-neutral-800/80 backdrop-blur border border-neutral-700 focus:border-hermes-500 focus:ring-2 focus:ring-hermes-500/20 rounded-2xl pl-12 pr-4 py-4 text-base text-white placeholder:text-neutral-500 outline-none transition-all"
                />
              </div>
              <PasswordStrength value={password} />
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={password.length < 8}
              className="w-full bg-hermes-500 hover:bg-hermes-600 active:scale-[0.98] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-hermes-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Создать аккаунт
            </button>

            <p className="text-center text-xs text-neutral-500 pt-2">
              Регистрируясь, ты соглашаешься с{" "}
              <Link href="/terms" className="text-neutral-400 underline hover:text-neutral-200">
                условиями
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="text-neutral-400 underline hover:text-neutral-200">
                политикой конфиденциальности
              </Link>
              .
            </p>
            {/* Clerk's CAPTCHA renders inside this div on bot-suspect
                signups. Required by Clerk; if we don't include it, the
                bot-protection challenge has nowhere to mount and the
                signup silently fails on suspicious traffic. */}
            <div id="clerk-captcha" />
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
            <h2 className="text-2xl font-black text-white mb-2">Создаём твой аккаунт...</h2>
            <p className="text-neutral-400 text-sm">Это займёт пару секунд</p>
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
            {/* Animated success ring with check icon */}
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
              className="text-3xl font-black text-white mb-3"
            >
              Готово! 🎉
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-neutral-400 text-sm mb-8"
            >
              Открываем студию...
            </motion.p>

            {/* Animated impulse counter — counts up 0 → 7 with a small
                bounce per tick. Sells the value of registration. */}
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
                  initial={{ scale: 1.3, color: "#fbbf24" }}
                  animate={{ scale: 1, color: "#ffffff" }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl font-black tabular-nums"
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

function StepDots({ step }: { step: Step }) {
  // Email = 1, password = 2, loading/success = 3
  const active = step === "email" ? 1 : step === "password" ? 2 : 3;
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n === active
              ? "w-8 bg-hermes-500"
              : n < active
                ? "w-2 bg-emerald-500"
                : "w-2 bg-neutral-700"
          }`}
        />
      ))}
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
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
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex-1 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-neutral-700"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-neutral-400 font-medium w-16 text-right">
        {value.length < 8 ? `${value.length}/8` : labels[score]}
      </span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300"
      role="alert"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
        return "У вас уже есть аккаунт с этим email. Войди вместо регистрации.";
      }
      if (code === "form_password_pwned") {
        return "Этот пароль попал в утечки данных. Придумай другой.";
      }
      if (code === "form_password_length_too_short") {
        return "Пароль слишком короткий. Минимум 8 символов.";
      }
      if (code === "form_param_format_invalid" || code === "form_param_format_invalid_email_address") {
        return "Email некорректный. Проверь написание.";
      }
      return errors[0].message || "Не получилось создать аккаунт. Попробуй ещё раз.";
    }
  }
  return "Что-то пошло не так. Попробуй ещё раз.";
}
