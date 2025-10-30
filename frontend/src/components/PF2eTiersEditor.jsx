// frontend/src/components/PF2eTiersEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import  api  from "../utils/api";

export default function PF2eTiersEditor() {
  const [classes, setClasses] = useState([]);
  const [schema, setSchema] = useState(null);
  const [weaponGroups, setWeaponGroups] = useState([]);
  const [classId, setClassId] = useState("");
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(()=>{
    api.get("/api/classes", { params: { ruleset: "pf2e" }})
      .then(({data})=>setClasses(data||[]))
      .catch(()=>setClasses([]));

    api.get("/api/pf2e/tiers/schema")
      .then(({data})=>setSchema(data||null))
      .catch(()=>{});

    api.get("/api/weapons/groups")
      .then(({data})=>setWeaponGroups(data?.groups||[]))
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!classId) return;
    setBusy(true);
    api.get(`/api/pf2e/tiers/${encodeURIComponent(classId)}`)
      .then(({data})=>setDoc(data||{}))
      .finally(()=>setBusy(false));
  },[classId]);

  async function save() {
    if (!classId || !doc) return;
    setBusy(true);
    try {
      await api.post(`/api/pf2e/tiers/${encodeURIComponent(classId)}`, doc);
      setMsg("Saved ✓");
      setTimeout(()=>setMsg(""), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function applyRuntime() {
    if (!classId) return;
    setBusy(true);
    try {
      await api.post(`/api/pf2e/tiers/${encodeURIComponent(classId)}/apply_runtime`);
      setMsg("Applied to runtime ✓");
      setTimeout(()=>setMsg(""), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function revertOverrides() {
    setBusy(true);
    try {
      await api.post("/api/runtime/overrides/revert");
      setMsg("Runtime overrides reverted ✓");
      setTimeout(()=>setMsg(""), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function exportJson() {
    if (!classId) return;
    const url = `/api/pf2e/tiers/${encodeURIComponent(classId)}/export.json`;
    window.open(url, "_blank", "noopener");
  }

  const currentClass = useMemo(()=> classes.find(c => (c.id||c.archetype)===classId), [classes, classId]);

  return (
    <section className="border rounded p-3 space-y-3">
      <div className="font-semibold">PF2e Tier Config</div>

      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-600">Class</label>
        <select className="border rounded px-2 py-1" value={classId} onChange={e=>setClassId(e.target.value)}>
          <option value="">— choose —</option>
          {classes.map(c=>(
            <option key={c.id||c.archetype} value={c.id||c.archetype}>{c.name}</option>
          ))}
        </select>
        <button onClick={save} disabled={busy || !doc} className="px-3 py-1 border rounded">Save</button>
        <button onClick={applyRuntime} disabled={busy || !classId} className="px-3 py-1 border rounded">Apply Runtime</button>
        <button onClick={revertOverrides} disabled={busy} className="px-3 py-1 border rounded">Revert Overrides</button>
        <button onClick={exportJson} disabled={!classId} className="px-3 py-1 border rounded">Export JSON</button>
        {msg && <span className="text-sm opacity-80">{msg}</span>}
      </div>

      {!doc ? (
        <div className="text-sm text-gray-600">{busy ? "Loading…" : "Pick a class to edit."}</div>
      ) : (
        <div className="grid gap-2">
          {/* Minimal editor scaffold; expand to your schema */}
          <label className="text-xs text-gray-600">JSON</label>
          <textarea
            className="border rounded p-2 font-mono text-sm"
            rows={18}
            value={JSON.stringify(doc, null, 2)}
            onChange={e=>{
              try {
                const parsed = JSON.parse(e.target.value);
                setDoc(parsed);
              } catch {
                // keep last valid doc until JSON is valid again
              }
            }}
          />
          {schema ? (
            <details>
              <summary className="cursor-pointer text-sm">Schema</summary>
              <pre className="text-xs">{JSON.stringify(schema,null,2)}</pre>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}
