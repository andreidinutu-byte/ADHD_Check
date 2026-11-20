import type { CSSProperties } from "react";

// Fixed positions (no Math.random) confined strictly to side bands (<14% and >85%)
// so fireflies never cross central text reading areas.
const FLIES = [
  [6, 18, 0, 9, 3.1],
  [92, 22, 1.2, 11, 4.2],
  [11, 46, 2.4, 8, 3.6],
  [88, 54, 0.6, 10, 2.9],
  [7, 76, 1.8, 12, 3.8],
  [93, 80, 3, 9, 4.4],
  [13, 32, 2.1, 10, 3.5],
  [86, 38, 1.5, 9, 4.0],
  [8, 88, 3.3, 11, 3.7],
  [91, 68, 0.9, 8, 3.3],
] as const;

export function Fireflies({ count = FLIES.length }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40" aria-hidden="true">
      {FLIES.slice(0, count).map(([x, y, delay, d, b], i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              "--delay": `${delay}s`,
              "--d": `${d}s`,
              "--b": `${b}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
