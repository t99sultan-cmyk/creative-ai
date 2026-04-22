"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

type Props = {
  /** Starting value. */
  from?: number;
  /** End value (exclusive — loop resets after reaching it). */
  to?: number;
  /** Milliseconds between each tick. */
  tickMs?: number;
  /** Suffix after the digits. */
  suffix?: string;
  className?: string;
};

/**
 * Looping countdown used in the hero. Shows "60, 59, 58, …, 1, 0" then
 * resets to 60 — visually hammers the "60 seconds to a creative" claim.
 *
 * Only ticks while in the viewport (useInView) + while the tab is visible
 * (document.visibilityState). Otherwise we'd burn React re-renders every
 * second for someone who closed the tab or scrolled past.
 */
export function CountdownLoop({
  from = 60,
  to = 0,
  tickMs = 1000,
  suffix = "",
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-50px" });
  const [n, setN] = useState(from);

  useEffect(() => {
    if (!inView) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      // Only count down when the tab is visible — no point burning CPU
      // on a counter the user can't see.
      if (typeof document !== "undefined" && document.hidden) return;
      setN((curr) => (curr <= to ? from : curr - 1));
    };

    id = setInterval(tick, tickMs);
    return () => {
      if (id !== null) clearInterval(id);
    };
  }, [inView, from, to, tickMs]);

  return (
    <span ref={ref} className={className}>
      <span className="tabular-nums inline-block min-w-[2ch] text-right">{n}</span>
      {suffix}
    </span>
  );
}
