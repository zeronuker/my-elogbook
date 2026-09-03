import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const norm = (s) => (s || "").trim().toUpperCase();

// Wraps the substring of `text` matching `query` in a highlight span.
function highlightMatch(text, query) {
  if (!text) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="srch-hit">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

export default function SearchModal({ open, onClose, monthData, dutyLogEntries, onJumpTo }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Lock page scroll while open — otherwise touch-scrolling the results list
  // on iOS scrolls the page underneath the fixed modal instead.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Searches every row across every logged month — departure, arrival,
  // markings, captain, remarks, and (for rows linked to a synced Duty Log
  // entry) the Duty Log crew list.
  const results = useMemo(() => {
    const q = query.trim();
    if (!q || !monthData) return [];
    const qLower = q.toLowerCase();
    const hits = [];

    Object.entries(monthData).forEach(([monthKey, rows]) => {
      const [monthIdxStr, yearStr] = monthKey.split("-");
      const monthIdx = Number(monthIdxStr);
      const year = Number(yearStr);

      (rows || []).forEach(row => {
        const day = parseInt(row.date, 10);
        let crewNames = [];
        if (day && row.departure && row.arrival) {
          const isoDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dlMatch = (dutyLogEntries || []).find(e =>
            e.isoDate === isoDate &&
            norm(e.sector.from) === norm(row.departure) &&
            norm(e.sector.dest) === norm(row.arrival)
          );
          if (dlMatch?.log?.crew) crewNames = dlMatch.log.crew.map(c => c.name).filter(Boolean);
        }

        const fields = [
          { tag: "Departure", text: row.departure },
          { tag: "Arrival",   text: row.arrival },
          { tag: "Markings",  text: row.markings },
          { tag: "Captain",   text: row.captain },
          { tag: "Crew",      text: crewNames.find(n => n.toLowerCase().includes(qLower)) },
          { tag: "Remarks",   text: row.remarks },
        ];
        const hit = fields.find(f => f.text && f.text.toLowerCase().includes(qLower));
        if (hit) hits.push({ monthKey, monthIdx, year, row, tag: hit.tag, matchText: hit.text });
      });
    });

    hits.sort((a, b) => (b.year - a.year) || (b.monthIdx - a.monthIdx) || ((parseInt(b.row.date, 10) || 0) - (parseInt(a.row.date, 10) || 0)));
    return hits;
  }, [query, monthData, dutyLogEntries]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const handleSelect = (hit) => {
    onJumpTo(hit);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[activeIndex]) handleSelect(results[activeIndex]); }
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  if (!open) return null;

  return (
    <>
      <style>{searchModalCss}</style>
      <div className="srch-backdrop" onClick={handleBackdrop} />
      <div className="srch-modal" role="dialog" aria-modal="true" aria-label="Search logbook">
        <header className="srch-head">
          <div>
            <div className="srch-eyebrow">Search Logbook</div>
            <h2 className="srch-title">Find a Flight</h2>
          </div>
          <button className="srch-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="srch-searchbar">
          <div className="srch-field">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Airport, markings, captain, crew, remarks…"
            />
            <span className="srch-esc">ESC</span>
          </div>
        </div>

        {query.trim() && (
          <div className="srch-meta">{results.length} result{results.length === 1 ? "" : "s"}</div>
        )}

        <div className="srch-results">
          {!query.trim() && (
            <div className="srch-empty">Start typing to search every logged flight.</div>
          )}
          {query.trim() !== "" && results.length === 0 && (
            <div className="srch-empty">No flights match "{query.trim()}".</div>
          )}
          {results.map((hit, i) => (
            <div
              key={`${hit.monthKey}-${hit.row.id}`}
              className={"srch-result" + (i === activeIndex ? " focus" : "")}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleSelect(hit)}
            >
              <div className="srch-date">
                {String(parseInt(hit.row.date, 10) || "").padStart(2, "0")} {MONTHS_SHORT[hit.monthIdx]}
                <b>{hit.year}</b>
              </div>
              <div className="srch-route">
                {hit.tag === "Departure" ? highlightMatch(hit.row.departure, query) : (hit.row.departure || "—")}
                <span className="srch-arw">→</span>
                {hit.tag === "Arrival" ? highlightMatch(hit.row.arrival, query) : (hit.row.arrival || "—")}
              </div>
              <div className="srch-detail">
                {hit.tag === "Markings" ? highlightMatch(hit.row.markings, query) : (hit.row.markings || "—")}
                {" · "}
                {hit.tag === "Captain" ? highlightMatch(hit.row.captain, query) : (hit.row.captain || "—")}
                {hit.row.type && <> · {hit.row.type}</>}
                {hit.tag === "Remarks" && <> · <span className="srch-detail-hit">{highlightMatch(hit.matchText, query)}</span></>}
                {hit.tag === "Crew" && <> · crew: <span className="srch-detail-hit">{highlightMatch(hit.matchText, query)}</span></>}
              </div>
              <div className="srch-tag">{hit.tag}</div>
            </div>
          ))}
        </div>

        <footer className="srch-foot">
          <span><span className="srch-kbd">↑</span><span className="srch-kbd">↓</span> navigate &nbsp; <span className="srch-kbd">↵</span> jump to flight</span>
          {results.length > 0 && <span>{activeIndex + 1} / {results.length}</span>}
        </footer>
      </div>
    </>
  );
}

