/**
 * Session management for the in-house auth system. Uses signed JWTs
 * stored in an httpOnly cookie. The `jose` library is Edge-runtime
 * compatible — works in middleware, server components, server actions.
 *
 * Cookie name: `aicreative_session`
 * Algorithm:   HS256 (HMAC-SHA256)
 * Lifetime:    30 days, sliding (re-issued on each request via middleware
 *              if it's older than half its lifetime — TODO, post-launch)
 * Payload:     { uid, email, iat, exp }
 *
 * The JWT secret comes from env (`AUTH_JWT_SECRET`). Production needs
 * a strong random value (≥48 bytes); see .env.local for dev default.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "aicreative_session";
const SESSION_DURATION_SEC = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  /** Internal user id (matches users.id) */
  uid: string;
  /** Email at time of login — denormalized so we don't hit DB on every request */
  email: string;
}

let cachedKey: Uint8Array | null = null;
function getKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw) throw new Error("AUTH_JWT_SECRET env var is not set");
  cachedKey = new TextEncoder().encode(raw);
  return cachedKey;
}

/**
 * Sign a new session token. Pass to setSessionCookie() to actually
 * commit it to the response.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ uid: payload.uid, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(getKey());
}

/**
 * Verify a token. Returns the payload on success, null on invalid/
 * expired/missing. NEVER throws — callers can treat null as "not
 * logged in".
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return { uid: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Set the session cookie on the current Next response. Call from a
 * server action right after successful register/login.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SEC,
  });
}

/**
 * Clear the session cookie. Call from a logout action.
 */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Read the current session from the request cookies. Returns the
 * verified payload or null. Used inside server actions / server
 * components / api routes to get the current user id.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
