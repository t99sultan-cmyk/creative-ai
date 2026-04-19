import { Composition } from "remotion";
import { DynamicAdOverlay } from "./DynamicAdOverlay";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicAdOverlay"
        component={DynamicAdOverlay}
        durationInFrames={150} // 5 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Супер Акция",
          subheadline: "Только до конца недели скидка 50% на все товары",
          themeColor: "#FF4500",
          backgroundColor: "#111111",
          images: []
        }}
      />
    </>
  );
};
