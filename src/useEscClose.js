import { useEffect, useRef } from "react";

// Open dialogs, oldest first. Esc only acts on the last one, so stacked dialogs
// (Settings → Feedback, Settings → Guide) close one at a time, top first.
const stack = [];

// Pass `onClose = null` for a dialog that must not be dismissed with Esc: it still
// takes the top slot, so Esc doesn't close whatever is open behind it.
export function useEscClose(open, onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const id = {};
    stack.push(id);
    const onKey = (e) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      stack.splice(stack.indexOf(id), 1);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}
