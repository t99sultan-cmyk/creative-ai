"use client";

import { forwardRef, type HTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Shared card primitive — white surface with neutral border.
 *
 * Three padding sizes match wizard/editor conventions. `hover` enables
 * the subtle lift + shadow that mirrors what the marketing landings
 * already do for product cards.
 *
 * Don't use this for hero mockups or other heavily-styled surfaces —
 * those want bespoke treatments. This is for FORMS, panels, and modal
 * containers where consistency is the win.
 */

type CardPadding = "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  hover?: boolean;
}

const PADDING: Record<CardPadding, string> = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", hover, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "rounded-2xl border border-neutral-200 bg-white shadow-sm",
        PADDING[padding],
        hover && "hover:shadow-lg hover:-translate-y-0.5 transition-all",
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = "Card";
