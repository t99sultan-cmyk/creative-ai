"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, User as UserIcon, LayoutGrid } from "lucide-react";
import { useAuth, useUser } from "@/lib/auth/AuthContext";

/**
 * Replacement for Clerk's <UserButton />. Renders a circular
 * avatar (initials fallback) that opens a dropdown menu with:
 *   - the user's email
 *   - link to /account
 *   - link to /editor
 *   - sign-out button
 *
 * Pure React, no external libs (uses framer-motion already installed
 * but no special animation here — just inline transition).
 */
export function UserMenu({
  appearance,
}: {
  /** Compat prop with Clerk's UserButton — accepted but ignored. */
  appearance?: unknown;
}) {
  void appearance;
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isSignedIn || !user) return null;

  const email = user.emailAddresses[0]?.emailAddress || "";
  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? email[0]?.toUpperCase() ?? "?");

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-gradient-to-tr from-hermes-500 to-amber-500 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-hermes-500/30 hover:scale-105 transition-transform overflow-hidden"
        aria-label="Меню профиля"
      >
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{initials.slice(0, 2).toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-black/10 ring-1 ring-neutral-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              Email
            </p>
            <p className="text-sm font-bold text-neutral-900 truncate">{email}</p>
          </div>
          <div className="py-1.5">
            <Link
              href="/editor"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-neutral-400" />
              Редактор
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <UserIcon className="w-4 h-4 text-neutral-400" />
              Личный кабинет
            </Link>
          </div>
          <div className="border-t border-neutral-100">
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
