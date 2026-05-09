"use client";

import { useState, useTransition } from "react";
// Legacy API surface — exposes { isLoaded, signUp, setActive } directly,
// matching the patterns we used in commits bc4f770 / 5b74568. The new
// (Signal-based) API has different shapes that don't fit a one-shot
// imperative form like ours.
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, EyeOff, Mail, Phone, Lock, Loader2, Check, ArrowRight, Gift } from "lucide-react";
import { savePhone } from "@/actions/savePhone";
import { normalizeKzPhone, formatPhoneAsTyped } from "@/lib/auth/normalize-phone";

/**
 * Custom sign-up form. Replaces Clerk's hosted <SignUp /> modal/embed
 * with a one-screen form (email + phone + password). No verification
 * codes — user goes straight from "click create" to logged in.
 *
 * Architecture: headless Clerk. Auth backend (sessions, password
 * hashing, security) is still Clerk via the useSignUp() hook. Only
 * the UI is ours. Webhook user.created continues firing → user lands
 * in our DB with 7 impulses.
 *
 * Phone is captured here (not on /onboarding as before). Saved to
 * users.phone via savePhone() server action immediately after Clerk
 * creates the account. The /onboarding screen still exists for the
 * welcome+instructions flow but no longer asks for phone.
 *
 * Why no verification:
 * - SMS doesn't deliver reliably to KZ carriers (Tele2/Beeline filter
 *   international Twilio short codes as spam)
 * - Email codes add friction that drops conversion
 * - Goal of this iteration: measure raw signup rate without filters,
 *   then add verifications later if abuse becomes a problem.
 */
