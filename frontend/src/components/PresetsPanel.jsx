// frontend/src/components/PresetsPanel.jsx
import React from "react";

const A = (v) => (Array.isArray(v) ? v : []);

export default function PresetsPanel({
  presets, setPresets, presetName, setPresetName,
  onLoadPreset,
}) {
  const [filter, setFilter] = React.useState("");

  function savePreset() {
    const name = (presetName || "").trim() || `Preset ${presets.length + 1}`;
    // We read current app state via a getter attached by App.jsx
    const getCurrent = window.__tpka_get_current_state;
    if (!getCurrent) {
      alert("Preset save hook not found.");
      return;
    }
    const snapshot = getCurrent();
    const entry = { id: Date.now(), name, snapshot };
    setPresets(prev => {
      const existed = prev.find(p => p.name === name);
      if (existed) return prev.map(p => p.name === name ? entry : p);
      return [...prev, entry];
    });
  }

  function loadPreset(p) {
    onLoadPreset?.(p.snapshot);
  }

  function deletePreset(id) {
    setPresets(prev => prev.filter(p => p.id !== id));
  }

  const show = A(presets)
    .filter(p => !filter || (p.name || "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <section style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16, marginTop:12 }}>
      <header style={{ fontWeight:600, marginBottom:8 }}>Presets</header>

      <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8 }}>
        <input
          placeholder="Preset name"
          value={presetName}
          onChange={(e)=>setPresetName(e.target.value)}
          style={{ padding:"6px 8px", borderRadius:8, background:"#121622", color:"#e8e8e8", border:"1px solid #2a2f42" }}
        />
        <button onClick={savePreset} style={{ borderRadius:8 }}>Save Preset</button>
        <input
          placeholder="Filter"
          value={filter}
          onChange={(e)=>setFilter(e.target.value)}
          style={{ padding:"6px 8px", borderRadius:8, background:"#121622", color:"#e8e8e8", border:"1px solid #2a2f42" }}
        />
      </div>

      <div style={{ marginTop:10, display:"grid", gap:8 }}>
        {show.length === 0 && <div style={{ fontSize:12, opacity:0.7 }}>No presets yet.</div>}
        {show.map(p => (
          <div key={p.id}
            style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8,
                     border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:10 }}>
            <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
            <button onClick={()=>loadPreset(p)} style={{ borderRadius:8 }}>Load</button>
            <button onClick={()=>deletePreset(p.id)} style={{ borderRadius:8, background:"#301414", border:"1px solid #7f1d1d" }}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
