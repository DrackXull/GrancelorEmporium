// frontend/src/pages/MonsterCreator.jsx
import React, { useEffect, useState } from "react";
import { scoreMonster } from "../utils/api";

const card = { border:"1px solid #ddd", borderRadius:12, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.04)" };
const field = { display:"grid", gridTemplateColumns:"140px 1fr", gap:8, alignItems:"center" };

export default function MonsterCreator() {
  const [form, setForm] = useState({
    name: "",
    ehp: 150,
    dpr: 18,
    control_index: 1,
    role: "brute"
  });
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  useEffect(()=>{
    const t = setTimeout(async ()=>{
      setBusy(true);
      try {
        const res = await scoreMonster(form);
        setScore(res);
      } finally { setBusy(false); }
    }, 200);
    return ()=>clearTimeout(t);
  }, [form]);

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div style={card}>
        <h2>Create Monster</h2>
        <div style={field}><label>Name</label><input value={form.name} onChange={e=>set("name", e.target.value)} /></div>
        <div style={field}><label>EHP</label><input type="number" value={form.ehp} onChange={e=>set("ehp", parseFloat(e.target.value||0))} /></div>
        <div style={field}><label>DPR</label><input type="number" value={form.dpr} onChange={e=>set("dpr", parseFloat(e.target.value||0))} /></div>
        <div style={field}><label>Control Index</label><input type="number" step="0.1" value={form.control_index} onChange={e=>set("control_index", parseFloat(e.target.value||0))} /></div>
        <div style={field}><label>Role</label>
          <select value={form.role} onChange={e=>set("role", e.target.value)}>
            <option value="brute">brute</option>
            <option value="skirmisher">skirmisher</option>
            <option value="controller">controller</option>
            <option value="artillery">artillery</option>
          </select>
        </div>
      </div>

      <div style={card}>
        <h2>Score & Suggestion {busy && <span style={{fontSize:12,opacity:.6}}>…</span>}</h2>
        {!score ? <em>Enter monster data…</em> : (
          <>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8}}>
              <div><div style={{opacity:.7}}>Power Score</div><strong>{score.ps}</strong></div>
              <div><div style={{opacity:.7}}>Suggested Level</div><strong>L{score.suggested_level}</strong></div>
              <div><div style={{opacity:.7}}>Tier</div><strong>{score.tier}</strong></div>
            </div>
            <div>
              <div style={{opacity:.7, marginBottom:4}}>Breakdown</div>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>EHP weight: {score.explain.ehp_weight}</li>
                <li>DPR weight: {score.explain.dpr_weight}</li>
                <li>Control weight: {score.explain.control_weight}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
