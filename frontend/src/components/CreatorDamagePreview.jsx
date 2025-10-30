// frontend/src/components/CreatorDamagePreview.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

/**
 * Lightweight chooser + preview:
 * - Pulls items via /api/catalog?kind=items&ruleset=...
 * - Filters to type: "weapon"
 * - Lets user pick striking rank, potency, agile flag, target AC, strikes
 * - Calls /api/dpr/preview_plus via api.dprPreviewPlus
 */
export default function CreatorDamagePreview({
  ruleset = "pf2e",
  initialWeaponId = "",
  onChange, // optional callback with the last preview payload/result
}) {
  const [weapons, setWeapons] = useState([]);
  const [weaponId, setWeaponId] = useState(initialWeaponId);
  const [weaponDice, setWeaponDice] = useState("1d8");
  const [isAgile, setIsAgile] = useState(false);
  const [strikingRank, setStrikingRank] = useState(0);
  const [potency, setPotency] = useState(0);
  const [abilityMod, setAbilityMod] = useState(4);
  const [targetAC, setTargetAC] = useState(24);
  const [strikes, setStrikes] = useState(2);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getCreatorCatalog(ruleset)
      .then((data) => {
        const all = Array.isArray(data?.items) ? data.items : [];
        const ws = all.filter((it) => String(it?.type || "").toLowerCase() === "weapon");
        if (!alive) return;
        setWeapons(ws);
        if (!weaponId && ws.length) {
          setWeaponId(ws[0].id || ws[0].name || "");
          setWeaponDice(ws[0].die || "1d8");
          setIsAgile(!!ws[0].agile);
        }
      })
      .catch(()=>{});
    return () => { alive = false; };
  }, [ruleset]); // load once per ruleset

  const chosen = useMemo(() => {
    return weapons.find(w => (w.id && w.id===weaponId) || (w.name && w.name===weaponId));
  }, [weapons, weaponId]);

  useEffect(() => {
    if (!chosen && !weaponDice) return;
    const body = {
      weaponDice: chosen?.die || weaponDice || "1d8",
      strikingRank,
      properties: chosen?.properties || [],
      targetAC,
      // derive a coarse attackBonus from potency + ability; refine later with class prof
      attackBonus: potency + abilityMod + 8,  // simple baseline; tweak later
      strikes,
      isAgile: !!(chosen?.agile || isAgile),
    };
    let cancel = false;
    api.dprPreviewPlus(body)
      .then((data) => {
        if (cancel) return;
        setPreview(data);
        onChange?.({ body, data, weapon: chosen });
      })
      .catch(() => { if (!cancel) setPreview(null); });
    return () => { cancel = true; };
  }, [chosen, weaponDice, strikingRank, potency, abilityMod, targetAC, strikes, isAgile, onChange]);

  return (
    <section style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
      <header style={{ fontWeight: 700, marginBottom: 8 }}>Damage Preview</header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Weapon</span>
          <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
            {weapons.map(w => (
              <option key={w.id || w.name} value={w.id || w.name}>
                {w.name || w.id} {w.agile ? "(agile)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Dice</span>
          <input
            value={weaponDice}
            onChange={(e)=> setWeaponDice(e.target.value)}
            placeholder="e.g., 1d8"
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Striking Rank</span>
          <input type="number" min={0} max={3} value={strikingRank} onChange={(e)=> setStrikingRank(Number(e.target.value)||0)} />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Potency</span>
          <input type="number" min={0} max={3} value={potency} onChange={(e)=> setPotency(Number(e.target.value)||0)} />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Ability Mod</span>
          <input type="number" value={abilityMod} onChange={(e)=> setAbilityMod(Number(e.target.value)||0)} />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Target AC</span>
          <input type="number" value={targetAC} onChange={(e)=> setTargetAC(Number(e.target.value)||10)} />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted">Strikes</span>
          <input type="number" min={1} max={4} value={strikes} onChange={(e)=> setStrikes(Number(e.target.value)||1)} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={isAgile} onChange={(e)=> setIsAgile(e.target.checked)} />
          <span>Agile</span>
        </label>
      </div>

      {preview && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Card label="Avg / Hit" value={preview.avg_per_hit?.toFixed(2)} />
          <Card label="Total DPR" value={preview.dpr_total?.toFixed(2)} />
          <Card label="Strikes" value={preview.strikes} />
          <div style={{ gridColumn: "1 / -1", fontSize: 12, opacity: 0.75 }}>
            MAP: {preview.map_penalties?.join(", ") || "-"} · {preview.breakdown}
          </div>
        </div>
      )}
    </section>
  );
}

function Card({ label, value }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
