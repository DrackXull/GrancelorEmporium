import React, { useEffect, useMemo, useState } from "react";

export default function ChoicePicker({ open, onClose, pending, allSkills, allLanguages }) {
  // pending: array of {sourceId, sourceName, kind, choose, from}
  // kind in {"skills","languages","ability_boosts"}
  const [selections, setSelections] = useState({}); // key = index in pending, value = array of chosen or single

  useEffect(() => {
    if (open) setSelections({});
  }, [open]);

  const pools = useMemo(() => {
    const skillsAll = allSkills || [];
    const langsAll = allLanguages || [];
    return { skillsAll, langsAll };
  }, [allSkills, allLanguages]);

  function toggle(idx, val, maxChoose) {
    const cur = selections[idx] || [];
    const exists = cur.includes(val);
    let next;
    if (exists) next = cur.filter(v => v !== val);
    else {
      next = [...cur, val].slice(0, maxChoose);
    }
    setSelections(s => ({ ...s, [idx]: next }));
  }

  function confirm() {
    const result = [];
    pending.forEach((p, idx) => {
      const pick = selections[idx] || [];
      result.push({ ...p, picked: Array.isArray(pick) ? pick : [pick] });
    });
    onClose?.(result);
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={hdr}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Resolve Choices</div>
          <button onClick={()=>onClose?.(null)} style={xbtn} aria-label="Close">✕</button>
        </div>

        <div style={{ display: "grid", gap: 12, maxHeight: "60vh", overflow: "auto" }}>
          {pending.map((p, idx) => {
            const title = `${p.sourceName} — ${labelForKind(p.kind)} (choose ${p.choose})`;
            const opts = optionsFor(p, pools);
            const chosen = selections[idx] || [];
            return (
              <section key={idx} style={section}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {opts.map(opt => (
                    <button
                      key={String(opt)}
                      onClick={() => toggle(idx, opt, p.choose)}
                      style={chip(chosen.includes(opt))}
                    >
                      {pretty(opt)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Selected: {chosen.length ? chosen.map(pretty).join(", ") : "—"}
                </div>
              </section>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={confirm} style={btnPrimary}>Confirm</button>
          <button onClick={()=>onClose?.(null)} style={btn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// helpers
function optionsFor(p, pools) {
  if (Array.isArray(p.from)) return p.from;
  if (p.from === "ANY") {
    if (p.kind === "skills") return pools.skillsAll;
    if (p.kind === "languages") return pools.langsAll;
    if (p.kind === "ability_boosts") return ["str","dex","con","int","wis","cha"];
  }
  return [];
}
function labelForKind(k){ return k === "ability_boosts" ? "Ability Boosts" : k[0].toUpperCase()+k.slice(1); }
function pretty(v){ return String(v).replaceAll("_"," ").replace(/\b\w/g, c => c.toUpperCase()); }

// styles
const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"grid", placeItems:"center", zIndex: 50 };
const modal = { width: "min(900px, 95vw)", background:"#0f1424", border:"1px solid #2b3555", borderRadius:12, padding:16, boxShadow:"0 20px 70px rgba(0,0,0,0.5)", color:"#e6e6e6" };
const hdr = { display:"flex", alignItems:"center" };
const xbtn = { marginLeft:"auto", background:"transparent", border:"none", color:"#9aa3c2", fontSize:20, cursor:"pointer" };
const section = { border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:10 };
const chip = (active) => ({ padding:"6px 10px", borderRadius:16, border: active ? "1px solid #5b7cff" : "1px solid #324064", background: active ? "#213067" : "#121a30", cursor:"pointer" });
const btn = { padding:"8px 12px", borderRadius:8, border:"1px solid #2a2f42", background:"#152040", color:"#fff", cursor:"pointer" };
const btnPrimary = { ...btn, background:"#1f3b8a", border:"1px solid #3350a6" };
