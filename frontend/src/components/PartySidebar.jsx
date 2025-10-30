// frontend/src/components/PartySidebar.jsx
import React from "react";
import { parseDamageString, stringifyDamageProfile } from "../utils/dice";
import { applyPathAndItems } from "../utils/mods";

const A = (v) => (Array.isArray(v) ? v : []);

function Delta({ label, base, mod }) {
  const d = (mod ?? 0) - (base ?? 0);
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  const val = Math.abs(d);
  const color = d > 0 ? "#10b981" : d < 0 ? "#ef4444" : "#9ca3af";
  return (
    <span title={`${label}: base ${base} → ${mod}`} style={{
      fontSize: 11, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "1px 6px",
      color, background: "rgba(255,255,255,0.03)", marginLeft: 6
    }}>
      {label}:{' '}{mod}{' '}{sign}{val ? val : 0}
    </span>
  );
}

export default function PartySidebar({
  data,
  party, setParty,
  partySize, setPartySize,
}) {
  const pcs = A(data?.pc_baselines);
  const paths = A(data?.paths);
  const items = A(data?.items);

  const [openIdx, setOpenIdx] = React.useState(null);
  const [itemFilter, setItemFilter] = React.useState("");

  function updateSlot(i, patch) {
    setParty(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function clearSlot(i) {
    updateSlot(i, {
      pc_id: "",
      path_id: null,
      item_ids: [],
      hp: undefined, ac: undefined, to_hit: undefined,
      damage_profile: undefined,
      resistances: undefined, weaknesses: undefined, immunities: undefined,
    });
  }

  function duplicateTo(i, j) {
    setParty(prev => {
      const next = [...prev];
      next[j] = { ...prev[i] };
      return next;
    });
  }

  function quickAdjust(i, k, delta) {
    setParty(prev => {
      const next = [...prev];
      const v = Number(next[i]?.[k] ?? 0);
      next[i] = { ...next[i], [k]: Math.max(0, v + delta) };
      return next;
    });
  }

  function parseList(s) {
    return String(s || "")
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);
  }

  function toggleItem(i, itemId) {
    setParty(prev => {
      const next = [...prev];
      const current = A(next[i]?.item_ids);
      const has = current.includes(itemId);
      const updated = has ? current.filter(id => id !== itemId) : [...current, itemId];
      next[i] = { ...(next[i] || {}), item_ids: updated };
      return next;
    });
  }

  const filteredItems = React.useMemo(() => {
    const q = itemFilter.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter(it =>
      String(it.name || it.id).toLowerCase().includes(q) ||
      String(it.type || "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [items, itemFilter]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 700, opacity: 0.9 }}>Party</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Size</span>
          <input
            type="number"
            min={1}
            max={8}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value) || 1)}
            style={{ width: 58, padding: "6px 8px", borderRadius: 8, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const slot = party[i] || {};
          const active = i < partySize;
          const basePc = pcs.find(p => p.id === slot.pc_id || p.archetype === slot.pc_id) || null;

          const baseHp  = basePc?.hp ?? 10;
          const baseAc  = basePc?.ac ?? 10;
          const baseHit = basePc?.to_hit ?? 0;

          const preview = basePc
            ? applyPathAndItems(basePc, slot.path_id, A(slot.item_ids), paths, items)
            : { hp: baseHp, ac: baseAc, to_hit: baseHit, damage_profile: basePc?.damage_profile || [] };

          const effHp  = slot.hp     ?? preview.hp;
          const effAc  = slot.ac     ?? preview.ac;
          const effHit = slot.to_hit ?? preview.to_hit;

          const dmgString = stringifyDamageProfile(slot.damage_profile ?? preview.damage_profile ?? []);
          const resTxt  = (slot.resistances || []).join(", ");
          const weakTxt = (slot.weaknesses || []).join(", ");
          const immTxt  = (slot.immunities || []).join(", ");

          return (
            <div key={i}
              style={{
                opacity: active ? 1 : 0.45,
                pointerEvents: active ? "auto" : "none",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#0f1320",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                  display: "grid", placeItems: "center", fontWeight: 800
                }}>{i + 1}</div>

                <div style={{ display: "grid", gap: 6 }}>
                  {/* PC select */}
                  <select
                    value={slot.pc_id || ""}
                    onChange={(e) => updateSlot(i, { pc_id: e.target.value })}
                    style={{ padding: "6px 8px", borderRadius: 8, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42" }}
                  >
                    <option value="">— empty —</option>
                    {pcs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.archetype || p.id}
                      </option>
                    ))}
                  </select>

                  {/* Path select + preview deltas */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <select
                      value={slot.path_id || ""}
                      onChange={(e) => updateSlot(i, { path_id: e.target.value || null })}
                      style={{ padding: "6px 8px", borderRadius: 8, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42" }}
                    >
                      <option value="">— no path —</option>
                      {paths.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.id}
                        </option>
                      ))}
                    </select>
                    <Delta label="HP" base={baseHp} mod={preview.hp} />
                    <Delta label="AC" base={baseAc} mod={preview.ac} />
                    <Delta label="+Hit" base={baseHit} mod={preview.to_hit} />
                  </div>

                  {/* Items multi-select + preview */}
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 11, opacity: 0.7 }}>Items</label>
                      <input
                        placeholder="filter…"
                        value={itemFilter}
                        onChange={(e)=>setItemFilter(e.target.value)}
                        style={{ padding:"4px 8px", borderRadius:8, background:"#101525", color:"#e8e8e8", border:"1px solid #2a2f42", width:140 }}
                      />
                    </div>
                    <div style={{ maxHeight: 120, overflow: "auto", border: "1px solid #1f2538", borderRadius: 8, padding: 8, background:"#0b0f19" }}>
                      {filteredItems.length === 0 && (
                        <div style={{ fontSize: 12, opacity: 0.6 }}>No items.</div>
                      )}
                      {filteredItems.map(it => {
                        const checked = A(slot.item_ids).includes(it.id);
                        return (
                          <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0" }}>
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={() => toggleItem(i, it.id)}
                            />
                            <span>{it.name || it.id}</span>
                            <span style={{ fontSize: 11, opacity: 0.6 }}>
                              {it.type ? `· ${it.type}` : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {/* Repeat preview after item changes */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Delta label="HP" base={baseHp} mod={preview.hp} />
                      <Delta label="AC" base={baseAc} mod={preview.ac} />
                      <Delta label="+Hit" base={baseHit} mod={preview.to_hit} />
                    </div>
                  </div>

                  {/* Inline stat editors (final overrides) */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    <NumField label="HP" value={effHp} onMinus={()=>quickAdjust(i,"hp",-1)} onPlus={()=>quickAdjust(i,"hp",+1)} onChange={(v)=>updateSlot(i,{hp:v})} />
                    <NumField label="AC" value={effAc} onMinus={()=>quickAdjust(i,"ac",-1)} onPlus={()=>quickAdjust(i,"ac",+1)} onChange={(v)=>updateSlot(i,{ac:v})} />
                    <NumField label="To Hit" value={effHit} onMinus={()=>quickAdjust(i,"to_hit",-1)} onPlus={()=>quickAdjust(i,"to_hit",+1)} onChange={(v)=>updateSlot(i,{to_hit:v})} />
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <button onClick={() => clearSlot(i)} style={{ borderRadius: 8, padding: "6px 8px" }}>
                    Clear
                  </button>
                  <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{ borderRadius: 8, padding: "6px 8px" }}>
                    {openIdx === i ? "Hide" : "Advanced"}
                  </button>
                  {i > 0 && (
                    <button onClick={() => duplicateTo(i - 1, i)} style={{ borderRadius: 8, padding: "6px 8px" }}>
                      Copy ↑
                    </button>
                  )}
                </div>
              </div>

              {openIdx === i && (
                <div style={{ marginTop: 10, display: "grid", gap: 8, background:"#0b0f19", border:"1px solid #1f2435", borderRadius:8, padding:10 }}>
                  <div style={{ display:"grid", gap:6 }}>
                    <label style={{ fontSize:12, opacity:0.8 }}>Damage Profile (e.g. <code>1d8+3 slashing, 1d6 cold, 2d4+1</code>)</label>
                    <input
                      value={dmgString}
                      onChange={e => {
                        const arr = parseDamageString(e.target.value);
                        updateSlot(i, { damage_profile: arr });
                      }}
                      style={{ padding:"6px 8px", borderRadius:8, background:"#121622", color:"#e8e8e8", border:"1px solid #2a2f42" }}
                      list="tpka-dmg-types"
                    />
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
                    <TextList label="Resistances" value={resTxt} onChange={(txt)=>updateSlot(i,{resistances:parseList(txt)})} placeholder="slashing, fire" />
                    <TextList label="Weaknesses"  value={weakTxt} onChange={(txt)=>updateSlot(i,{weaknesses:parseList(txt)})} placeholder="cold" />
                    <TextList label="Immunities"  value={immTxt} onChange={(txt)=>updateSlot(i,{immunities:parseList(txt)})} placeholder="poison" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, onMinus, onPlus }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <label style={{ fontSize: 11, opacity: 0.7 }}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 4 }}>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ padding: "6px 8px", borderRadius: 8, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42" }}
        />
        <button onClick={onMinus} style={{ borderRadius:8 }}>-</button>
        <button onClick={onPlus} style={{ borderRadius:8 }}>+</button>
      </div>
    </div>
  );
}

function TextList({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize:12, opacity:0.8 }}>{label}</label>
      <input
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:"100%", padding:"6px 8px", borderRadius:8, background:"#121622", color:"#e8e8e8", border:"1px solid #2a2f42" }}
      />
    </div>
  );
}
