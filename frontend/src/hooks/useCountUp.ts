import { useEffect, useState } from "react";

/**
 * Animates a numeric target with asymmetric easing (fast out, slow into final).
 * Honors prefers-reduced-motion by jumping directly to the value.
 */
export function useCountUp(target: number, duration = 900, deps: unknown[] = []): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const from = 0;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.concat(target));

  return value;
}
