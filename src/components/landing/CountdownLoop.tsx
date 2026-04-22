"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

type Props = {
  /** Starting value. */
  from?: number;
  /** End value. When loop is true, resets back to `from` after reaching
   *  this. When loop is false, stops ticking and stays on this value. */
  to?: number;
  /** Milliseconds between each tick. */
  tickMs?: number;
  /** Suffix after the digits. */
  suffix?: string;
  /** If true (default), restart from `from` after hitting `to`. If false,
   *  the counter runs once `from` → `to` and then halts. */
  loop?: boolean;
  className?: string;
};

/**
 * Countdown used in the hero. Two modes:
 *
 *  - loop:true  → e.g. 60, 59, …, 0, 60, 59, … — visually hammers a "how
 *                 fast" promise by continuously replaying the descent.
 *  - loop:false → e.g. 120, 119, …, 10 and stops. One-shot animation that
 *                 settles on the bottom value, used when we want the final
 *                 number to stay visible (e.g. "our goal: 10 seconds").
 *
 * Only ticks while in the viewport (useInView) + while the tab is visible
 * (document.visibilityState). Otherwise we'd burn React re-renders for
 * someone who closed the tab or scrolled away.
 */
export function CountdownLoop({
  from = 60,
  to = 0,
  tickMs = 1000,
  suffix = "",
  loop = true,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-50px" });
  const [n, setN] = useState(from);

  useEffect(() => {
    if (!inView) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      setN((curr) => {
        if (curr <= to) {
          if (loop) return from; // restart
          // one-shot done — stop the interval so we don't waste ticks.
          if (id !== null) {
            clearInterval(id);
            id = null;
          }
          return to;
        }
        return curr - 1;
      });
    };

    id = setInterval(tick, tickMs);
    return () => {
      if (id !== null) clearInterval(id);
    };
  }, [inView, from, to, tickMs, loop]);

  return (
    <span ref={ref} className={className}>
      <span className="tabular-nums inline-block min-w-[3ch] text-right">{n}</span>
      {suffix}
    </span>
  );
}
