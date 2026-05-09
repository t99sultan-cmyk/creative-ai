"use client";

import { useState, useTransition, useEffect, useRef } from "react";
// Both legacy hooks at once — combined form needs both create-account
// and create-session flows depending on detected mode.
import { useSignUp, useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Phone,
  Lock,
  Loader2,
  Check,
  ArrowRight,
  Gift,
  Sparkles,
} from "lucide-react";
import { savePhone } from "@/actions/savePhone";
import { normalizeKzPhone, formatPhoneAsTyped } from "@/lib/auth/normalize-phone";
import { FieldStagger, ShimmerButton } from "./AuthShellAnimations";
import { AnimatedLogo } from "./AnimatedLogo";

type AuthMode = "register" | "login";

/**
 * Unified auth form. Replaces the previous separate CustomSignUpForm
 * and CustomSignInForm with a single component that detects whether
 * the email is already registered and switches between the two flows
 * automatically — no tabs to think about, no "wait, am I on the right
 * page" friction.
 *
 * Behavior:
 *   1. By default renders in REGISTER mode (3 fields: email + phone +
 *      password) — prioritizes new-user conversion.
 *   2. As soon as the user finishes typing a valid email (800ms
 *      debounce), we ping Clerk to see if an account exists.
 *   3. If it exists → auto-switch to LOGIN mode: phone field collapses
 *      with a smooth height-animation, headline changes to
 *      "С возвращением!", submit button label changes to "Войти".
 *   4. If it doesn't exist → stay in REGISTER mode.
 *   5. User can also flip the mode manually via the small toggle below
 *      the form (in case our auto-detect is wrong).
 *
 * The probe call uses signIn.create({ identifier }) which:
 *   - Returns status="needs_first_factor" if account exists
 *   - Throws form_identifier_not_found if not
 * Each probe creates a partial sign-in attempt in Clerk; they
 * auto-expire so it's not a leak. Debounce keeps the rate sane.
 */
