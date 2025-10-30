import React, { useEffect, useState } from "react";
import api from "../utils/api";

const A = (v) => (Array.isArray(v) ? v : []);

function Row({ i, row, onChange, onDel, types }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 140px auto", gap: 8, alignItems: "center" }}>
      <input type="number" min={0} placeholder="Amount" value={row.amount} onChange={(e) => onChange(i, { amount: e.target.value })} />
      <input placeholder="Notes (optional)" value={row.note || ""} onChange={(e) => onChange(i, { note: e.target.value })} />
      <select value={row.type} onChange={(e) => onChange(i, { type: e.target.value })}>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={() => onDel(i)} style={{ borderRadius: 8 }}>Delete</button>
    </div>
  );
}

export default function DamagePanel() {
  const [types, setTypes] = useState(["slashing","piercing","bludgeoning","neutral"]);
  const [rows, setRows] = useState([{ amount: 8, type: "slashing", note: "" }]);
  const [res, setRes] = useState("");
  const [weak, setWeak] = useState("");
  const [imm, setImm] = useState("");
  const [resMult, setResMult] = useState(0.5);
  const [weakMult, setWeakMult] = useState(2.0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get("/damage/types")
      .then(({ data }) => { if (alive) setTypes(A(data.types).length ? data.types : types); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line
  }, []);

  function addRow() { setRows((prev) => [...prev, { amount: 0, type: types[0] || "neutral" }]); }
  function delRow(i) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }
  function changeRow(i, patch) { setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }

  function toList(s) {
    return String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  }

  async function apply() {
    setBusy(true);
    try {
      const body = {
        instances: rows.map((r) => ({ amount: Number(r.amount) || 0, type: r.type || "neutral" })),
        resistances: toList(res),
        weaknesses: toList(weak),
        immunities: toList(imm),
        resist_multiplier: Number(resMult) || 0.5,
        weak_multiplier: Number(weakMult) || 2.0,
      };
      const { data } = await api.post("/damage/apply", body);
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  const breakdown = result?.breakdown || {};
  const totalBase = result?.total_base ?? 0;
  const totalFinal = result?.total_final ?? 0;

  return (
    <section style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
      <header style={{ fontWeight: 600, marginBottom: 8 }}>Damage Types Tester</header>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r, i) => <Row key={i} i={i} row={r} onChange={changeRow} onDel={delRow} types={types} />)}
        <div><button onClick={addRow} style={{ borderRadius: 8 }}>+ Add Instance</button></div>

        <div style={{ borderTop: "1px solid #22283a", paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          <input placeholder="resistances (comma)" value={res} onChange={(e) => setRes(e.target.value)} />
          <input placeholder="weaknesses (comma)" value={weak} onChange={(e) => setWeak(e.target.value)} />
          <input placeholder="immunities (comma)" value={imm} onChange={(e) => setImm(e.target.value)} />
          <input type="number" step="0.1" min="0" placeholder="resist x" value={resMult} onChange={(e) => setResMult(e.target.value)} title="Resist multiplier" />
          <input type="number" step="0.1" min="0" placeholder="weak x" value={weakMult} onChange={(e) => setWeakMult(e.target.value)} title="Weakness multiplier" />
        </div>

        <div><button onClick={apply} disabled={busy} style={{ borderRadius: 8 }}>Apply</button></div>

        {result && !result.error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <Card label="Total Base" value={totalBase} />
            <Card label="Total Final" value={totalFinal} />
            <Card label="Types" value={types.length} />
          </div>
        )}

        {result?.breakdown && (
          <div style={{ marginTop: 10 }}>
            <header style={{ fontWeight: 600, marginBottom: 6 }}>Breakdown by Type</header>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #22283a" }}>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Base</th>
                  <th style={{ padding: "6px 4px" }}>Final</th>
                  <th style={{ padding: "6px 4px" }}>×</th>
                  <th style={{ padding: "6px 4px" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(breakdown).map((k) => {
                  const v = breakdown[k];
                  return (
                    <tr key={k} style={{ borderBottom: "1px solid #1a1f30" }}>
                      <td style={{ padding: "6px 4px" }}>{k}</td>
                      <td style={{ padding: "6px 4px" }}>{Math.round((Number(v.base || 0) + Number.EPSILON) * 10) / 10}</td>
                      <td style={{ padding: "6px 4px" }}>{Math.round((Number(v.final || 0) + Number.EPSILON) * 10) / 10}</td>
                      <td style={{ padding: "6px 4px" }}>{v.mult}</td>
                      <td style={{ padding: "6px 4px", opacity: 0.8 }}>{v.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result?.error && <pre style={{ color: "#fda4af" }}>{String(result.error)}</pre>}
      </div>
    </section>
  );
}

function Card({ label, value }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{Math.round((Number(value) + Number.EPSILON) * 10) / 10}</div>
    </div>
  );
}
