import { useEffect, useRef, useState } from "react";

const parse = v => { const m = /^(\d+):(\d{2})$/.exec(v); return m ? +m[1] * 60 + +m[2] : null; };
const fmt = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");

// An HH:MM value that counts up/down to its new value when it changes and flashes
// briefly (look in oxygen.css, .elb-roll). Instant when animations are off (--elb-dur 0).
export default function RollingTime({ value }) {
  const [text, setText] = useState(value);
  const [flash, setFlash] = useState(0);
  const shown = useRef(parse(value));

  useEffect(() => {
    const to = parse(value), from = shown.current;
    const animOn = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--elb-dur")) > 0;
    if (to == null || from == null || to === from || !animOn) {
      shown.current = to;
      setText(value);
      return;
    }
    const t0 = performance.now();
    let raf;
    const step = t => {
      const p = Math.min(1, (t - t0) / 700);
      shown.current = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      setText(fmt(shown.current));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    setFlash(f => f + 1);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span key={flash} className={flash ? "elb-roll" : undefined}>{text}</span>;
}
