import { useState, useRef, useLayoutEffect } from "react";

// Transition for a keyed panel (tab bodies). Put the returned className/style on
// a wrapper with key={key}; the class is dropped after the animation so rows
// added later don't replay it. `order` decides slide direction.
export function useTransitionAnim(key, order, animStyle) {
  const prev = useRef(key);
  const dir = useRef(1);
  const [on, setOn] = useState(true);
  if (prev.current !== key) {
    dir.current = order.indexOf(key) > order.indexOf(prev.current) ? 1 : -1;
    prev.current = key;
  }
  useLayoutEffect(() => {
    setOn(true);
    const t = setTimeout(() => setOn(false), 1500);
    return () => clearTimeout(t);
  }, [key]);
  return { className: on ? `elb-anim-${animStyle || "slide"}` : "", style: { "--dir": dir.current } };
}
