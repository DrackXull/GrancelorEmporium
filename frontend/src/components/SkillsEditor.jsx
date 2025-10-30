import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

const PF2E_SKILLS = [
  "acrobatics","arcana","athletics","crafting","deception","diplomacy","intimidation",
  "medicine","nature","occultism","performance","religion","society","stealth","survival","thievery"
];
const RANKS = ["untrained","trained","expert","master","legend"];

export default function SkillsEditor({ classId, ruleset, onClose }) {
  const [plan, setPlan] = useState([]); // [{level, bumps:{skill:rank}}]
  const [levels, setLevels] = useState(Array.from({length:20}, (_,i)=>i+1));
  const [error, setError] = useState("");

  const isPF2 = ruleset === "pf2e";

  useEffect(() => {
    (async () => {
      try {
        const ov = await api.getOverrides();
        const cur = ov?.classes?.[classId]?.pf2e_skills_plan || [];
        setPlan(normalize(cur));
      } catch {
        setPlan([]);
      }
    })();
  }, [classId]);

  function setRank(level, skill, rank) {
    const copy = normalize(plan);
    const idx = copy.findIndex(r=>r.level===level);
    const bumps = idx>=0 ? {...copy[idx].bumps} : {};
    if (!rank) delete bumps[skill];
    else bumps[skill] = rank;
    const row = { level, bumps };
    if (idx>=0) copy[idx] = row; else copy.push(row);
    setPlan(sortByLevel(copy));
  }

  async function save() {
    const errors = validate(plan);
    if (errors.length) { setError(errors.join("\n")); return; }
    const payload = {
      classes: {
        [classId]: {
          pf2e_skills_plan: plan
        }
      }
    };
    try {
      await api.writeOverrides(payload);
      onClose();
    } catch {
      setError("Failed to save.");
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-card large">
        <div className="drawer-head">
          <h3>Skills Editor · {classId}</h3>
          <button className="icon" onClick={onClose}>×</button>
        </div>
        {!isPF2 ? <div className="muted">PF2e only.</div> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Level</th>
                    {PF2E_SKILLS.map(s=><th key={s}>{cap(s)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {levels.map(lv => (
                    <tr key={lv}>
                      <td className="muted">{lv}</td>
                      {PF2E_SKILLS.map(s => (
                        <td key={s}>
                          <select
                            value={table[lv]?.[s] || ""}
                            onChange={e=>setRank(lv, s, e.target.value || null)}
                          >
                            <option value="">—</option>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error ? <div className="error">{error}</div> : null}
            <div className="row gap" style={{marginTop:12}}>
              <button className="btn" onClick={save}>Save</button>
              <span className="muted">Saved to runtime overrides; mirrored to DB when <code>TPKA_DB_WRITE=1</code>.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function normalize(arr) {
  const out = Array.isArray(arr) ? arr.filter(x=>x && Number.isFinite(+x.level)).map(x=>({level: +x.level, bumps: x.bumps||{}})) : [];
  return sortByLevel(out);
}
function sortByLevel(a) { return [...a].sort((x,y)=>x.level-y.level); }
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function validate(plan) {
  const errs = [];
  // Simple per-level sanity: rank must be in RANKS
  for (const row of plan) {
    for (const [skill, rank] of Object.entries(row.bumps||{})) {
      if (!RANKS.includes(rank)) errs.push(`Invalid rank '${rank}' for ${skill} at level ${row.level}`);
    }
  }
  // (Optional) Add class-cap validation here if you expose caps per level from backend.
  return errs;
}
