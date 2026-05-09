/**
 * Password hashing utility for the in-house auth system. Uses bcryptjs
 * (pure-JS bcrypt) with a cost factor of 10, which is the standard
 * tradeoff between hash strength and CPU time on Vercel's serverless
 * runtime — ~80ms per hash on a typical Lambda.
 *
 * Lives only in server-side code paths (server actions, API routes).
 * Never call from client components.
 */

import bcrypt from "bcryptjs";

/** Cost factor — 2^10 = 1024 rounds. ~80ms per hash. */
const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password. Result is a self-contained string that
 * embeds the cost factor and salt — store it as-is in users.password_hash.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored hash. Returns true on
 * match. Constant-time comparison via bcrypt internals — safe against
 * timing attacks.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    // Malformed hash → don't crash the login flow, just return false.
    return false;
  }
}
