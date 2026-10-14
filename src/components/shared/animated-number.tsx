"use client";

import * as React from "react";

/**
 * Phase 17 polish — Animated number counter.
 *
 * Smoothly animates from the previous value to the new value using
 * requestAnimationFrame + an ease-out curve. Useful for KPI cards that
 * update after data refetch.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 600,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(value);
  const rafRef = React.useRef<number>(0);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
        startRef.current = 0;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = format ? format(display) : String(Math.round(display));
  return <span className={className}>{formatted}</span>;
}
