"use client";

import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Animated brand logo for the auth pages. Replaces the static
 * gradient-square + Sparkles inline pattern that had two issues on
 * some devices:
 *   1) Tailwind's `bg-gradient-to-tr` rendered with a visible seam
 *      between hermes-orange and amber-yellow on certain Android
 *      browsers (low-end Mali GPUs).
 *   2) The Sparkles icon at w-7 inside a w-14 box looked cropped
 *      because of the 2.5rem padding ratio.
 *
 * Fixes:
 *   - Conic gradient for smoother color transition (no seam)
 *   - Inner white-glow overlay (semi-transparent, blurred) gives
 *     the icon a soft halo and hides any remaining gradient edges
 *   - Subtle scale + glow pulse animation (3s loop) — adds life
 *     without being distracting
 *   - Larger icon-to-box ratio (w-8 inside w-16) so Sparkles
 *     reads as the centerpiece, not a tiny dot
 *
 * Sizes: small (h-9, navbar) and large (h-16, auth header).
 */
export function AnimatedLogo({
  size = "lg",
  withWordmark = true,
}: {
  size?: "sm" | "lg";
  withWordmark?: boolean;
}) {
  const isSmall = size === "sm";
  return (
    <div className={`inline-flex items-center ${isSmall ? "gap-2" : "gap-3"}`}>
      <motion.div
        className={`relative flex items-center justify-center rounded-2xl ${
          isSmall ? "w-9 h-9 rounded-xl" : "w-16 h-16"
        }`}
        style={{
          background:
            "conic-gradient(from 220deg at 50% 50%, #f37021 0%, #fbbf24 50%, #f37021 100%)",
        }}
        animate={{
          scale: [1, 1.04, 1],
          boxShadow: [
            "0 8px 24px -8px rgba(243, 112, 33, 0.45)",
            "0 12px 32px -6px rgba(243, 112, 33, 0.65)",
            "0 8px 24px -8px rgba(243, 112, 33, 0.45)",
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Inner white-glow overlay — halos the icon, smooths the
            conic-gradient edges. Doesn't intercept clicks. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/30 to-transparent pointer-events-none"
        />
        <Sparkles
          className={`relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] ${
            isSmall ? "w-5 h-5" : "w-8 h-8"
          }`}
          strokeWidth={2.5}
        />
      </motion.div>
      {withWordmark && (
        <span
          className={`font-black tracking-tight text-neutral-900 ${
            isSmall ? "text-xl" : "text-2xl"
          }`}
        >
          AICreative
        </span>
      )}
    </div>
  );
}
