// frontend/src/utils/mods.js
// Lightweight preview of how paths/items would modify a PC baseline.
// Mirrors backend logic in main.py apply_path_and_items.

export function applyPathAndItems(base, pathId, itemIds, allPaths, allItems) {
  const pc = { ...(base || {}) };
  let hp = toInt(pc.hp, 10);
  let ac = toInt(pc.ac, 10);
  let to_hit = toInt(pc.to_hit, 0);
  let dp = Array.isArray(pc.damage_profile) ? pc.damage_profile.map(tuple4) : [[1, 6, 0, "neutral"]];

  // items
  (itemIds || []).forEach((iid) => {
    const it = (allItems || []).find((x) => x.id === iid);
    if (!it) return;
    const mods = it.mods || {};
    if (isNum(mods.ac_bonus)) ac += toInt(mods.ac_bonus, 0);
    if (isNum(mods.to_hit_bonus)) to_hit += toInt(mods.to_hit_bonus, 0);
    if (isNum(mods.damage_bonus_flat)) {
      if (dp.length) {
        const last = tuple4(dp[dp.length - 1]);
        last[2] += toInt(mods.damage_bonus_flat, 0);
        dp[dp.length - 1] = last;
      } else {
        dp.push([0, 0, toInt(mods.damage_bonus_flat, 0), "neutral"]);
      }
    }
    const tb = it.temp_buff || {};
    if (isNum(tb.hp_temp)) hp += toInt(tb.hp_temp, 0);
  });

  // path
  if (pathId) {
    const p = (allPaths || []).find((x) => x.id === pathId);
    if (p) {
      const pm = p.mods || {};
      if (isNum(pm.ac_bonus)) ac += toInt(pm.ac_bonus, 0);
      if (isNum(pm.to_hit_bonus)) to_hit += toInt(pm.to_hit_bonus, 0);
      if (isNum(pm.damage_bonus_flat)) {
        if (dp.length) {
          const last = tuple4(dp[dp.length - 1]);
          last[2] += toInt(pm.damage_bonus_flat, 0);
          dp[dp.length - 1] = last;
        } else {
          dp.push([0, 0, toInt(pm.damage_bonus_flat, 0), "neutral"]);
        }
      }
    }
  }

  return { hp, ac, to_hit, damage_profile: dp };
}

function toInt(v, d = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

function isNum(v) {
  return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(+v));
}

function tuple4(t) {
  const n = toInt(t?.[0], 0);
  const d = toInt(t?.[1], 0);
  const b = toInt(t?.[2], 0);
  const type = (t?.[3] ?? "neutral");
  return [n, d, b, type];
}
