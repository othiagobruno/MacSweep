import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/** Counts up/down to `value`, rendering it through `format` on every frame. */
export function AnimatedNumber({
  value,
  format,
  duration = 1.1,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return <>{format(display)}</>;
}
