import React, { useEffect, useMemo, useState } from "react";
import { getCreatorCatalog, getProgression } from "../utils/api";
import CreatorDamagePreview from "./CreatorDamagePreview";

/**
 * A minimal, compile-safe Creator panel that:
 * - loads catalog (classes, weapons, etc.)
 * - lets the user choose ruleset, class, level, and weapon
 * - shows key stats + the new Damage Preview for the selected weapon
 *
 * NOTE:
 * - This is a drop-in replacement. If you already have more fields (ancestry, background, armor, runes),
 *   you can merge those back in around the marked anchors.
 */
export default function CreatorPanel() {
  const [ruleset, setRuleset] = useState("pf2e"); // or infer from /api/data
  const [level, setLevel] = useState(1);
  const [classId, setClassId] = useState("");      // fighter / wizard ...
  const [weaponId, setWeaponId] = useState("");    // chosen weapon

  const [catalog, setCatalog] = useState(null);
  const [loadingCat, setLoadingCat] = useState(false);

  const [progression, setProgression] = useState(null);
  const [loadingProg, setLoadingProg] = useState(false);

  // Load catalog for current ruleset
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCat(true);
      try {
        const data = await getCreatorCatalog(ruleset);
        if (!cancelled) setCatalog(data || {});
      } finally {
        if (!cancelled) setLoadingCat(false);
      }
    }
    load();
    return () => (cancelled = true);
  }, [ruleset]);

  // Pick defaults when catalog lands
  useEffect(() => {
    if (!catalog) return;
    if (!classId) {
      const firstClass = (catalog.classes || [])[0];
      if (firstClass?.id) setClassId(firstClass.id);
    }
    if (!weaponId) {
      const firstWeapon = (catalog.weapons || [])[0];
      if (firstWeapon?.id) setWeaponId(firstWeapon.id);
    }
  }, [catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load progression preview for the selected class
  useEffect(() => {
    let cancelled = false;
    if (!classId) return;
    async function load() {
      setLoadingProg(true);
      try {
        const data = await getProgression({ ruleset, class_id: classId, max_level: 20 });
        if (!cancelled) setProgression(data || null);
      } finally {
        if (!cancelled) setLoadingProg(false);
      }
    }
    load();
    return () => (cancelled = true);
  }, [ruleset, classId]);

  const cls = useMemo(
    () => (catalog?.classes || []).find((c) => c.id === classId) || null,
    [catalog, classId]
  );
  const currentWeapon = useMemo(
    () => (catalog?.weapons || []).find((w) => w.id === weaponId) || null,
    [catalog, weaponId]
  );

  // --- KPIs (toy example; replace with your real derived stats) ---
  const kpi = useMemo(() => {
    return {
      ac: progression?.pf2e_full_ac?.[level] ?? progression?.ac?.[level] ?? "—",
      hp: progression?.hp?.[level] ?? "—",
      attackBonus: progression?.attack_bonus?.[level] ?? "—",
    };
  }, [progression, level]);

  return (
    <div className="page" style={{ padding: 16 }}>
      <h2>Creator</h2>

      {/* Top controls */}
      <div className="card">
        <div className="cols four" style={{ gap: 12 }}>
          <div>
            <label className="muted">Ruleset</label>
            <select value={ruleset} onChange={(e) => setRuleset(e.target.value)} style={{ width: "100%" }}>
              <option value="pf2e">PF2e</option>
              <option value="5e">D&D 5e</option>
            </select>
          </div>

          <div>
            <label className="muted">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={loadingCat || !catalog?.classes?.length}
              style={{ width: "100%" }}
            >
              {(catalog?.classes || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="muted">Level</label>
            <input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value || "1", 10))))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label className="muted">Weapon</label>
            <select
              value={weaponId}
              onChange={(e) => setWeaponId(e.target.value)}
              disabled={loadingCat || !catalog?.weapons?.length}
              style={{ width: "100%" }}
            >
              {(catalog?.weapons || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id} {w.die ? `(${w.die})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Preview</h3>
        <div className="cols three" style={{ gap: 12 }}>
          <div>
            <div className="muted">Class</div>
            <div style={{ fontWeight: 600 }}>{cls?.name || classId || "—"}</div>
          </div>
          <div>
            <div className="muted">AC (L{level})</div>
            <div style={{ fontWeight: 600 }}>{kpi.ac}</div>
          </div>
          <div>
            <div className="muted">HP (L{level})</div>
            <div style={{ fontWeight: 600 }}>{kpi.hp}</div>
          </div>
        </div>

        {/* Damage preview hooked to selected weapon */}
        <CreatorDamagePreview
          baseWeapon={{
            name: currentWeapon?.name || weaponId || "—",
            die: currentWeapon?.die || "1d8",
          }}
          striking={0}
          propertyRunes={[]}
          bonus={0}
        />
      </div>

      {/* TODO anchors:
          - Armor picker & potency/dex cap controls
          - Per-level rune add/remove with validation
          - Save/Load build JSON + CSV export buttons
      */}
    </div>
  );
}
