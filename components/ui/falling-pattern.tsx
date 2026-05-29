"use client";

import type React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type FallingPatternProps = React.ComponentProps<"div"> & {
  color?: string;
  backgroundColor?: string;
  duration?: number;
  blurIntensity?: string;
  density?: number;
  scale?: number;
  direction?: "up" | "down" | "left" | "right" | "diagonal";
};

export function FallingPattern({
  color = "var(--primary)",
  backgroundColor = "var(--background)",
  duration = 150,
  blurIntensity = "1em",
  density = 1,
  scale = 1,
  direction = "down",
  className,
}: FallingPatternProps) {
  const generateBackgroundImage = () => {
    const patterns = [
      `radial-gradient(4px 100px at 0px 235px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 235px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 117.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 252px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 252px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 126px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 150px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 150px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 75px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 253px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 253px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 126.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 204px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 204px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 102px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 134px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 134px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 67px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 179px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 179px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 89.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 299px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 299px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 149.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 215px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 215px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 107.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 281px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 281px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 140.5px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 158px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 158px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 79px, ${color} 100%, transparent 150%)`,
      `radial-gradient(4px 100px at 0px 210px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px 210px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px 105px, ${color} 100%, transparent 150%)`,
    ];
    return patterns.join(", ");
  };

  const rawSizes = [
    [300, 235], [300, 235], [300, 235],
    [300, 252], [300, 252], [300, 252],
    [300, 150], [300, 150], [300, 150],
    [300, 253], [300, 253], [300, 253],
    [300, 204], [300, 204], [300, 204],
    [300, 134], [300, 134], [300, 134],
    [300, 179], [300, 179], [300, 179],
    [300, 299], [300, 299], [300, 299],
    [300, 215], [300, 215], [300, 215],
    [300, 281], [300, 281], [300, 281],
    [300, 158], [300, 158], [300, 158],
    [300, 210], [300, 210], [300, 210],
  ];
  const backgroundSizes = rawSizes
    .map(([w = 0, h = 0]) => `${w * scale}px ${h * scale}px`)
    .join(", ");

  const startPositions =
    "0px 220px, 3px 220px, 151.5px 337.5px, 25px 24px, 28px 24px, 176.5px 150px, 50px 16px, 53px 16px, 201.5px 91px, 75px 224px, 78px 224px, 226.5px 230.5px, 100px 19px, 103px 19px, 251.5px 121px, 125px 120px, 128px 120px, 276.5px 187px, 150px 31px, 153px 31px, 301.5px 120.5px, 175px 235px, 178px 235px, 326.5px 384.5px, 200px 121px, 203px 121px, 351.5px 228.5px, 225px 224px, 228px 224px, 376.5px 364.5px, 250px 26px, 253px 26px, 401.5px 105px, 275px 75px, 278px 75px, 426.5px 180px";

  const endPositions =
    "0px 6800px, 3px 6800px, 151.5px 6917.5px, 25px 13632px, 28px 13632px, 176.5px 13758px, 50px 5416px, 53px 5416px, 201.5px 5491px, 75px 17175px, 78px 17175px, 226.5px 17301.5px, 100px 5119px, 103px 5119px, 251.5px 5221px, 125px 8428px, 128px 8428px, 276.5px 8495px, 150px 9876px, 153px 9876px, 301.5px 9965.5px, 175px 13391px, 178px 13391px, 326.5px 13540.5px, 200px 14741px, 203px 14741px, 351.5px 14848.5px, 225px 18770px, 228px 18770px, 376.5px 18910.5px, 250px 5082px, 253px 5082px, 401.5px 5161px, 275px 6375px, 278px 6375px, 426.5px 6480px";

  const rotationMap = { down: "0deg", up: "180deg", right: "90deg", left: "270deg", diagonal: "135deg" };
  const rotation = rotationMap[direction as keyof typeof rotationMap] ?? "0deg";
  const needsOversize = direction !== "down" && direction !== "up";

  return (
    <div className={cn("relative h-full w-full overflow-hidden p-1", className)}>
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: needsOversize ? "200vmax" : "100%",
        height: needsOversize ? "200vmax" : "100%",
        transform: `translate(-50%, -50%) rotate(${rotation})`,
      }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="size-full"
      >
        <motion.div
          className="relative size-full z-0"
          style={{
            backgroundColor,
            backgroundImage: generateBackgroundImage(),
            backgroundSize: backgroundSizes,
          }}
          variants={{
            initial: { backgroundPosition: endPositions },
            animate: {
              backgroundPosition: [endPositions, startPositions],
              transition: {
                duration,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            },
          }}
          initial="initial"
          animate="animate"
        />
      </motion.div>
      {/* Overlay: backdropFilter blurs the streaks below, dot mask punches through */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          backdropFilter: `blur(${blurIntensity})`,
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent ${2 * scale}px, ${backgroundColor} ${2 * scale}px)`,
          backgroundSize: `${8 * density * scale}px ${8 * density * scale}px`,
        }}
      />
      </div>
    </div>
  );
}
