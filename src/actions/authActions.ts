"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";
import { notifyAdmin, fmt } from "@/lib/admin-notify";
import { isRegistrationOpen } from "@/lib/flags";
import { cookies } from "next/headers";

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

  // Uniqueness check + legacy-account upgrade.
  // If the email already exists, two cases:
  //   (a) row has password_hash → real account, owner should sign in
  //       not register again
  //   (b) row has NO password_hash → legacy Clerk-era account, the
  //       user can't recover the original password. Treat this signup
  //       as "set my password and adopt this row" — preserves their
  //       existing creatives/impulses.
  const existing = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const passwordHash = await hashPassword(password);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.passwordHash) {
      return {
        success: false,
        error: "Этот email уже зарегистрирован — введи пароль чтобы войти.",
        field: "email",
      };
    }
    // Legacy upgrade — set password on the orphaned row, also (re)set
    // phone if the form provided one. We DON'T touch impulses, name,
    // image, welcomeShown — keep all the user's existing state.
    try {
      await db
        .update(users)
        .set({
          passwordHash,
          phone: input.phone || null,
        })
        .where(eq(users.id, row.id));
    } catch (err) {
      console.error("[registerUser] legacy upgrade failed:", err);
      return { success: false, error: "Не получилось обновить аккаунт. Попробуй ещё раз." };
    }

    const token = await signSessionToken({ uid: row.id, email });
    await setSessionCookie(token);

    void notifyAdmin(
      `🔄 *Legacy upgrade* (Clerk → in-house)\n\n*Email:* ${fmt.esc(email)}\n*ID:* \`${fmt.esc(row.id)}\``,
    ).catch(() => {});

    return { success: true, redirect: "/editor" };
  }

  const userId = generateUserId();
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
  // CompleteRegistration → clears the cookie.
  try {
    const cookieJar = await cookies();
    cookieJar.set("fb_just_registered", "1", {
      httpOnly: false, // pixel is browser-side; needs JS access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 5,
    });
  } catch (cookieErr) {
    // Cookie write failures shouldn't block the user from getting in.
    console.warn("[registerUser] fb_just_registered cookie set failed:", cookieErr);
  }

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
