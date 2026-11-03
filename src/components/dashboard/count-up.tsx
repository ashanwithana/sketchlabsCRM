"use client";

import * as React from "react";

const format = (n: number) => n.toLocaleString("en-GB");

/**
 * Animates a number from 0 to `value` once on mount. The text is written straight to the
 * node, so no React re-render runs per frame. Reduced-motion users see the final value.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      el.textContent = format(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span ref={ref} className="num">
      {format(value)}
    </span>
  );
}
