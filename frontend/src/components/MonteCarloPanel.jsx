// frontend/src/components/MonteCarloPanel.jsx
import React, { useMemo, useState } from "react";
import api from "../utils/api";
import { exportEncounterCsv } from "../utils/export";
 import {
   ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
 } from "recharts";

const A = (v) => (Array.isArray(v) ? v : []);

export default function MonteCarloPanel({
  party,
  partyCustom = [],
  encounterId,
  trials = 1000,
  initiative = "random",
  strategy = "focus_lowest",
  trapIds = [],
  ignoreRooms = false,
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function roundsSeries(hist) {
    if (!hist) return [];
    return Object.keys(hist).map(k => ({ round: Number(k), count: hist[k] })).sort((a,b)=>a.round-b.round);
  }

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = {
        encounter_id: encounterId,
        trap_ids: trapIds,
        trials,
        initiative,
        strategy,
        ignore_room_effects: !!ignoreRooms,
        party,
        party_custom: partyCustom,
      };
      const data = await api.runSim(body);
      setResult(data);
    } catch (e) {
      setError(e.__tpka_message || e.message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const sum = {
      encounter_id: encounterId,
      trials,
      initiative,
      strategy,
      win_rate: result?.win_rate ?? "",
      avg_damage: result?.avg_damage ?? "",
    };
    exportEncounterCsv("tpka_encounter.csv", sum, result?.hist_rounds || {});
  }

  const histSeries = useMemo(() => roundsSeries(result?.hist_rounds), [result]);

  return (
    <section style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16 }}>
      <header style={{ fontWeight:600, marginBottom:8 }}>Monte Carlo Encounter</header>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={run} disabled={busy} style={{ borderRadius:8 }}>
          {busy ? "Running…" : "Run Simulation"}
        </button>
        <button onClick={exportCsv} disabled={!result} style={{ borderRadius:8 }}>
          Export CSV
        </button>
      </div>

      {error && <pre style={{ marginTop:10, color:"#fca5a5" }}>{String(error)}</pre>}

      {result && !error && (
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
              <div style={{ fontSize:22, fontWeight:700 }}>{(Object.keys(result.hist_rounds || {}).length) || 0}</div>
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
    </section>
  );
}
