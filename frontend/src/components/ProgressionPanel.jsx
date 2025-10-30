import { useEffect, useMemo, useState } from "react";
import Chip from "./Chip.jsx";
import api from "../utils/api";

export default function ProgressionPanel({ initQuery }) {
  const [ruleset, setRuleset] = useState(initQuery?.ruleset || "5e");
  const [classId, setClassId] = useState(initQuery?.class_id || "");
  const [subclassId, setSubclassId] = useState(initQuery?.subclass_id || "");
  const [maxLevel, setMaxLevel] = useState(initQuery?.level || 20);
  const [classes, setClasses] = useState([]);
  const [data, setData] = useState(null);
  const [csvHref, setCsvHref] = useState(null);
  const [pf2eFullAC, setPf2eFullAC] = useState(!!initQuery?.pf2e_full_ac);

  useEffect(() => {
    api.get("/api/data", { params: { ruleset } }).then(({data:d})=>{
      setClasses(d.classes || []);
      if (!classId && (d.classes?.length)) setClassId(d.classes[0].id || d.classes[0].archetype);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleset]);

  useEffect(() => {
    if (!classId) return;
    const q = new URLSearchParams({ class_id: classId, ruleset, max_level: String(maxLevel) });
    if (subclassId) q.set("subclass_id", subclassId);
   api.get("/api/progression", { params: Object.fromEntries(q) })
  .then(({data})=>setData(data));


    const csv = new URLSearchParams({ class_id: classId, ruleset, max_level: String(maxLevel) });
    setCsvHref(`/api/progression.csv?${csv.toString()}`);
  }, [ruleset, classId, subclassId, maxLevel]);

  const cls = useMemo(()=>classes.find(c => (c.id||c.archetype)===classId), [classes, classId]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Progression</h2>
        <div className="panel-actions">
          {ruleset === "pf2e" && <Chip label={pf2eFullAC ? "PF2e Full AC" : "Simple AC"} active={pf2eFullAC} onClick={()=>setPf2eFullAC(!pf2eFullAC)} />}
          {csvHref && <a className="btn" href={csvHref}>Export CSV</a>}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="field">
            <label>Ruleset</label>
            <select value={ruleset} onChange={e=>setRuleset(e.target.value)}>
              <option value="5e">5e</option>
              <option value="pf2e">PF2e</option>
            </select>
          </div>
          <div className="field">
            <label>Class</label>
            <select value={classId} onChange={e=>{ setClassId(e.target.value); setSubclassId(""); }}>
              {(classes||[]).map(c => (
                <option key={c.id||c.archetype} value={c.id||c.archetype}>{c.name}</option>
              ))}
            </select>
          </div>
          {cls?.subclasses?.length ? (
            <div className="field">
              <label>Subclass</label>
              <select value={subclassId} onChange={e=>setSubclassId(e.target.value)}>
                <option value="">— none —</option>
                {cls.subclasses.map(s=>(
                  <option key={s.id||s.archetype} value={s.id||s.archetype}>{s.name || (s.id||s.archetype)}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label>Max level</label>
            <input type="number" min="1" max="20" value={maxLevel} onChange={e=>setMaxLevel(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h3>Timeline</h3>
          {!data ? <div className="muted">Select a class…</div> : (
            <div className="timeline">
              {(data.levels||[]).map(row => (
                <div key={row.level} className="row-line">
                  <div className="cell level">L{row.level}</div>
                  {ruleset === "5e" ? (
                    <>
                      <div className="cell pb">PB +{row.prof_bonus ?? "—"}</div>
                      <div className="cell gains">{(row.gains||[]).join(" · ") || "—"}</div>
                      <div className="cell subclass">{row.subclass_available ? "Subclass" : ""}</div>
                    </>
                  ) : (
                    <>
                      <div className="cell pb">Atk +{(row.pf2e_attack_bonus?._default) ?? "—"}</div>
                      <div className="cell gains">
                        {(row.gains||[]).join(" · ") || "—"}
                      </div>
                      <div className="cell tiers">
                        <span className="tag">{(row.pf2e_weapon_tiers?._default || "—").toString().toUpperCase()}</span>
                        {pf2eFullAC && typeof row.pf2e_full_ac === "number" ? (
                          <span className="tag pill">AC {row.pf2e_full_ac}</span>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
