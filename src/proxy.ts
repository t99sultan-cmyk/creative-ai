import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * In-house auth middleware. Replaces Clerk's clerkMiddleware after
 * the May 2026 migration to bcrypt + JWT-cookie sessions.
 *
 * Logic:
 *   1. Public routes (/, /register, /login, /onboarding, /api/webhooks/...)
 *      pass through.
 *   2. Protected routes verify the session cookie (HMAC-signed JWT,
 *      Edge-compatible via `jose`). Missing/invalid → redirect to
 *      /login (HTML pages) or 401 JSON (API routes).
 *   3. Admin pages and API admin routes get an extra layer at their
 *      own level (src/app/admin/layout.tsx, src/lib/admin-guard.ts) —
 *      this middleware only enforces "logged in", not "is admin".
 *
 * Edge-runtime constraints: NO database access here, NO bcrypt. Only
 * the JWT signature gets verified from the cookie value. If the token
 * is forged we redirect; if a real user has a deleted DB row their
 * token still validates here but downstream `getServerUser()` will
 * return null and the page handler can react.
 */

const PROTECTED_PREFIXES = [
  "/editor",
  "/admin",
  "/api/restricted",
  "/api/admin",
];

const API_PREFIXES = ["/api/"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some((p) => pathname.startsWith(p));
}

let cachedKey: Uint8Array | null = null;
function getKey(): Uint8Array | null {
  if (cachedKey) return cachedKey;
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw) return null;
  cachedKey = new TextEncoder().encode(raw);
  return cachedKey;
}

async function isSessionValid(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const key = getKey();
  if (!key) return false;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return typeof payload.uid === "string";
  } catch {
    return false;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const ok = await isSessionValid(req);
  if (ok) return NextResponse.next();

  if (isApiPath(pathname)) {
    return new NextResponse(JSON.stringify({ error: "Не авторизован" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // HTML page → redirect to /login with the original URL as ?redirect=
  // so the user lands back where they were trying to go.
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
