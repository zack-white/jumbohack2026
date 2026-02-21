"use client";

import { useId, useMemo } from "react";
import { motion } from "motion/react";
import { getBezierPath, type EdgeProps } from "@xyflow/react";

function hashEdgeId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return Math.abs(h);
}

export function AnimatedBeamEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const gradientId = useId();

  const pathColor = (style?.stroke as string) ?? "#94a3b8";
  const pathWidth = (style?.strokeWidth as number) ?? 2;
  const reverse = targetX < sourceX;

  const { duration, delay } = useMemo(() => {
    const h = hashEdgeId(id);
    return {
      duration: 0.8 + (h % 80) / 80,
      delay: (h % 20) / 20,
    };
  }, [id]);

  const gradientAnimate = reverse
    ? { x1: [0.9, -0.1] as const, x2: [1, 0] as const }
    : { x1: [0.1, 1.1] as const, x2: [0, 1] as const };

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={0.25}
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        strokeWidth={pathWidth}
        stroke={`url(#${gradientId})`}
        strokeOpacity={1}
        strokeLinecap="round"
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      <defs>
        <motion.linearGradient
          id={gradientId}
          gradientUnits="objectBoundingBox"
          initial={{ x1: 0, x2: 0, y1: 0, y2: 0 }}
          animate={{
            ...gradientAnimate,
            y1: [0, 0],
            y2: [0, 0],
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <stop stopColor={pathColor} stopOpacity={0} />
          <stop stopColor={pathColor} />
          <stop offset="32.5%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
        </motion.linearGradient>
      </defs>
    </>
  );
}
