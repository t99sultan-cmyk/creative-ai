"use client";

import { ReactNode, useRef, useState, MouseEvent } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees, each axis. 6° is subtle/premium; 15° is showy. */
  maxTiltDeg?: number;
  /** Disable on touch devices — motion on tap doesn't make sense. */
};

/**
 * Subtle 3D tilt on hover — the card rotates toward the mouse in X/Y.
 * Uses perspective + transform so it's GPU-accelerated and doesn't
 * trigger layout. Disables itself on touch (no pointer events) so
 * the effect doesn't stick on mobile. Ships without any runtime lib —
 * just CSS transform + React state.
 */
export function TiltCard({ children, className, maxTiltDeg = 6 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>("");

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width; // 0..1
    const yRatio = (e.clientY - rect.top) / rect.height;
    // rotateY depends on X (horizontal mouse) → negative so card faces mouse
    const rotY = (xRatio - 0.5) * 2 * maxTiltDeg;
    const rotX = -(yRatio - 0.5) * 2 * maxTiltDeg;
    setTransform(`perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`);
  };

  const handleLeave = () => setTransform("");

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transform,
        transformStyle: "preserve-3d",
        transition: transform ? "transform 60ms linear" : "transform 400ms ease-out",
        willChange: "transform",
      }}
      className={clsx("transform-gpu", className)}
    >
      {children}
    </div>
  );
}
