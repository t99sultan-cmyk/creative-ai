"use client";

import { useState, useTransition } from "react";
// Legacy hook gives us `{ isLoaded, signIn, setActive }` directly —
// matches the imperative useSignUp pattern in CustomSignUpForm.
import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { FieldStagger, ShimmerButton } from "./AuthShellAnimations";

/**
 * Custom sign-in form. Mirror of CustomSignUpForm — same visual
 * style, same useSignIn() hook from Clerk legacy. Two fields only:
 * email + password. No social logins (Google/Apple disabled in
 * Clerk dashboard); no magic-link flow yet.
 *
 * Why custom: the hosted Clerk <SignIn /> embed has the same
 * issues as the registration counterpart — slow iframe, unstyled
 * fallback CSS on old Android, and the typo'd app name in the
 * header. Replacing with our own DOM-native form keeps the brand
 * consistent and the load fast.
 *
 * After successful login → navigates to `redirectAfter` (default
 * `/editor`). The redirect path is sanitized at the page level to
 * accept only same-origin paths (XSS protection).
 */
export function CustomSignInForm({
  redirectAfter = "/editor",
}: {
  redirectAfter?: string;
}) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  function clearFieldError(field: keyof typeof errors) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Введите email";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Похоже, в email есть опечатка";
    if (!password) next.password = "Введите пароль";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || isPending) return;
    if (!validate()) return;

    startTransition(async () => {
      try {
        const result = await signIn!.create({
          identifier: email.trim().toLowerCase(),
          password,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setActive!({ session: result.createdSessionId });
          router.push(redirectAfter);
          return;
        }

        // 2FA / additional verification not configured for this app —
        // shouldn't happen in practice, but defensive copy.
        setErrors({
          form: "Нужна дополнительная проверка. Напиши в Telegram @voise_kz — поможем войти.",
        });
      } catch (err: any) {
        const clerkErr = err?.errors?.[0];
        const code = clerkErr?.code;
        const message = clerkErr?.longMessage || clerkErr?.message || "";

        if (code === "form_password_incorrect") {
          setErrors({ password: "Пароль неверный. Попробуй ещё раз." });
        } else if (code === "form_identifier_not_found") {
          setErrors({ email: "Аккаунта с таким email нет. Зарегистрируйся ниже." });
        } else if (code === "session_exists") {
          // Already logged in — just go through.
          router.push(redirectAfter);
        } else if (code === "form_param_format_invalid") {
          setErrors({ email: "Похоже, в email есть опечатка." });
        } else if (code === "user_locked") {
          setErrors({ form: "Слишком много попыток. Попробуй через несколько минут." });
        } else {
          setErrors({ form: message || "Не получилось войти. Попробуй ещё раз." });
        }
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl shadow-black/10 ring-1 ring-neutral-200 p-6 sm:p-8 space-y-5"
    >
      <FieldStagger initialDelay={0.05}>
        <div className="text-center mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-1">
            С возвращением
          </h1>
          <p className="text-sm text-neutral-500">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-bold text-hermes-600 hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>

        <Field
          label="Email"
          icon={<Mail className="w-4 h-4 text-neutral-400" />}
          error={errors.email}
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

        <Field
          label="Пароль"
          icon={<Lock className="w-4 h-4 text-neutral-400" />}
          error={errors.password}
        >
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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
          disabled={isPending || !isLoaded}
          className="relative w-full bg-gradient-to-r from-hermes-500 to-amber-500 hover:from-hermes-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-hermes-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Входим…
            </>
          ) : (
            <>
              Войти
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </ShimmerButton>
    </form>
  );
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-neutral-50 border transition-colors ${
          error ? "border-rose-300 bg-rose-50" : "border-neutral-200 focus-within:border-hermes-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(243,112,33,0.08)]"
        }`}
      >
        {icon}
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 leading-snug">{error}</p>}
    </div>
  );
}
