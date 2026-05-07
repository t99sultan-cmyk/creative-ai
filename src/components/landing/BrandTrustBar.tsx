"use client";

import { Reveal } from "./Reveal";

/**
 * Client-logos strip — establishes social proof early in the page.
 * Identical content across all 4 landings (we sell to the same
 * audience), so this lives once here and the landings just include it.
 *
 * Placeholder text styling — once we have actual SVG logos, swap each
 * <span> for a sized <Image>. Centralizing here means that swap
 * happens once and propagates to all 4 landings.
 */
const CLIENT_LOGOS = [
  "Kaspi",
  "Magnum",
  "Chocofamily",
  "Technodom",
  "Halyk",
  "Beeline",
  "Forte",
  "mChocolate",
];

export function BrandTrustBar() {
  return (
    <section
      aria-label="Наши клиенты"
      className="py-10 relative border-y border-neutral-100 bg-white/50 backdrop-blur-sm overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4">
        <Reveal>
          <p className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-6">
            Нам доверяют команды
          </p>
        </Reveal>
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {CLIENT_LOGOS.map((name) => (
              <span
                key={name}
                className="text-sm sm:text-base font-bold text-neutral-400 hover:text-neutral-600 transition-colors tracking-wide"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
