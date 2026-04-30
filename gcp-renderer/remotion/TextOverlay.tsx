import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { z } from "zod";

/**
 * Single Composition: text headline animated on top of an input video.
 *
 * Inputs (zod-validated):
 *   videoUrl:  remote MP4 URL (the fal.ai output we want to overlay text on)
 *   text:      headline string (1-2 short lines work best; long copy gets clipped)
 *   accent:    optional hex color for the underline / accent bar (defaults to brand orange)
 *
 * Layout:
 *   - Background = OffthreadVideo (Remotion's recommended way to render
 *     remote video sources server-side; uses ffmpeg internally to seek
 *     deterministically frame by frame).
 *   - Foreground text: bottom-third, large bold sans, letter-by-letter
 *     entrance via spring + a horizontal accent line that wipes from left.
 *   - Slight vignette over bottom half to keep text legible regardless
 *     of what's in the video.
 *
 * Why "OffthreadVideo" and not "<Video>": <Video> uses HTMLVideoElement
 * which is non-deterministic during headless render (frames may be
 * skipped or re-decoded). OffthreadVideo is the official Remotion
 * solution for SSR — official docs explicitly recommend it.
 */

export const textOverlaySchema = z.object({
  videoUrl: z.string().url(),
  text: z.string().min(1).max(120),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f37021"),
});

export type TextOverlayProps = z.infer<typeof textOverlaySchema>;

export const TextOverlay: React.FC<TextOverlayProps> = ({ videoUrl, text, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const accentLineProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
    durationInFrames: Math.round(fps * 0.9),
  });

  const lines = text.split("\n").slice(0, 2);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={videoUrl} muted />

      {/* Bottom vignette — gradient under the text for legibility. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Headline. Per-character spring entrance with stagger. */}
      <AbsoluteFill
        style={{
          padding: width > height ? "0 9%" : "0 7%",
          paddingBottom: width > height ? "12%" : "18%",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
          color: "#ffffff",
          textShadow: "0 2px 14px rgba(0,0,0,0.55)",
        }}
      >
        {/* Accent bar wiping in from the left */}
        <div
          style={{
            width: `${accentLineProgress * 64}px`,
            height: 6,
            background: accent,
            marginBottom: 18,
            borderRadius: 4,
            boxShadow: `0 0 16px ${accent}`,
          }}
        />
        {lines.map((line, lineIdx) => (
          <div
            key={lineIdx}
            style={{
              fontSize: width > height ? 78 : 96,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.05,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {Array.from(line).map((ch, i) => {
              // Stagger the character entrance over ~0.4s, with each line
              // offset so the second line starts after the first finishes.
              const delay = lineIdx * 8 + i * 1.2;
              const t = spring({
                frame: frame - delay,
                fps,
                config: { damping: 12, stiffness: 110, mass: 0.7 },
                durationInFrames: Math.round(fps * 0.8),
              });
              const y = interpolate(t, [0, 1], [40, 0]);
              const opacity = interpolate(t, [0, 1], [0, 1]);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    transform: `translateY(${y}px)`,
                    opacity,
                    whiteSpace: ch === " " ? "pre" : undefined,
                  }}
                >
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
