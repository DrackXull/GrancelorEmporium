// frontend/src/pages/SpellCreator.jsx
import React, { useEffect, useMemo, useState } from "react";
import { scoreSpell } from "../utils/api";

const field = { display:"grid", gridTemplateColumns:"140px 1fr", gap:8, alignItems:"center" };
const card = { border:"1px solid #ddd", borderRadius:12, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.04)" };

export default function SpellCreator() {
  const [form, setForm] = useState({
    name: "",
    level: 3,
    dice: "6d6",
    area: { shape: "burst", radius: 20 },
    range: 120,
    actions: 2,
    save: "basic-reflex",
    riders: []
  });
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    const t = setTimeout(async ()=>{
      setBusy(true);
      try {
        const res = await scoreSpell(form);
        setScore(res);
      } finally { setBusy(false); }
    }, 200);
    return ()=>clearTimeout(t);
  }, [form]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div style={card}>
        <h2>Create Spell</h2>
        <div style={field}><label>Name</label><input value={form.name} onChange={e=>set("name", e.target.value)} /></div>
        <div style={field}><label>Level</label><input type="number" value={form.level} onChange={e=>set("level", parseInt(e.target.value||1))} /></div>
        <div style={field}><label>Damage Dice</label><input value={form.dice} onChange={e=>set("dice", e.target.value)} placeholder="e.g. 6d6" /></div>
        <div style={field}><label>Area</label>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
            <select value={form.area.shape} onChange={e=>set("area", {...form.area, shape:e.target.value})}>
              <option value="burst">burst</option>
              <option value="cone">cone</option>
              <option value="line">line</option>
            </select>
            <input type="number" value={form.area.radius||form.area.length||20}
                   onChange={e=>{
                     const val = parseInt(e.target.value||0);
                     if (form.area.shape==="line") set("area", {shape:"line", length:val});
                     else set("area", {shape:form.area.shape, radius:val});
                   }} />
          </div>
        </div>
        <div style={field}><label>Range</label><input type="number" value={form.range} onChange={e=>set("range", parseInt(e.target.value||0))} /></div>
        <div style={field}><label>Actions</label>
          <select value={form.actions} onChange={e=>set("actions", parseInt(e.target.value||2))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
        <div style={field}><label>Save</label>
          <select value={form.save} onChange={e=>set("save", e.target.value)}>
            <option value="">none</option>
            <option value="basic-reflex">basic-reflex</option>
            <option value="basic-fort">basic-fort</option>
            <option value="basic-will">basic-will</option>
          </select>
        </div>
        <small style={{opacity:.7}}>Scoring updates live as you type.</small>
      </div>

      <div style={card}>
        <h2>Score & Suggestion {busy && <span style={{fontSize:12,opacity:.6}}>…</span>}</h2>
        {!score ? <em>Enter spell data…</em> : (
          <>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8}}>
              <div><div style={{opacity:.7}}>Declared</div><strong>L{score.declared_level}</strong></div>
              <div><div style={{opacity:.7}}>Suggested</div><strong>L{score.suggested_level}</strong></div>
              <div><div style={{opacity:.7}}>Power Score</div><strong>{score.ps}</strong></div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{opacity:.7, marginBottom:4}}>Breakdown</div>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>DT/target: {score.explain.dt_avg_per_target.toFixed(2)}</li>
                <li>Targets (AM): {score.explain.am_targets.toFixed(2)}</li>
                <li>Delivery/Save tax: {score.explain.dst_factor}</li>
                <li>Range factor: {score.explain.range_factor}</li>
                <li>Action cost: {score.explain.action_cost}</li>
                <li>Resource cost: {score.explain.resource_cost}</li>
                <li>Rider value: {score.explain.rider_value}</li>
              </ul>
            </div>
            <div>
              <div style={{opacity:.7, marginBottom:4}}>Comparables</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
                {score.comparables.map((c,i)=>(
                  <div key={i} style={{border:"1px solid #eee", borderRadius:8, padding:8}}>
                    <div style={{opacity:.7}}>{c.name}</div>
                    <div>PS {c.ps}</div>
                    <div style={{opacity:.7}}>Δ {c.delta.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
