"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
import { registerUser, loginUser, checkEmailExists } from "@/actions/authActions";
import { normalizeKzPhone, formatPhoneAsTyped } from "@/lib/auth/normalize-phone";
import { FieldStagger, ShimmerButton } from "./AuthShellAnimations";
import { AnimatedLogo } from "./AnimatedLogo";

type AuthMode = "register" | "login";

/**
 * Unified auth form — register OR login, auto-switches based on
 * whether the entered email is already registered. Talks directly
 * to our in-house server actions (registerUser / loginUser /
 * checkEmailExists). No Clerk, no useSignUp/useSignIn hooks.
 *
 * Behavior:
 *   1. Default = REGISTER mode — 3 fields visible (email + phone + password)
 *   2. As user types email, after 800ms debounce we ping
 *      checkEmailExists() — a tiny server action that hits the users
 *      table for an existence check, no DB writes, no auth attempt.
 *   3. If exists → phone field collapses, title flips to "С возвращением!",
 *      submit button becomes "Войти".
 *   4. User can also flip mode manually via the Войти/Зарегистрироваться
 *      link below the title.
 *   5. On submit, the matching server action runs. Success → it returns
 *      a redirect path, we navigate there. Failure → inline field error.
 *
 * The whole flow lives in OUR domain — no iframes, no third-party
 * branding visible anywhere.
 */
export function CustomAuthForm({
  defaultMode = "register",
  redirectAfter,
}: {
  defaultMode?: AuthMode;
  redirectAfter?: string;
}) {
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
  const [emailKnown, setEmailKnown] = useState<boolean | null>(null);
  const [probing, setProbing] = useState(false);
  const probeTokenRef = useRef(0);

  function clearFieldError(field: keyof typeof errors) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // ── Email-existence probe (800ms debounce after typing) ──
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailKnown(null);
      setProbing(false);
      return;
    }

    const myToken = ++probeTokenRef.current;
    setProbing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkEmailExists(trimmed);
        if (myToken !== probeTokenRef.current) return; // stale
        setEmailKnown(result.exists);
        // Bidirectional auto-switch:
        //   exists  → login (no need to ask phone again)
        //   missing → register (need phone for the new account)
        // The phone field collapses/expands smoothly in either direction
        // via AnimatePresence. User can still flip manually via the
        // header link if our heuristic is wrong.
        setMode(result.exists ? "login" : "register");
      } catch {
        if (myToken === probeTokenRef.current) setEmailKnown(null);
      } finally {
        if (myToken === probeTokenRef.current) setProbing(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [email]);

  function clientValidate(): { ok: boolean; normalizedPhone: string | null } {
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
    const { ok, normalizedPhone } = clientValidate();
    if (!ok) return;

    startTransition(async () => {
      try {
        const result =
          mode === "register"
            ? await registerUser({
                email: email.trim().toLowerCase(),
                password,
                phone: normalizedPhone || undefined,
              })
            : await loginUser({ email: email.trim().toLowerCase(), password });

        if (result.success) {
          router.push(redirectAfter || result.redirect);
          router.refresh();
          return;
        }

        // Server returned a structured error — drop it on the right field
        if (result.field === "email") setErrors({ email: result.error });
        else if (result.field === "phone") setErrors({ phone: result.error });
        else if (result.field === "password") setErrors({ password: result.error });
        else setErrors({ form: result.error });

        // Auto-switch heuristics: server told us the email was already
        // taken during registration → flip to login.
        if (mode === "register" && result.field === "email" && /уже зарегистр/i.test(result.error)) {
          setMode("login");
          setEmailKnown(true);
        }
      } catch (err: any) {
        setErrors({ form: err?.message || "Что-то пошло не так. Попробуй ещё раз." });
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
          disabled={isPending}
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
