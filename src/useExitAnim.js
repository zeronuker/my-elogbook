import { useEffect, useState } from "react";

// How long the exit animation runs. Reads the live --elb-dur (0ms when
// animations are off in Settings) so close timing always matches the CSS.
function exitMs() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--elb-dur"));
  return Number.isNaN(v) ? 150 : v;
}

// Keeps a dialog mounted while its exit animation plays.
//   const { mounted, closing, payload } = useExitAnim(open, data);
//   if (!mounted) return null;
//   <div className={"elb-fade" + (closing ? " elb-closing" : "")} />
// `payload` is the last value passed while open — use it for content that the
// parent clears on close (e.g. a dialog's title) so it doesn't vanish mid-fade.
// Pass a stable value (state object / primitive), not a fresh literal.
export function useExitAnim(open, payload) {
  const [mounted, setMounted] = useState(open);
  const [kept, setKept] = useState(payload);
  if (open && !mounted) setMounted(true);
  if (open && kept !== payload) setKept(payload);
  const closing = mounted && !open;
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setMounted(false), exitMs());
    return () => clearTimeout(t);
  }, [closing]);
  return { mounted, closing, payload: open ? payload : kept };
}
