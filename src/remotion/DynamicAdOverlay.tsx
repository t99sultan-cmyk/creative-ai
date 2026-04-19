import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img } from "remotion";

export const DynamicAdOverlay: React.FC<{
  headline: string;
  subheadline: string;
  themeColor: string;
  backgroundColor: string;
  images: string[];
}> = ({ headline, subheadline, themeColor, backgroundColor, images }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const titleEntrance = spring({
    fps,
    frame: frame - 10,
    config: { damping: 12 },
  });

  const subtitleEntrance = spring({
    fps,
    frame: frame - 15,
    config: { damping: 12 },
  });

  const productEntrance = spring({
    fps,
    frame: frame - 20,
    config: { damping: 14, mass: 0.8 },
  });

  // Interpolations
  const titleTranslateY = interpolate(titleEntrance, [0, 1], [50, 0]);
  const titleOpacity = interpolate(titleEntrance, [0, 1], [0, 1]);

  const subTranslateY = interpolate(subtitleEntrance, [0, 1], [50, 0]);
  const subOpacity = interpolate(subtitleEntrance, [0, 1], [0, 1]);

  const prodScale = interpolate(productEntrance, [0, 1], [0.8, 1]);
  const prodOpacity = interpolate(productEntrance, [0, 1], [0, 1]);

  // Floating effect for product
  const floatY = interpolate(Math.sin(frame / 15), [-1, 1], [-15, 15]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "100px 60px",
        color: "#fff",
      }}
    >
      {/* Dynamic Background Glow */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          width: "800px",
          height: "800px",
          background: `radial-gradient(circle, ${themeColor} 0%, transparent 60%)`,
          transform: "translate(-50%, -50%)",
          opacity: 0.3,
          filter: "blur(100px)",
        }}
      />

      <div style={{ zIndex: 10, textAlign: "center", width: "100%" }}>
        <h1
          style={{
            fontSize: "80px",
            fontWeight: 900,
            lineHeight: 1.1,
            margin: 0,
            textTransform: "uppercase",
            transform: `translateY(${titleTranslateY}px)`,
            opacity: titleOpacity,
            textShadow: "0 10px 20px rgba(0,0,0,0.3)",
          }}
        >
          {headline.split("\\n").map((line, i) => (
             <React.Fragment key={i}>
               {line}<br/>
             </React.Fragment>
          ))}
        </h1>
        <p
          style={{
            fontSize: "40px",
            fontWeight: 500,
            marginTop: "30px",
            opacity: subOpacity,
            transform: `translateY(${subTranslateY}px)`,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {subheadline}
        </p>
      </div>

      {images && images.length > 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            zIndex: 10,
            opacity: prodOpacity,
            transform: `scale(${prodScale}) translateY(${floatY}px)`,
          }}
        >
          <Img
            src={images[0]}
            style={{
              maxWidth: "100%",
              maxHeight: "800px",
              objectFit: "contain",
              filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.5))",
            }}
          />
        </div>
      )}

      {/* Footer Banner */}
      <div
        style={{
          width: "100%",
          padding: "40px",
          backgroundColor: themeColor,
          borderRadius: "30px",
          textAlign: "center",
          zIndex: 10,
          transform: `translateY(${interpolate(spring({ fps, frame: frame - 30, config: { damping: 12 } }), [0, 1], [150, 0])}px)`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ fontSize: "50px", fontWeight: 900, color: "#fff", textTransform: "uppercase" }}>ЗАКАЗАТЬ СЕЙЧАС</span>
      </div>
    </AbsoluteFill>
  );
};
