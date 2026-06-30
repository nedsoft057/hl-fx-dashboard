import { useMemo } from "react";
import type { Candle } from "../types";

interface SparklineProps {
  candles: Candle[];
  positive: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({
  candles,
  positive,
  width = 132,
  height = 36,
}: SparklineProps) {
  const path = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const stepX = width / (closes.length - 1);
    const points = closes.map((c, i) => {
      const x = i * stepX;
      const y = height - ((c - min) / range) * (height - 4) - 2;
      return [x, y];
    });
    const d = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const last = points[points.length - 1];
    return { d, last };
  }, [candles, width, height]);

  if (!path) {
    return (
      <div className="sparkline sparkline--empty" style={{ width, height }}>
        <span>waiting for ticks…</span>
      </div>
    );
  }

  const stroke = positive ? "var(--positive)" : "var(--negative)";

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={path.d} fill="none" stroke={stroke} strokeWidth={1.5} />
      <circle cx={path.last[0]} cy={path.last[1]} r={2.2} fill={stroke} />
    </svg>
  );
}
