// frontend/src/components/OverridesEditor.jsx
import React, { useEffect, useState } from "react";
import api, { getOverrides, writeOverrides } from "../utils/api";

const btn = { borderRadius: 8, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.15)" };

export default function OverridesEditor({ ruleset = "pf2e" }) {
  const [text, setText] = useState("{}");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getOverrides()
      .then(o => setText(JSON.stringify(o || { classes: {} }, null, 2)))
      .catch(e => setStatus(`Failed to load overrides: ${e.message}`));
  }, []);

  async function save() {
    try {
      const parsed = JSON.parse(text);
      await writeOverrides(parsed);
      setStatus("Saved overrides and reloaded data ✓");
      setTimeout(()=>setStatus(""), 2000);
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
  }

  async function seed() {
    try {
      const res = await api.seedDefaults({ ruleset, force: false });
      alert(`Seeded defaults for ruleset=${ruleset}\nCreated: ${res.created?.length || 0}\nSkipped: ${res.skipped?.length || 0}`);
      const o = await getOverrides();
      setText(JSON.stringify(o || { classes: {} }, null, 2));
    } catch (e) {
      alert(`Seed failed: ${e.message || e}`);
    }
  }

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <header style={{ fontWeight: 700 }}>Runtime Overrides</header>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={save} style={btn}>Save</button>
        <button onClick={seed} style={btn} title="Generate base defaults for classes missing them (writes to runtime overrides)">
          Generate Defaults (missing)
        </button>
      </div>
      {status && <div className="muted">{status}</div>}
      <textarea
        style={{ minHeight: 320, fontFamily: "monospace", fontSize: 13, width: "100%" }}
        value={text}
        onChange={(e)=> setText(e.target.value)}
      />
    </section>
  );
}
