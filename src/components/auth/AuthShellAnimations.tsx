"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Shared decorative animations for the auth pages (/register, /login).
 * Three small components:
 *   - <AuthBackground />   floating ambient blobs behind the form card
 *   - <ShimmerButton />    CTA button with a slow left-right shimmer
 *   - <FieldStagger />     wraps a list of children, fade-in with stagger
 *
 * Why these specifically:
 *   - The auth flow is the most-bounced page in the app. Subtle
 *     motion shows "this is alive, not broken" while the user reads.
 *   - All animations are CSS / framer-motion, no external libs.
 *   - prefers-reduced-motion is respected via globals.css media rule.
 */

/**
 * Two soft blur-circles drifting behind the form card. Pure decoration.
 * Pointer-events-none so they never block taps.
 */
export function AuthBackground() {
  return (
    <>
      <motion.div
        aria-hidden
        className="absolute top-[10%] left-[-10%] w-[420px] h-[420px] rounded-full bg-hermes-500/20 blur-[120px] pointer-events-none"
        animate={{
          y: [0, 30, 0],
          x: [0, 20, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-[5%] right-[-15%] w-[480px] h-[480px] rounded-full bg-amber-400/20 blur-[140px] pointer-events-none"
        animate={{
          y: [0, -40, 0],
          x: [0, -20, 0],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        aria-hidden
        className="absolute top-[40%] right-[20%] w-[260px] h-[260px] rounded-full bg-rose-300/15 blur-[100px] pointer-events-none"
        animate={{
          y: [0, 25, 0],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </>
  );
}

/**
 * Wraps a button-like element and overlays a moving shimmer band.
 * The band moves left-to-right every 3 seconds, then resets — feels
 * like the button is "ready and waiting" without being aggressive.
 *
 * Use as the outermost element of the CTA, with the actual <button>
 * or <Link> nested inside via children.
 */
export function ShimmerButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {children}
      <motion.span
        aria-hidden
        className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
        initial={{ x: "-150%" }}
        animate={{ x: "350%" }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          repeatDelay: 1.6,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

/**
 * Fades in a list of children one after another. Pass an array of
 * elements (typically form fields) and they appear with a 0.08s
 * delay each, starting from optional initialDelay.
 *
 * Used to give the form a sense of "assembling itself" on load —
 * keeps the user's eye moving down the form naturally.
 */
export function FieldStagger({
  children,
  initialDelay = 0,
}: {
  children: ReactNode[];
  initialDelay?: number;
}) {
  return (
    <>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: initialDelay + i * 0.08,
            ease: "easeOut",
          }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
