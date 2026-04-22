"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gold particles backdrop for the final CTA section.
 *
 * Lazy-loads @tsparticles/slim from CDN only when the canvas scrolls
 * into view (IntersectionObserver). This keeps the landing's initial
 * bundle small — tsparticles is ~100 KB minified and most visitors
 * never reach the bottom of the page.
 *
 * Pure side-effect component: mounts a <canvas id> and calls
 * window.tsParticles.load(). No react-state for particles — they're
 * driven entirely by the library's own animation loop.
 */
declare global {
  interface Window {
    tsParticles?: any;
  }
}

export function GoldParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  // Observe — only boot particles when visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Load script + init particles once we're in view.
  useEffect(() => {
    if (!active) return;

    const SCRIPT_ID = "tsparticles-slim-cdn";
    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.tsParticles) return resolve();
        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject());
          return;
        }
        const s = document.createElement("script");
        s.id = SCRIPT_ID;
        s.src = "https://cdn.jsdelivr.net/npm/@tsparticles/slim@3/tsparticles.slim.bundle.min.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.head.appendChild(s);
      });

    let cancelled = false;
    ensureScript()
      .then(() => {
        if (cancelled || !window.tsParticles) return;
        window.tsParticles.load({
          id: "gold-particles-canvas",
          options: {
            fullScreen: { enable: false },
            background: { color: "transparent" },
            fpsLimit: 60,
            particles: {
              number: { value: 45, density: { enable: true, area: 800 } },
              color: { value: ["#FFD700", "#FFF3A3", "#F37021", "#FFFFFF"] },
              shape: { type: ["circle", "star"] },
              opacity: {
                value: { min: 0.3, max: 0.85 },
                animation: { enable: true, speed: 0.6, sync: false },
              },
              size: { value: { min: 1, max: 3.5 } },
              move: {
                enable: true,
                direction: "top",
                speed: { min: 0.4, max: 1.4 },
                straight: false,
                outModes: { default: "out" },
                random: true,
              },
              rotate: {
                value: { min: 0, max: 360 },
                animation: { enable: true, speed: 5, sync: false },
              },
              twinkle: {
                particles: {
                  enable: true,
                  frequency: 0.08,
                  opacity: 1,
                  color: { value: "#FFF" },
                },
              },
            },
            detectRetina: true,
          },
        });
      })
      .catch(() => {
        // Silently ignore — particles are decorative, not load-blocking.
      });

    return () => {
      cancelled = true;
      try {
        window.tsParticles?.domItem(0)?.destroy();
      } catch {}
    };
  }, [active]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0">
      <canvas id="gold-particles-canvas" className="w-full h-full" />
    </div>
  );
}
