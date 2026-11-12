import { useLayoutEffect, useRef } from "react";
import "./autoTextarea.css";

// <textarea> that grows with its text (up to maxHeight) and has an app-drawn grip that resizes it vertically only,
// replacing the browser's corner handle. After a manual drag it keeps the height you set. Takes the same props as
// <textarea>; `rows` and CSS min-height set the smallest size.
export default function AutoTextarea({ style, maxHeight = 320, onInput, ...props }) {
  const ref = useRef(null);
  const manual = useRef(false);

  const fit = () => {
    const t = ref.current;
    if (manual.current) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight + (t.offsetHeight - t.clientHeight), maxHeight) + "px";
  };
  useLayoutEffect(fit, [props.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = (e) => {
    const t = ref.current;
    const grip = e.currentTarget;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    grip.classList.add("drag");
    const y0 = e.clientY;
    const h0 = t.offsetHeight;
    const min = parseFloat(getComputedStyle(t).minHeight) || 40;
    const move = ev => {
      manual.current = true;
      t.style.height = Math.min(maxHeight, Math.max(min, h0 + ev.clientY - y0)) + "px";
    };
    const up = () => {
      grip.classList.remove("drag");
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  };

  return (
    <div className="cbta">
      <textarea
        ref={ref}
        style={{ ...style, display: "block", resize: "none", maxHeight }}
        onInput={e => { fit(); onInput?.(e); }}
        {...props}
      />
      <div className="cbta-grip" role="separator" aria-orientation="horizontal" aria-label="Resize" onPointerDown={drag} />
    </div>
  );
}
