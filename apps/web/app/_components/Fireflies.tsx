import type { CSSProperties } from "react";

// Fixed positions (no Math.random) confined strictly to side bands (<14% and >85%)
// so fireflies never cross central text reading areas.
const FLIES = [
  { x: 6, y: 18, delay: 0, d: 9, b: 3.1, size: 8 },
  { x: 92, y: 22, delay: 1.2, d: 11, b: 4.2, size: 10 },
  { x: 11, y: 46, delay: 2.4, d: 8, b: 3.6, size: 7 },
  { x: 88, y: 54, delay: 0.6, d: 10, b: 2.9, size: 9 },
  { x: 7, y: 76, delay: 1.8, d: 12, b: 3.8, size: 8 },
  { x: 93, y: 80, delay: 3, d: 9, b: 4.4, size: 11 },
  { x: 13, y: 32, delay: 2.1, d: 10, b: 3.5, size: 7 },
  { x: 86, y: 38, delay: 1.5, d: 9, b: 4.0, size: 10 },
  { x: 8, y: 88, delay: 3.3, d: 11, b: 3.7, size: 8 },
  { x: 91, y: 68, delay: 0.9, d: 8, b: 3.3, size: 9 },
] as const;

export function Fireflies({
  count = FLIES.length,
  prominent = false,
}: {
  count?: number;
  prominent?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${
        prominent ? "opacity-85" : "opacity-40"
      }`}
      aria-hidden="true"
    >
      {FLIES.slice(0, count).map((fly, i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${fly.x}%`,
              top: `${fly.y}%`,
              width: prominent ? `${fly.size}px` : "6px",
              height: prominent ? `${fly.size}px` : "6px",
              "--delay": `${fly.delay}s`,
              "--d": `${fly.d}s`,
              "--b": `${fly.b}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
