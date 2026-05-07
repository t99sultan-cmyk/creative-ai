"use client";

import { motion, useInView } from "framer-motion";
import { ReactNode, useRef } from "react";

/**
 * Scroll-reveal wrapper used across all 4 marketing landings. Renders
 * its children, fades + lifts them in once they enter the viewport.
 *
 * `once: true` + `margin: "-100px"` matches the original inline
 * implementation in src/app/page.tsx — animation fires once per element
 * and slightly *before* it scrolls into view, so by the time the user
 * sees it the reveal is done (no flash of opacity-0 content).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
