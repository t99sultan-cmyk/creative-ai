"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// Re-export so existing call sites can import UserMenu from this same
// barrel (the codebase used `import { UserButton, useAuth } from "@clerk/nextjs"`,
// after sed it became `import { UserMenu, useAuth } from "@/lib/auth/AuthContext"`).
export { UserMenu } from "@/components/auth/UserMenu";

/**
 * Client-side auth state. Replaces Clerk's <ClerkProvider>, useAuth(),
 * useUser(), useClerk() — exposes the same shapes from one provider so
 * legacy callers can be swapped one-for-one.
 *
 * Boots by fetching `/api/me` once on mount (handles SSR-cookie hand-off),
 * then exposes:
 *   - useAuth(): { isSignedIn, isLoaded, userId, signOut }
 *   - useUser(): { user, isSignedIn, isLoaded }
 *   - useClerk(): { signOut }   (legacy compat for ImpersonationBanner)
 *
 * The `user` object on useUser mirrors the subset of Clerk's User the
 * codebase actually accesses — emailAddresses[0], firstName, imageUrl, etc.
 */

export interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
}

/** Shape mimicking Clerk's User on the fields the codebase reads */
interface ClerkLikeClientUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  username: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore — clearing the cookie can fail if network is down,
      // we'll still try to redirect.
    }
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value: AuthContextValue = {
    user,
    isLoaded,
    isSignedIn: user != null,
    signOut,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Permissive fallback — instead of crashing on every render before
    // the provider mounts, return an "unloaded, signed-out" state.
    return {
      user: null,
      isLoaded: false,
      isSignedIn: false,
      signOut: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}

/**
 * Drop-in replacement for Clerk's `useAuth()`. Returns the subset of
 * fields the codebase actually destructures.
 */
export function useAuth() {
  const { user, isLoaded, isSignedIn, signOut, refresh } = useCtx();
  return {
    isLoaded,
    isSignedIn,
    userId: user?.userId ?? null,
    sessionId: user ? "session" : null,
    signOut,
    /** Re-fetch /api/me — call after a server-side login/register so the
     *  client-side context picks up the new session cookie immediately
     *  (e.g. so RegistrationTracker can see the freshly-set user). */
    refresh,
  };
}

/**
 * Drop-in replacement for Clerk's `useUser()`. The `user` object has
 * the same shape as Clerk's User on the fields we consume.
 */
export function useUser(): {
  user: ClerkLikeClientUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
} {
  const { user, isLoaded, isSignedIn } = useCtx();
  if (!user) return { user: null, isLoaded, isSignedIn };

  const fullName = user.name ?? "";
  const [firstName, ...rest] = fullName.split(" ");
  return {
    user: {
      id: user.userId,
      emailAddresses: [{ emailAddress: user.email }],
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      imageUrl: user.image ?? "",
      username: null,
    },
    isLoaded,
    isSignedIn,
  };
}

/**
 * Drop-in replacement for Clerk's `useClerk()`. Only `signOut` is used
 * by the codebase (in ImpersonationBanner).
 */
export function useClerk() {
  const { signOut } = useCtx();
  return { signOut };
}
