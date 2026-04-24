"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight one-shot confetti overlay — no canvas, no dependency, just
 * ~60 absolutely-positioned divs that fall and spin for a few seconds
 * after mount. Intended for celebratory moments (post-signup welcome);
 * not for continuous animation.
 *
 * Mount as the first child of a `relative` / `fixed` container. The
 * component renders a pointer-events: none overlay so it doesn't block
 * clicks underneath.
 *
 * Removes itself from the DOM after `durationMs` to free up paint work.
 */
export function Confetti({
  pieces = 60,
  durationMs = 4500,
}: {
  pieces?: number;
  durationMs?: number;
}) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setActive(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  if (!active) return null;

  const colors = [
    "#f37021", // hermes-500 (brand)
    "#ffa86e", // hermes-300
    "#fbbf24", // amber-400
    "#fde68a", // amber-200
    "#ffffff",
    "#22d3ee", // cyan-400 — for contrast
    "#a78bfa", // violet-400
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden z-20"
    >
      {Array.from({ length: pieces }).map((_, i) => {
        const left = Math.random() * 100;
        const size = 6 + Math.random() * 8;
        const delay = Math.random() * 0.6;
        const dur = 2.8 + Math.random() * 1.8;
        const rotateStart = Math.random() * 360;
        const rotateEnd = rotateStart + (Math.random() * 540 - 270);
        const xDrift = (Math.random() * 2 - 1) * 80;
        const color = colors[i % colors.length];
        const isCircle = Math.random() < 0.35;

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-8%",
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * (isCircle ? 1 : 1.6)}px`,
              backgroundColor: color,
              borderRadius: isCircle ? "50%" : "2px",
              opacity: 0.9,
              // @ts-ignore custom CSS vars
              "--x-drift": `${xDrift}px`,
              "--rotate-start": `${rotateStart}deg`,
              "--rotate-end": `${rotateEnd}deg`,
              animation: `confetti-fall ${dur}s cubic-bezier(0.2, 0.7, 0.4, 1) ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translate(0, 0) rotate(var(--rotate-start));
            opacity: 0;
          }
          10% { opacity: 0.95; }
          100% {
            transform: translate(var(--x-drift), 110vh) rotate(var(--rotate-end));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
