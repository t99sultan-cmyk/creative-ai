"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Shared button primitive.
 *
 * Most app surfaces have already-themed buttons (per-product gradients,
 * specific shadows). This is for NEUTRAL UI where consistency matters
 * more than expression: cancel, close, "back to list", etc.
 *
 * Variants:
 *   - primary  → dark, used for primary action when product gradient
 *                isn't a fit (e.g., modals, settings)
 *   - secondary→ light grey, default action
 *   - ghost    → text-only with hover, secondary actions
 *   - danger   → red, destructive
 *
 * Sizes follow tailwind text scale: sm (12px) / md (14px) / lg (16px).
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 hover:bg-black text-white",
  secondary: "bg-neutral-100 hover:bg-neutral-200 text-neutral-700",
  ghost: "bg-transparent hover:bg-neutral-100 text-neutral-700",
  danger: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2.5 rounded-xl",
  lg: "text-base px-6 py-3 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, disabled, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...rest}
      >
        {loading ? <span className="animate-pulse">…</span> : children}
      </button>
    );
  },
);
Button.displayName = "Button";
