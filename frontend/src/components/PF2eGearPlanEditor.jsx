// frontend/src/components/PF2eGearPlanEditor.jsx
import React, { useEffect, useState } from "react";
import  api  from "../utils/api";

export default function PF2eGearPlanEditor({ classId }) {
  const [plan, setPlan] = useState({ by_level:{} });
  const [validation, setValidation] = useState({});
  const [runeSuggestW, setRuneSuggestW] = useState([]);
  const [runeSuggestA, setRuneSuggestA] = useState([]);

  async function load() {
    const { data } = await api.get(`/api/gear/plan/${encodeURIComponent(classId)}`);
    setPlan(data?.plan || { by_level:{} });
    await validate();
  }

  async function validate() {
    const { data } = await api.get("/api/validate/pf2e_gear_plan", { params: { class_id: classId }});
    setValidation(data?.issues_by_level || {});
  }

  useEffect(()=>{ if (classId) load(); }, [classId]);

  useEffect(()=>{
    (async()=>{
      const [w, a] = await Promise.all([
        api.get("/api/runes/suggest", { params: { slot: "weapon" }}),
        api.get("/api/runes/suggest", { params: { slot: "armor" }}),
      ]);
      setRuneSuggestW(w.data?.runes || []);
      setRuneSuggestA(a.data?.runes || []);
    })();
  }, []);

  function rowFor(level){
    const key = String(level);
    return plan.by_level[key] || { weapon:{potency:0,striking_rank:0,properties:[]}, armor:{potency:0,resilient_rank:0,properties:[]} };
  }

  async function saveRow(level, nextRow){
    const body = { level, row: nextRow };
    await api.post(`/api/gear/plan/${encodeURIComponent(classId)}`, body);
    await load();
  }

  async function deleteProp(level, slot, rid){
    const body = { level, slot, rune_id: rid, remove: true };
    await api.post(`/api/gear/plan/${encodeURIComponent(classId)}/property`, body);
    await load();
  }

  async function addProp(level, slot, rid){
    const current = rowFor(level);
    const next = JSON.parse(JSON.stringify(current));
    const arr = next[slot].properties || [];
    if (!arr.includes(rid)) arr.push(rid);
    await saveRow(level, next);
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="font-semibold">PF2e Gear Plan</div>
      <div className="text-xs text-gray-600">Click a rune chip to remove. Press Enter to add via autocomplete.</div>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold px-2 py-1">
          <div className="col-span-1">Lv</div>
          <div className="col-span-5">Weapon</div>
          <div className="col-span-5">Armor</div>
          <div className="col-span-1 text-right">⚠</div>
        </div>

        {Array.from({length:20}).map((_,i)=>{
          const L = i+1;
          const row = rowFor(L);
          const issues = validation[L] || [];
          const badge = issues.length ? <span className="text-red-600 font-bold">{issues.length}</span> : <span className="text-gray-400">0</span>;
          return (
            <div key={L} className="grid grid-cols-12 px-2 py-1 border-t text-sm items-center">
              <div className="col-span-1">{L}</div>

              {/* Weapon */}
              <div className="col-span-5">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs">Potency</label>
                  <input type="number" min={0} max={3} className="border rounded px-2 py-0.5 w-16"
                         value={row.weapon.potency||0}
                         onChange={e=>{
                           const next = JSON.parse(JSON.stringify(row));
                           next.weapon.potency = Number(e.target.value||0);
                           saveRow(L,next);
                         }}/>
                  <label className="text-xs">Striking</label>
                  <input type="number" min={0} max={3} className="border rounded px-2 py-0.5 w-16"
                         value={row.weapon.striking_rank||0}
                         onChange={e=>{
                           const next = JSON.parse(JSON.stringify(row));
                           next.weapon.striking_rank = Number(e.target.value||0);
                           saveRow(L,next);
                         }}/>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(row.weapon.properties||[]).map(rid=>(
                    <button key={rid} className="px-2 py-0.5 border rounded text-xs"
                            title="Remove" onClick={()=>deleteProp(L,"weapon",rid)}>{rid} ✕</button>
                  ))}
                </div>
                <div className="mt-1">
                  <input className="border rounded px-2 py-1 text-xs w-64" list={`runes-w-${L}`}
                         placeholder="add property rune…" onKeyDown={e=>{
                           if(e.key==="Enter"){ const v=e.currentTarget.value.trim(); if(v){ addProp(L,"weapon",v); e.currentTarget.value=""; } }
                         }}/>
                  <datalist id={`runes-w-${L}`}>
                    {runeSuggestW.map(r=><option key={r} value={r}>{r}</option>)}
                  </datalist>
                </div>
              </div>

              {/* Armor */}
              <div className="col-span-5">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs">Potency</label>
                  <input type="number" min={0} max={3} className="border rounded px-2 py-0.5 w-16"
                         value={row.armor.potency||0}
                         onChange={e=>{
                           const next = JSON.parse(JSON.stringify(row));
                           next.armor.potency = Number(e.target.value||0);
                           saveRow(L,next);
                         }}/>
                  <label className="text-xs">Resilient</label>
                  <input type="number" min={0} max={3} className="border rounded px-2 py-0.5 w-16"
                         value={row.armor.resilient_rank||0}
                         onChange={e=>{
                           const next = JSON.parse(JSON.stringify(row));
                           next.armor.resilient_rank = Number(e.target.value||0);
                           saveRow(L,next);
                         }}/>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(row.armor.properties||[]).map(rid=>(
                    <button key={rid} className="px-2 py-0.5 border rounded text-xs"
                            title="Remove" onClick={()=>deleteProp(L,"armor",rid)}>{rid} ✕</button>
                  ))}
                </div>
                <div className="mt-1">
                  <input className="border rounded px-2 py-1 text-xs w-64" list={`runes-a-${L}`}
                         placeholder="add armor property…" onKeyDown={e=>{
                           if(e.key==="Enter"){ const v=e.currentTarget.value.trim(); if(v){ addProp(L,"armor",v); e.currentTarget.value=""; } }
                         }}/>
                  <datalist id={`runes-a-${L}`}>
                    {runeSuggestA.map(r=><option key={r} value={r}>{r}</option>)}
                  </datalist>
                </div>
              </div>

              <div className="col-span-1 text-right">{badge}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
