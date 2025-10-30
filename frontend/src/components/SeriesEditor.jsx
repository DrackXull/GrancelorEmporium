// frontend/src/components/SeriesEditor.jsx
import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { exportEncounterCsv } from "../utils/export";
const A = (v) => (Array.isArray(v) ? v : []);

export default function SeriesEditor({
  data,
  party, partyCustom,
  initiative, strategy,
  defaultTrials = 500,
}) {
  const encounters = A(data?.encounters);

  const [rows, setRows] = React.useState([
    { encounter_id: encounters[0]?.id || "", trials: defaultTrials, ignore_room_effects: false },
  ]);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState("");

  function addRow() {
    setRows(prev => [...prev, { encounter_id: encounters[0]?.id || "", trials: defaultTrials, ignore_room_effects: false }]);
  }
  function delRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = {
        party,
        party_custom: partyCustom || [],
        sequence: rows.map(r => ({
          type: "encounter",
          encounter_id: r.encounter_id,
          trials: Number(r.trials) || defaultTrials,
          ignore_room_effects: !!r.ignore_room_effects,
        })),
        initiative, strategy,
      };
      const { data } = await api.post("/api/run_series", body);
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function exportAllCsv() {
    if (!result?.steps) return;
    const histMerged = {};
    const sum = {};
    (result.steps || []).forEach((step, idx) => {
      sum[`step_${idx+1}_win_rate`]  = step?.win_rate ?? "";
      sum[`step_${idx+1}_avg_damage`] = step?.avg_damage ?? "";
    });
    exportEncounterCsv("tpka_series.csv", sum, histMerged);
  }

  return (
    <section style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16 }}>
      <header style={{ fontWeight:600, marginBottom:8 }}>Series Editor (Gauntlet)</header>

      <div style={{ display:"grid", gap:10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px auto", gap:8, alignItems:"center" }}>
              <select
                value={r.encounter_id}
                onChange={(e)=>updateRow(i,{ encounter_id: e.target.value })}
              >
                {encounters.map(e => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
              </select>
              <input
                type="number"
                min={50}
                step={50}
                value={r.trials}
                onChange={(e)=>updateRow(i,{ trials: e.target.value })}
                title="Trials"
              />
              <label style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input
                  type="checkbox"
                  checked={!!r.ignore_room_effects}
                  onChange={(e)=>updateRow(i,{ ignore_room_effects: e.target.checked })}
                />
                Ignore Room Effects
              </label>
              <button onClick={()=>delRow(i)} style={{ marginLeft:"auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={addRow}>+ Add Step</button>
        <button onClick={run} disabled={busy}>{busy ? "Running…" : "Run Series"}</button>
        <button onClick={exportAllCsv} disabled={!result}>Export CSV</button>
      </div>

      {error && <pre style={{ marginTop:10, color:"#fca5a5" }}>{String(error)}</pre>}

      {result?.steps && (
        <div style={{ marginTop:12, display:"grid", gap:8 }}>
          {(result.steps || []).map((s, idx) => (
            <div key={idx} style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:10 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>Step {idx+1}</div>
              {"error" in s ? (
                <div style={{ color:"#fca5a5" }}>{String(s.error || "Error")}</div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:8 }}>
                  <Info label="Win Rate" value={`${Math.round((Number(s.win_rate||0)*100+Number.EPSILON)*10)/10}%`} />
                  <Info label="Avg Damage" value={`${Math.round((Number(s.avg_damage||0)+Number.EPSILON)*10)/10}`} />
                  <Info label="Rounds" value={`${Object.keys(s.hist_rounds||{}).length}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:12 }}>
      <div style={{ fontSize:12, opacity:0.7 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700 }}>{value}</div>
    </div>
  );
}