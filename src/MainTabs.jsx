import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Main tab strip with a highlight that glides to the active tab (look is in
// oxygen.css, .elb-tabind). Tab borders for the active tab are transparent so the
// moving highlight draws them. `tabs` = [{ id, icon, label }].
export default function MainTabs({ tabs, active, onChange }) {
  const rowRef = useRef(null);
  const [ind, setInd] = useState(null);
  const [armed, setArmed] = useState(false); // first placement is instant, later moves glide

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = () => {
      const el = row.querySelector('[aria-selected="true"]');
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [active]);

  useEffect(() => { setArmed(true); }, []);

  return (
    <div className="elb-tabsbar" style={{ overflowX: "auto", overflowY: "hidden" }}>
      <div ref={rowRef} className="elb-maintabs" role="tablist" style={{ position: "relative", display: "flex", gap: 4, alignItems: "flex-end", borderBottom: "1px solid var(--elb-border, #1e3a5f)" }}>
        {ind && <i className={"elb-tabind" + (armed ? " elb-tabind-go" : "")} aria-hidden="true" style={{ width: ind.width, transform: `translateX(${ind.left}px)` }} />}
        {tabs.map(tab => {
          const on = active === tab.id;
          return (
            <button key={tab.id} className="elb-maintab" role="tab" aria-selected={on} onClick={() => onChange(tab.id)} style={{
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent",
              border: "1px solid " + (on ? "transparent" : "var(--elb-border, #1e3a5f)"),
              borderBottom: "1px solid " + (on ? "transparent" : "var(--elb-border, #1e3a5f)"),
              borderRadius: "5px 5px 0 0",
              color: on ? "var(--elb-acc, #4fc3f7)" : "var(--elb-txt-muted, #5a7a9a)",
              padding: "7px 18px",
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "color 0.15s",
            }}>{tab.icon}{tab.label}</button>
          );
        })}
      </div>
    </div>
  );
}
