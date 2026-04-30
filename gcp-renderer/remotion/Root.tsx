import React from "react";
import { Composition } from "remotion";
import { TextOverlay, textOverlaySchema } from "./TextOverlay";

/**
 * The Cloud Run /text-overlay endpoint passes durationInFrames + fps +
 * width + height as `inputProps` overrides via calculateMetadata, so the
 * defaults below only matter when previewing in Remotion Studio.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TextOverlay"
        component={TextOverlay}
        schema={textOverlaySchema}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: "https://example.com/sample.mp4",
          text: "Заголовок\nна 2 строки",
          accent: "#f37021",
        }}
        calculateMetadata={async ({ props }) => {
          // Probing the source video's exact duration + dimensions on
          // the server is doable via @remotion/media-utils / ffprobe,
          // but keeping the render at a fixed ratio is fine for the
          // MVP — the text overlay is the same shape regardless of
          // source length, and we always receive 5-sec clips from
          // fal.ai Seedance Fast.
          return { props };
        }}
      />
    </>
  );
};
