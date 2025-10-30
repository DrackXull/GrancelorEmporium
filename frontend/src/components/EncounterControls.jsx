// frontend/src/components/EncounterControls.jsx
import React from "react";

const A = (v) => (Array.isArray(v) ? v : []);

export default function EncounterControls({
  trials, setTrials,
  initiative, setInitiative,
  strategy, setStrategy,
  traps, trapIds, setTrapIds,
  roomEffects, ignoreRooms, setIgnoreRooms,
}) {
  function toggleTrap(id) {
    setTrapIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const trapList = A(traps);
  const roomList = A(roomEffects);

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <header style={{ fontWeight: 600, marginBottom: 8 }}>Encounter Controls</header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr 1fr",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Trials</label>
          <input
            type="number"
            min={10}
            step={100}
            value={trials}
            onChange={(e) => setTrials(Number(e.target.value) || 100)}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Initiative</label>
          <select value={initiative} onChange={(e) => setInitiative(e.target.value)}>
            <option value="random">random</option>
            <option value="party_first">party_first</option>
            <option value="monsters_first">monsters_first</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Strategy</label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="focus_lowest">focus_lowest</option>
            <option value="focus_highest">focus_highest</option>
            <option value="spread">spread</option>
          </select>
        </div>
      </div>

      {/* Traps */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Traps (apply to this sim)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, maxHeight: 160, overflow: "auto", border: "1px solid #1f2538", borderRadius: 8, padding: 8, background:"#0b0f19" }}>
          {trapList.length === 0 && <div style={{ fontSize:12, opacity:0.6 }}>No traps data.</div>}
          {trapList.map(t => (
            <label key={t.id} style={{ display:"flex", gap:8, alignItems:"center", fontSize:13 }}>
              <input
                type="checkbox"
                checked={trapIds.includes(t.id)}
                onChange={() => toggleTrap(t.id)}
              />
              <span>{t.name || t.id}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Room effects */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Room Effects</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <label style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input
              type="checkbox"
              checked={!!ignoreRooms}
              onChange={(e)=>setIgnoreRooms(e.target.checked)}
            />
            Ignore Room Effects
          </label>
          <span style={{ fontSize:12, opacity:0.7 }}>
            {ignoreRooms ? "Room effects disabled" : `${A(roomList).length} available (applied per encounter definition)`}
          </span>
        </div>
      </div>
    </section>
  );
}
