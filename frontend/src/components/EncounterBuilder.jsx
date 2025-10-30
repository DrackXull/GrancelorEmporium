// frontend/src/components/EncounterBuilder.jsx
import React, { useMemo, useState } from "react";
import api from "../utils/api";
import { parseDamageString } from "../utils/dice";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { exportEncounterCsv } from "../utils/export";


const A = (v) => (Array.isArray(v) ? v : []);

export default function EncounterBuilder(props) {
  const {
    party, partyCustom,
    initiative="random", strategy="focus_lowest", trials=1000,
  } = props;

  const [rows, setRows] = useState([
    { name: "Goblin", count: 3, hp: 7, ac: 13, to_hit: 4, dmg: "1d6 slashing", res: "", weak: "", imm: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function addRow() {
    setRows(prev => [...prev, { name: "Mob", count: 1, hp: 8, ac: 10, to_hit: 2, dmg: "1d4", res: "", weak: "", imm: "" }]);
  }
  function delRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }
  function update(i, patch) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function buildPayload() {
    return rows.map(r => ({
      name: r.name || "Mob",
      count: Number(r.count) || 1,
      hp: Number(r.hp) || 1,
      ac: Number(r.ac) || 10,
      to_hit: Number(r.to_hit) || 0,
      damage_profile: parseDamageString(String(r.dmg || "")),
      resistances: String(r.res || "").split(",").map(s=>s.trim()).filter(Boolean),
      weaknesses: String(r.weak || "").split(",").map(s=>s.trim()).filter(Boolean),
      immunities: String(r.imm || "").split(",").map(s=>s.trim()).filter(Boolean),
    }));
  }

  function roundsSeries(hist) {
    if (!hist) return [];
    return Object.keys(hist).map(k => ({ round: Number(k), count: hist[k] })).sort((a,b)=>a.round-b.round);
  }

 async function run() {
  setBusy(true);
  try {
    const payload = {
      encounter_id: "",
      monsters_inline: buildPayload(),
      party,
      party_custom: partyCustom || [],
      initiative, strategy,
      trials,
      trap_ids: A(props?.trapIds) || [],
      ignore_room_effects: !!props?.ignoreRooms,
    };
    const data = await api.runSim(payload);
    setResult(data);
  } catch (e) {
    setResult({ error: e.message });
  } finally {
    setBusy(false);
  }
}


  const histSeries = useMemo(() => roundsSeries(result?.hist_rounds), [result]);

  return (
    <section style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16 }}>
      <header style={{ fontWeight:600, marginBottom:8 }}>Encounter Builder</header>

      <div style={{ display:"grid", gap:8 }}>
        {rows.map((r, i) => (
          <div key={i}
            style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:10, background:"#0f1320" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 1fr 1fr 1fr auto", gap:8, alignItems:"center" }}>
              <input placeholder="Name" value={r.name} onChange={e=>update(i,{name:e.target.value})}/>
              <input type="number" min={1} placeholder="Count" value={r.count} onChange={e=>update(i,{count:e.target.value})}/>
              <input type="number" min={1} placeholder="HP" value={r.hp} onChange={e=>update(i,{hp:e.target.value})}/>
              <input type="number" min={0} placeholder="AC" value={r.ac} onChange={e=>update(i,{ac:e.target.value})}/>
              <input type="number" placeholder="+Hit" value={r.to_hit} onChange={e=>update(i,{to_hit:e.target.value})}/>
              <input placeholder="Damage (e.g. 1d6 slashing)" value={r.dmg} onChange={e=>update(i,{dmg:e.target.value})}/>
              <input placeholder="res,weak,imm" value={`${r.res}`} onChange={e=>update(i,{res:e.target.value})}/>
              <button onClick={()=>delRow(i)} style={{ borderRadius:8 }}>Delete</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginTop:8 }}>
              <input placeholder="Resistances (comma list)" value={r.res} onChange={e=>update(i,{res:e.target.value})}/>
              <input placeholder="Weaknesses (comma list)" value={r.weak} onChange={e=>update(i,{weak:e.target.value})}/>
              <input placeholder="Immunities (comma list)" value={r.imm} onChange={e=>update(i,{imm:e.target.value})}/>
            </div>
          </div>
        ))}
      </div>

     <div style={{ display:"flex", gap:8, marginTop:8 }}>
  <button onClick={addRow} disabled={busy}>+ Add Monster</button>
  <button onClick={run} disabled={busy}>Run Builder Encounter</button>
  <button
    onClick={() => {
      if (!result) return;
      const sum = { source: "builder", trials, initiative, strategy, win_rate: result?.win_rate ?? "", avg_damage: result?.avg_damage ?? "" };
      exportEncounterCsv("tpka_builder.csv", sum, result?.hist_rounds || {});
    }}
    disabled={!result}
  >
    Export CSV
  </button>
</div>


      {/* Results */}
      {result && !result.error && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, opacity:0.7 }}>Win Rate</div>
              <div style={{ fontSize:22, fontWeight:700 }}>
                {Math.round((Number(result.win_rate || 0) * 100 + Number.EPSILON) * 10) / 10}%
              </div>
            </div>
            <div style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, opacity:0.7 }}>Avg Damage</div>
              <div style={{ fontSize:22, fontWeight:700 }}>
                {Math.round((Number(result.avg_damage || 0) + Number.EPSILON) * 10) / 10}
              </div>
            </div>
            <div style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, opacity:0.7 }}>Rounds Covered</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{histSeries.length || 0}</div>
            </div>
          </div>

          {histSeries.length > 0 && (
            <div style={{ width:"100%", height:260, marginTop:12 }}>
              <ResponsiveContainer>
                <BarChart data={histSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="round" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {result?.error && (
        <pre style={{ marginTop:12, color:"#fda4af" }}>{String(result.error)}</pre>
      )}
    </section>
  );
}