export function CustomAuthForm({
  defaultMode = "register",
  redirectAfter,
}: {
  defaultMode?: AuthMode;
  /** Where to send the user after success. Defaults: register →
   *  /onboarding (welcome screen), login → /editor. */
  redirectAfter?: string;
}) {
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    phone?: string;
    password?: string;
    form?: string;
  }>({});
  /** null = not checked yet; true = found; false = not found. Drives
   *  the "С возвращением" hint and auto-switch behavior. */
  const [emailKnown, setEmailKnown] = useState<boolean | null>(null);
  /** True while a probe is in flight — used to show a tiny spinner
   *  in the email-field corner so the user knows something's happening. */
  const [probing, setProbing] = useState(false);
  /** Latest probe token — guards against stale responses overwriting
   *  fresh state if the user types fast. */
  const probeTokenRef = useRef(0);

  function clearFieldError(field: keyof typeof errors) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // ── Email-existence probe (800ms debounce after typing) ──
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    // Only probe a syntactically-valid email
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailKnown(null);
      setProbing(false);
      return;
    }
    if (!signInLoaded || !signIn) return;

    const myToken = ++probeTokenRef.current;
    setProbing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await signIn.create({ identifier: trimmed });
        // If we got here without throwing, the account exists.
        if (myToken !== probeTokenRef.current) return; // stale
        if (result.status === "needs_first_factor" || result.status === "complete") {
          setEmailKnown(true);
          // Auto-switch from register → login when we recognize the email.
          // Don't auto-switch the OTHER way (login → register) on miss
          // because the user might be mid-typing.
          setMode((m) => (m === "register" ? "login" : m));
        }
      } catch (err: any) {
        if (myToken !== probeTokenRef.current) return;
        const code = err?.errors?.[0]?.code;
        if (code === "form_identifier_not_found") {
          setEmailKnown(false);
        } else {
          // Some other error — keep state unknown so we don't mislead
          // the user. They can still submit and get a real error.
          setEmailKnown(null);
        }
      } finally {
        if (myToken === probeTokenRef.current) setProbing(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [email, signInLoaded, signIn]);

  function validate(): { ok: boolean; normalizedPhone: string | null } {
    const next: typeof errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Введите email";
    else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) next.email = "Похоже, в email есть опечатка";

    let normalizedPhone: string | null = null;
    if (mode === "register") {
      normalizedPhone = normalizeKzPhone(phone);
      if (!phone.trim()) next.phone = "Введите номер телефона";
      else if (!normalizedPhone)
        next.phone = "Похоже, в номере есть ошибка. Должно быть 11 цифр (например, +7 707 ...)";
    }

    if (!password) next.password = "Введите пароль";
    else if (mode === "register" && password.length < 7) next.password = "Минимум 7 символов";

    setErrors(next);
    return { ok: Object.keys(next).length === 0, normalizedPhone };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    if (mode === "register" && !signUpLoaded) return;
    if (mode === "login" && !signInLoaded) return;

    const { ok, normalizedPhone } = validate();
    if (!ok) return;

    startTransition(async () => {
      try {
        if (mode === "register") {
          const result = await signUp!.create({
            emailAddress: email.trim().toLowerCase(),
            password,
            unsafeMetadata: { phone: normalizedPhone },
          });
          if (result.status === "complete" && result.createdSessionId) {
            await setActiveSignUp!({ session: result.createdSessionId });
            try {
              if (normalizedPhone) await savePhone(normalizedPhone);
            } catch (phoneErr) {
              console.warn("[CustomAuthForm] savePhone failed:", phoneErr);
            }
            router.push(redirectAfter || "/onboarding");
            return;
          }
          setErrors({
            form:
              "Регистрация требует подтверждения. Напиши нам в Telegram @voise_kz — поможем войти.",
          });
        } else {
          // Login mode — fresh signIn.create with both identifier and password
          // (the probe call we did earlier was identifier-only; password attempt
          // happens here on submit).
          const result = await signIn!.create({
            identifier: email.trim().toLowerCase(),
            password,
          });
          if (result.status === "complete" && result.createdSessionId) {
            await setActiveSignIn!({ session: result.createdSessionId });
            router.push(redirectAfter || "/editor");
            return;
          }
          setErrors({
            form:
              "Нужна дополнительная проверка. Напиши в Telegram @voise_kz — поможем войти.",
          });
        }
      } catch (err: any) {
        const clerkErr = err?.errors?.[0];
        const code = clerkErr?.code;
        const message = clerkErr?.longMessage || clerkErr?.message || "";

        if (mode === "register") {
          if (code === "form_identifier_exists") {
            // Auto-switch to login mode — the email was already registered.
            setEmailKnown(true);
            setMode("login");
            setErrors({ email: "Этот email уже зарегистрирован — введи пароль чтобы войти." });
          } else if (code === "form_password_pwned") {
            setErrors({
              password: "Попробуй пароль с цифрой или символом (например, добавь !2026 к концу).",
            });
          } else if (code === "form_password_length_too_short") {
            setErrors({ password: "Минимум 7 символов" });
          } else if (
            code === "form_param_format_invalid" &&
            (message.toLowerCase().includes("phone") || message.toLowerCase().includes("номер"))
          ) {
            setErrors({ phone: "Похоже, в номере есть ошибка." });
          } else if (code === "form_param_format_invalid") {
            setErrors({ email: "Похоже, в email есть опечатка." });
          } else {
            setErrors({ form: message || "Не получилось создать аккаунт. Попробуй ещё раз." });
          }
        } else {
          // Login error mapping
          if (code === "form_password_incorrect") {
            setErrors({ password: "Пароль неверный. Попробуй ещё раз." });
          } else if (code === "form_identifier_not_found") {
            // No account → flip to register mode automatically
            setEmailKnown(false);
            setMode("register");
            setErrors({});
          } else if (code === "session_exists") {
            router.push(redirectAfter || "/editor");
          } else if (code === "user_locked") {
            setErrors({ form: "Слишком много попыток. Попробуй через несколько минут." });
          } else {
            setErrors({ form: message || "Не получилось войти. Попробуй ещё раз." });
          }
        }
      }
    });
  }

  const isRegister = mode === "register";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl shadow-black/10 ring-1 ring-neutral-200 p-6 sm:p-8 space-y-5"
    >
      <FieldStagger initialDelay={0.05}>
        {/* Header — logo + dynamic title that shifts based on mode.
            Keeping the logo always above keeps brand consistency. */}
        <div className="text-center mb-2 flex flex-col items-center">
          <div className="mb-3">
            <AnimatedLogo size="lg" withWordmark={false} />
          </div>
          <AnimatePresence mode="wait">
            <motion.h1
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-2xl sm:text-3xl font-black text-neutral-900 mb-1"
            >
              {isRegister ? "Регистрация — за 30 секунд" : "С возвращением!"}
            </motion.h1>
          </AnimatePresence>
          <p className="text-sm text-neutral-500">
            {isRegister ? (
              <>
                Уже есть аккаунт?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-bold text-hermes-600 hover:underline"
                >
                  Войти
                </button>
              </>
            ) : (
              <>
                Нет аккаунта?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-bold text-hermes-600 hover:underline"
                >
                  Зарегистрироваться
                </button>
              </>
            )}
          </p>
        </div>

        {/* Email — always visible. Right-side icon shows probe state. */}
        <Field
          label="Email"
          icon={<Mail className="w-4 h-4 text-neutral-400" />}
          error={errors.email}
          rightIcon={
            probing ? (
              <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
            ) : emailKnown === true ? (
              <Sparkles className="w-4 h-4 text-emerald-500" />
            ) : null
          }
        >
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            className="w-full text-base sm:text-sm bg-transparent outline-none placeholder:text-neutral-400"
            placeholder="ivan@example.com"
            disabled={isPending}
            autoFocus
          />
        </Field>

        {/* Phone — only in register mode. AnimatePresence with height
            animation = smooth collapse/expand when mode flips. */}
        <AnimatePresence initial={false}>
          {isRegister && (
            <motion.div
              key="phone-field"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <Field
                label="Телефон"
                icon={<Phone className="w-4 h-4 text-neutral-400" />}
                error={errors.phone}
                helper="Можно начать с 8 — мы подставим +7 сами"
              >
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhoneAsTyped(e.target.value));
                    clearFieldError("phone");
                  }}
                  className="w-full text-base sm:text-sm bg-transparent outline-none placeholder:text-neutral-400 tabular-nums"
                  placeholder="+7 707 123 45 67"
                  disabled={isPending}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password — always visible */}
        <Field
          label="Пароль"
          icon={<Lock className="w-4 h-4 text-neutral-400" />}
          error={errors.password}
          helper={isRegister ? "Минимум 7 символов" : undefined}
        >
          <input
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            className="w-full text-base sm:text-sm bg-transparent outline-none placeholder:text-neutral-400"
            placeholder="••••••••"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"
            tabIndex={-1}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </Field>

        {/* Bonus chips — only in register mode (they're a sign-up
            incentive, not relevant for returning users). */}
        <AnimatePresence initial={false}>
          {isRegister && (
            <motion.div
              key="bonus"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: "hidden" }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-neutral-500 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Gift className="w-4 h-4 text-amber-500" /> 7 импульсов в подарок
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-500" /> Без карты
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </FieldStagger>

      {/* No #clerk-captcha mount point on purpose. Removing it makes
          Clerk fall back to **invisible** CAPTCHA — no checkbox, no
          "confirm you're human" button shown to the user. Bot
          protection still happens silently in the background.
          To restore the Smart CAPTCHA checkbox add back:
            <div id="clerk-captcha" /> */}

      <AnimatePresence>
        {errors.form && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-700"
          >
            {errors.form}
          </motion.div>
        )}
      </AnimatePresence>

      <ShimmerButton>
        <button
          type="submit"
          disabled={isPending || (isRegister ? !signUpLoaded : !signInLoaded)}
          className="relative w-full bg-gradient-to-r from-hermes-500 to-amber-500 hover:from-hermes-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-hermes-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isRegister ? "Создаём аккаунт…" : "Входим…"}
            </>
          ) : (
            <>
              {isRegister ? "Создать аккаунт" : "Войти"}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </ShimmerButton>

      {isRegister && (
        <p className="text-xs text-neutral-400 text-center leading-relaxed">
          Регистрируясь, ты соглашаешься с{" "}
          <Link href="/terms" className="underline hover:text-neutral-600">
            условиями
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="underline hover:text-neutral-600">
            политикой конфиденциальности
          </Link>
          .
        </p>
      )}
    </form>
  );
}

/**
 * Field wrapper — adds optional `rightIcon` slot that lives at the
 * far right of the input row (used for probe-state indicators).
 */
function Field({
  label,
  icon,
  rightIcon,
  error,
  helper,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-neutral-50 border transition-all ${
          error
            ? "border-rose-300 bg-rose-50"
            : "border-neutral-200 focus-within:border-hermes-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(243,112,33,0.08)]"
        }`}
      >
        {icon}
        {children}
        {rightIcon}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-600 leading-snug">{error}</p>
      ) : helper ? (
        <p className="mt-1 text-xs text-neutral-400 leading-snug">{helper}</p>
      ) : null}
    </div>
  );
}
