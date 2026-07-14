import { useEffect, useState } from "react";

// Rolls 0 -> value like a flipping scoreboard; renders the final number
// immediately under prefers-reduced-motion.
export default function CountUp({
  value,
  duration = 600,
}: {
  value: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toFixed(1)}</>;
}