const searchModalCss = `
  .srch-backdrop{
    position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:2090;
  }
  .srch-modal{
    position:fixed;top:9vh;left:50%;transform:translateX(-50%);
    width:600px;max-width:92vw;max-height:78vh;
    background:var(--elb-bg2, #0d1520);border:1px solid var(--elb-border, #1e3a5f);border-radius:8px;
    display:flex;flex-direction:column;box-shadow:0 30px 90px rgba(0,0,0,0.6);
    z-index:2100;animation:srchPopIn 0.16s ease;
    font-family:'Courier New',monospace;color:var(--elb-txt, #c8d6e5);text-align:left;
  }
  @keyframes srchPopIn{from{opacity:0;transform:translateX(-50%) scale(0.97) translateY(-6px);}to{opacity:1;transform:translateX(-50%) scale(1) translateY(0);}}

  .srch-head{
    padding:calc(18px * var(--fs)) calc(22px * var(--fs)) calc(14px * var(--fs));
    border-bottom:1px solid var(--elb-border, #1e3a5f);
    display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;
    background:linear-gradient(180deg, rgba(63,224,197,0.05), transparent);
  }
  .srch-eyebrow{
    font-family:'JetBrains Mono','Courier New',monospace;font-size:calc(10px * var(--fs));letter-spacing:0.24em;
    text-transform:uppercase;color:#3FE0C5;margin-bottom:6px;font-weight:700;
  }
  .srch-title{
    font-family:'Tourney',system-ui,sans-serif;font-weight:700;font-size:calc(22px * var(--fs));
    margin:0;color:var(--elb-txt, #e8f4fd);
  }
  .srch-close{
    width:28px;height:28px;border-radius:5px;background:transparent;border:1px solid var(--elb-border, #1e3a5f);
    color:var(--elb-txt-muted, #5a7a9a);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
    transition:color 120ms, border-color 120ms;
  }
  .srch-close:hover{color:var(--elb-acc, #4fc3f7);border-color:var(--elb-acc, #4fc3f7);}

  .srch-searchbar{padding:calc(14px * var(--fs)) calc(22px * var(--fs)); border-bottom:1px solid var(--elb-border, #1e3a5f);}
  .srch-field{
    display:flex;align-items:center;gap:10px;
    background:var(--elb-bg, #0a0d12);border:1px solid var(--elb-border, #1e3a5f);border-radius:6px;
    padding:calc(10px * var(--fs)) calc(14px * var(--fs));
  }
  .srch-field:focus-within{border-color:var(--elb-acc, #4fc3f7);}
  .srch-field svg{flex-shrink:0;color:var(--elb-txt-muted, #5a7a9a);}
  .srch-field input{
    all:unset;flex:1;color:var(--elb-txt, #e8f4fd);font-family:'Courier New',monospace;
    font-size:calc(14px * var(--fs));letter-spacing:0.03em;
  }
  .srch-esc{
    font-size:calc(10px * var(--fs));color:var(--elb-txt-muted, #4a6a8a);border:1px solid var(--elb-border, #1e3a5f);
    border-radius:3px;padding:2px 6px;letter-spacing:0.06em;flex-shrink:0;
  }

  .srch-meta{
    padding:calc(10px * var(--fs)) calc(22px * var(--fs)) 0;font-size:calc(10px * var(--fs));
    letter-spacing:0.14em;color:var(--elb-txt-muted, #4a6a8a);text-transform:uppercase;
  }

  .srch-results{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:8px 10px 14px;min-height:0;}
  .srch-results::-webkit-scrollbar{width:4px;}
  .srch-results::-webkit-scrollbar-track{background:transparent;}
  .srch-results::-webkit-scrollbar-thumb{background:var(--elb-border, #1e3a5f);border-radius:2px;}

  .srch-empty{padding:calc(24px * var(--fs)) calc(12px * var(--fs));text-align:center;font-size:calc(12px * var(--fs));color:var(--elb-txt-muted, #5a7a9a);}

  .srch-result{
    display:flex;align-items:center;gap:14px;padding:calc(10px * var(--fs)) calc(12px * var(--fs));
    border-radius:6px;cursor:pointer;border:1px solid transparent;
  }
  .srch-result.focus{background:rgba(79,195,247,0.08);border-color:rgba(79,195,247,0.3);}
  .srch-date{width:78px;flex-shrink:0;font-size:calc(11px * var(--fs));color:var(--elb-txt-muted, #5a7a9a);letter-spacing:0.04em;}
  .srch-date b{display:block;color:var(--elb-txt, #e8f4fd);font-size:calc(13px * var(--fs));font-weight:700;}
  .srch-route{
    width:150px;flex-shrink:0;display:flex;align-items:center;gap:6px;
    font-size:calc(14px * var(--fs));font-weight:700;color:var(--elb-txt, #e8f4fd);letter-spacing:0.03em;
  }
  .srch-arw{color:var(--elb-txt-muted, #4a6a8a);font-weight:400;}
  .srch-detail{flex:1;min-width:0;font-size:calc(11px * var(--fs));color:var(--elb-txt-muted, #5a7a9a);letter-spacing:0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .srch-detail-hit{color:var(--elb-acc, #4fc3f7);}
  .srch-hit{color:var(--elb-acc, #4fc3f7);text-decoration:underline;text-decoration-color:rgba(79,195,247,0.4);text-underline-offset:2px;}
  .srch-tag{
    flex-shrink:0;font-size:calc(9px * var(--fs));letter-spacing:0.12em;text-transform:uppercase;font-weight:700;
    padding:3px 8px;border-radius:3px;background:rgba(79,195,247,0.12);color:var(--elb-acc, #4fc3f7);
    border:1px solid rgba(79,195,247,0.3);
  }

  .srch-foot{
    padding:calc(10px * var(--fs)) calc(22px * var(--fs));border-top:1px solid var(--elb-border, #1e3a5f);
    display:flex;justify-content:space-between;align-items:center;
    font-size:calc(10px * var(--fs));color:var(--elb-txt-muted, #4a6a8a);letter-spacing:0.08em;flex-shrink:0;
  }
  .srch-kbd{background:var(--elb-bg, #0a0d12);border:1px solid var(--elb-border, #1e3a5f);border-radius:3px;padding:1px 6px;font-size:calc(10px * var(--fs));color:var(--elb-txt-muted, #5a7a9a);margin:0 2px;}

  @media (max-width: 560px){
    .srch-modal{width:94vw;top:6vh;}
    .srch-route{width:110px;}
  }
`;
