"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

type Props = {
  /** Target number to count up to. */
  to: number;
  /** Prefix glued to the digits (e.g. "+"). */
  prefix?: string;
  /** Suffix glued to the digits (e.g. "%", "+", "с"). */
  suffix?: string;
  /** Decimal places (default 0 = integer). */
  decimals?: number;
  /** Duration in seconds for the count-up. Longer = smoother but less punchy. */
  duration?: number;
  /** Trigger only the first time it enters view. Resets = false means count
   *  once and stop. */
  once?: boolean;
  className?: string;
};

/**
 * Number that counts up from 0 → `to` when scrolled into view.
 *
 * Uses framer-motion's useMotionValue + useSpring for natural deceleration
 * (not a linear tween). This looks more "alive" than CSS keyframes and
 * costs a single motion value per counter — negligible.
 *
 * Number is rendered with `ru-RU` locale so 2400 → "2 400" (thin space),
 * matching how Russian audiences read large numbers.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.6,
  once = true,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, margin: "-80px" });
  const motion = useMotionValue(0);
  // Spring-smoothed value — matches the count-up duration.
  const spring = useSpring(motion, {
    stiffness: 60,
    damping: 16,
    duration: duration * 1000,
  });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motion.set(to);
  }, [inView, motion, to]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      const n = decimals > 0 ? v : Math.round(v);
      setDisplay(
        n.toLocaleString("ru-RU", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      );
    });
    return unsub;
  }, [spring, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