export function CustomSignUpForm({
  redirectAfter = "/onboarding",
}: {
  /** Where to send the user after signup. Defaults to /onboarding for
   *  the welcome+instructions flow. Pass a different path for cases
   *  like pricing-CTA → /checkout?plan=... */
  redirectAfter?: string;
}) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string; form?: string }>({});

  // Validation runs on submit only — typing while errors are visible
  // clears them on the touched field for immediate visual feedback.
  function clearFieldError(field: keyof typeof errors) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): { ok: boolean; normalizedPhone: string | null } {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Введите email";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Похоже, в email есть опечатка";

    const normalizedPhone = normalizeKzPhone(phone);
    if (!phone.trim()) next.phone = "Введите номер телефона";
    else if (!normalizedPhone) next.phone = "Похоже, в номере есть ошибка. Должно быть 11 цифр (например, +7 707 ...)";

    if (!password) next.password = "Введите пароль";
    else if (password.length < 6) next.password = "Минимум 6 символов";

    setErrors(next);
    return { ok: Object.keys(next).length === 0, normalizedPhone };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || isPending) return;

    const { ok, normalizedPhone } = validate();
    if (!ok || !normalizedPhone) return;

    startTransition(async () => {
      try {
        // Step 1 — create the Clerk account.
        // unsafeMetadata.phone is a fallback in case the savePhone()
        // call below fails — we can recover the phone from Clerk's
        // user metadata later via webhook or admin tool.
        const result = await signUp!.create({
          emailAddress: email.trim().toLowerCase(),
          password,
          unsafeMetadata: { phone: normalizedPhone },
        });

        // Step 2 — if Clerk requires no verification, status is "complete"
        // and we have a session right away. With the current Clerk
        // dashboard config (verify-at-signup OFF for both email and
        // phone) this is what should happen.
        if (result.status === "complete" && result.createdSessionId) {
          await setActive!({ session: result.createdSessionId });

          // Step 3 — write phone into our users table. savePhone is
          // idempotent and uses upsert, so it handles the case where
          // Clerk's webhook hasn't created the row yet (lazy-create).
          // Errors here are non-fatal — we still navigate the user
          // forward; admin can backfill from unsafeMetadata if needed.
          try {
            await savePhone(normalizedPhone);
          } catch (phoneErr) {
            console.warn("[CustomSignUpForm] savePhone failed:", phoneErr);
          }

          router.push(redirectAfter);
          return;
        }

        // Step 2b — if Clerk says verification is required (despite our
        // dashboard config saying otherwise — defensive fallback), bail
        // with a friendly message instead of getting stuck.
        setErrors({
          form:
            "Регистрация требует подтверждения. Напишите нам в Telegram @voise_kz — поможем войти.",
        });
      } catch (err: any) {
        // Clerk error format: { errors: [{ code, message, longMessage, meta }] }
        // We surface the most user-friendly version we can extract.
        const clerkErr = err?.errors?.[0];
        const code = clerkErr?.code;
        const message = clerkErr?.longMessage || clerkErr?.message || "";

        if (code === "form_identifier_exists") {
          setErrors({ email: "Этот email уже зарегистрирован. Попробуй войти." });
        } else if (code === "form_password_pwned") {
          setErrors({ password: "Этот пароль слишком распространён, попробуй другой." });
        } else if (code === "form_password_length_too_short") {
          setErrors({ password: "Минимум 6 символов" });
        } else if (code === "form_param_format_invalid" && (message.toLowerCase().includes("phone") || message.toLowerCase().includes("номер"))) {
          setErrors({ phone: "Похоже, в номере есть ошибка." });
        } else if (code === "form_param_format_invalid") {
          setErrors({ email: "Похоже, в email есть опечатка." });
        } else {
          setErrors({ form: message || "Не получилось создать аккаунт. Попробуй ещё раз." });
        }
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl shadow-black/10 ring-1 ring-neutral-200 p-6 sm:p-8 space-y-5"
    >
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-hermes-500 to-amber-500 mb-3 shadow-lg shadow-hermes-500/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-1">
          Регистрация — за 30 секунд
        </h1>
        <p className="text-sm text-neutral-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-bold text-hermes-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>

      {/* Email */}
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
        />
      </Field>

      {/* Phone */}
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

      {/* Password */}
      <Field
        label="Пароль"
        icon={<Lock className="w-4 h-4 text-neutral-400" />}
        error={errors.password}
        helper="Минимум 6 символов"
      >
        <input
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
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

      {/* Bonus chips — light reinforcement of "free start" right before the CTA */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-neutral-500 font-medium">
        <span className="inline-flex items-center gap-1">
          <Gift className="w-4 h-4 text-amber-500" /> 7 импульсов в подарок
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="w-4 h-4 text-emerald-500" /> Без карты
        </span>
      </div>

      {/* Clerk CAPTCHA mount point. Required when using a custom sign-up
          flow (useSignUp + signUp.create). Clerk renders Smart CAPTCHA
          here when needed; without this div Clerk silently falls back
          to invisible CAPTCHA which is less reliable. The div has zero
          visible footprint until Clerk decides to challenge a session. */}
      <div id="clerk-captcha" />

      {/* Form-level error (network failure, unexpected Clerk response, etc.) */}
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

      <button
        type="submit"
        disabled={isPending || !isLoaded}
        className="w-full bg-gradient-to-r from-hermes-500 to-amber-500 hover:from-hermes-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-hermes-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Создаём аккаунт…
          </>
        ) : (
          <>
            Создать аккаунт
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

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
    </form>
  );
}

/**
 * Single field wrapper — keeps the label + icon + input + helper +
 * inline-error pattern consistent across all 3 fields.
 */
function Field({
  label,
  icon,
  error,
  helper,
  children,
}: {
  label: string;
  icon: React.ReactNode;
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
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-neutral-50 border transition-colors ${
          error ? "border-rose-300 bg-rose-50" : "border-neutral-200 focus-within:border-hermes-500 focus-within:bg-white"
        }`}
      >
        {icon}
        {children}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-600 leading-snug">{error}</p>
      ) : helper ? (
        <p className="mt-1 text-xs text-neutral-400 leading-snug">{helper}</p>
      ) : null}
    </div>
  );
}
