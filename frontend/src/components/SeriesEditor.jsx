// frontend/src/components/SeriesEditor.jsx
import React, { useEffect, useState } from "react";
import api from "../utils/api";

const btn = { borderRadius: 8, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.15)" };

export default function SeriesEditor({ ruleset = "pf2e" }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [payload, setPayload] = useState("{}");
  const [status, setStatus] = useState("");

  async function refresh() {
    try {
      const data = await api.rawGet("/series/list", { params: { ruleset } });
      setList(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    }
  }

  useEffect(() => { refresh(); }, [ruleset]);

  async function save() {
    try {
      const body = JSON.parse(payload);
      await api.rawPost("/series/save", { name, ruleset, body });
      setStatus("Saved ✓");
      refresh();
      setTimeout(()=>setStatus(""), 1500);
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
  }

  async function del(n) {
    try {
      await api.rawPost("/series/delete", { name: n, ruleset });
      refresh();
    } catch (e) {
      setStatus(`Delete failed: ${e.message}`);
    }
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <header style={{ fontWeight: 700 }}>Series Editor</header>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Name</div>
          <input value={name} onChange={(e)=> setName(e.target.value)} placeholder="series name" />
          <div className="muted" style={{ marginTop: 10, marginBottom: 6 }}>Payload (JSON)</div>
          <textarea
            style={{ minHeight: 280, width: "100%", fontFamily: "monospace", fontSize: 13 }}
            value={payload}
            onChange={(e)=> setPayload(e.target.value)}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={save} style={btn}>Save</button>
            {status && <span className="muted">{status}</span>}
          </div>
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Existing</div>
          <div style={{ display: "grid", gap: 6 }}>
            {list.map((it) => (
              <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button style={btn} onClick={async ()=>{
                  setName(it.name);
                  try {
                    const d = await api.rawGet("/series/get", { params: { name: it.name, ruleset } });
                    setPayload(JSON.stringify(d?.body ?? {}, null, 2));
                  } catch (e) {
                    setStatus(`Load failed: ${e.message}`);
                  }
                }}>
                  Load
                </button>
                <button style={btn} onClick={()=> del(it.name)}>Delete</button>
                <div>{it.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
