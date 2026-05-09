"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";
import { notifyAdmin, fmt } from "@/lib/admin-notify";
import { isRegistrationOpen } from "@/lib/flags";

/**
 * In-house auth server actions. Replace Clerk's useSignUp/useSignIn
 * hooks. These run on the server, talk directly to our DB, and set
 * the session cookie themselves.
 *
 * Threat model:
 *   - Email + password are submitted over HTTPS (handled by Vercel)
 *   - Password hashing: bcrypt cost 10 in src/lib/auth/password.ts
 *   - Session: HMAC-signed JWT, httpOnly cookie, 30-day TTL
 *   - Bot protection: NONE in this iteration (Clerk's CAPTCHA is gone).
 *     If signup spam becomes a problem we add hCaptcha or a honeypot
 *     field as a follow-up.
 */

const SUCCESS = { success: true as const };

interface FailureResult {
  success: false;
  error: string;
  /** Set to "email" | "password" | "phone" when the error should
   *  highlight a specific form field. */
  field?: "email" | "password" | "phone";
}

interface SuccessResult {
  success: true;
  /** Where the form should navigate next */
  redirect: string;
}

type AuthResult = SuccessResult | FailureResult;

function generateUserId(): string {
  // 24-byte random hex = 48 chars. Plenty of entropy, no collisions
  // at human-scale user counts.
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Register a new account. Email + password are required; phone is
 * optional (saved if provided, written to users.phone). On success,
 * a session cookie is set and the function returns the redirect path.
 *
 * The optional phone is normalized & validated by the caller (the
 * form already does both). We trust it here.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  if (!isRegistrationOpen()) {
    return { success: false, error: "Регистрация временно закрыта. Скоро вернёмся." };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: "Введите корректный email", field: "email" };
  }
  if (!password || password.length < 7) {
    return { success: false, error: "Минимум 7 символов", field: "password" };
  }

  // Uniqueness check: hit the unique index. If a row already exists
  // we tell the caller so the form can flip to login mode.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return {
      success: false,
      error: "Этот email уже зарегистрирован — введи пароль чтобы войти.",
      field: "email",
    };
  }

  const userId = generateUserId();
  const passwordHash = await hashPassword(password);
  const name = email.split("@")[0];

  try {
    await db.insert(users).values({
      id: userId,
      email,
      name,
      image: "",
      passwordHash,
      impulses: SIGNUP_BONUS_IMPULSES,
      phone: input.phone || null,
      welcomeShown: false,
      isBanned: false,
    });
  } catch (err: any) {
    // Duplicate-email race (unique constraint violation) — same
    // recovery as the pre-check above.
    if (err?.code === "23505" || /unique/i.test(err?.message ?? "")) {
      return {
        success: false,
        error: "Этот email уже зарегистрирован — введи пароль чтобы войти.",
        field: "email",
      };
    }
    console.error("[registerUser] insert failed:", err);
    return { success: false, error: "Не получилось создать аккаунт. Попробуй ещё раз." };
  }

  // Sign session + set cookie
  const token = await signSessionToken({ uid: userId, email });
  await setSessionCookie(token);

  // Short-lived "fresh registration" cookie. Read by the client-side
  // RegistrationTracker on next mount → fires Meta Pixel
  // CompleteRegistration → clears the cookie. Path "/" so it's visible
  // wherever the tracker happens to mount first.
  const cookieJar = await import("next/headers").then((m) => m.cookies());
  cookieJar.set("fb_just_registered", "1", {
    httpOnly: false, // pixel is browser-side; needs JS access
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5, // 5 min — the tracker fires on the very next page load
  });

  // Telegram notification — fire-and-forget so a slow Telegram API
  // doesn't block the redirect.
  void notifyAdmin(
    `🆕 *Новая регистрация*\n\n` +
      `*Email:* ${fmt.esc(email)}\n` +
      (input.phone ? `*Телефон:* \`${fmt.esc(input.phone)}\`\n` : "") +
      `*ID:* \`${fmt.esc(userId)}\`\n` +
      `*Бонус:* +${SIGNUP_BONUS_IMPULSES} ⚡`,
  ).catch(() => {});

  // Skip /onboarding — the user already gave us email + phone in the
  // signup form, so the welcome wizard's only purpose (capturing those
  // contacts) is moot. Send them straight to the editor where they
  // can spend their welcome impulses.
  return { success: true, redirect: "/editor" };
}

/**
 * Authenticate an existing user. On success sets the session cookie
 * and returns the redirect path. On failure returns a localized error.
 */
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: "Введите корректный email", field: "email" };
  }
  if (!password) {
    return { success: false, error: "Введите пароль", field: "password" };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];

  // Constant-time-ish — perform a dummy bcrypt compare even when the
  // user doesn't exist, so account-enumeration via response timing is
  // harder. The dummy hash is bcrypt of an empty string at cost 10.
  const DUMMY_HASH =
    "$2a$10$CwTycUXWue0Thq9StjUM0uJ8VTCGFv4G2KAj.vN1sTo5K/B5Zj.6e";
  const targetHash = user?.passwordHash || DUMMY_HASH;
  const ok = await verifyPassword(password, targetHash);

  if (!user) {
    return {
      success: false,
      error: "Аккаунта с таким email нет. Зарегистрируйся ниже.",
      field: "email",
    };
  }
  if (user.isBanned) {
    return {
      success: false,
      error: "Аккаунт заблокирован. Напиши в Telegram @voise_kz.",
    };
  }
  if (!user.passwordHash) {
    // Legacy Clerk user — they never set a password in our system.
    // Tell them to register again. Once we add /forgot-password we
    // can replace this with a reset link.
    return {
      success: false,
      error:
        "Старый аккаунт. Зарегистрируйся заново — мы переходим на новую систему авторизации.",
      field: "email",
    };
  }
  if (!ok) {
    return { success: false, error: "Пароль неверный. Попробуй ещё раз.", field: "password" };
  }

  // Issue session
  const token = await signSessionToken({ uid: user.id, email: user.email });
  await setSessionCookie(token);

  return { success: true, redirect: "/editor" };
}

/**
 * Drop the session cookie. Idempotent — safe to call from anywhere
 * (e.g. a logout button that fires-and-forgets).
 */
export async function logoutUser(): Promise<{ success: true }> {
  await clearSessionCookie();
  return SUCCESS;
}

/**
 * Probe whether an email already has an account. Used by the auth
 * form's "smart email detection" — when the user types a recognized
 * email we collapse the phone field and switch to login mode.
 *
 * Returns { exists: boolean }. Doesn't reveal anything more than a
 * regular login attempt would (and the form is already public).
 */
export async function checkEmailExists(emailRaw: string): Promise<{ exists: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { exists: false };
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return { exists: rows.length > 0 };
}
