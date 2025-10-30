// frontend/src/utils/dice.js
export function parseDamageString(s) {
  if (!s || typeof s !== "string") return [];
  return s.split(",").map(seg => seg.trim()).filter(Boolean).map(seg => {
    const parts = seg.split(/\s+/);
    const core = parts[0] || "";
    const type = (parts[1] || "neutral").toLowerCase();
    const m = core.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!m) {
      const flat = parseInt(core, 10);
      if (!isFinite(flat)) return [0, 0, 0, type];
      return [0, 0, flat, type];
    }
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const d = parseInt(m[2], 10);
    const b = m[3] ? parseInt(m[3], 10) : 0;
    return [n, d, b, type];
  });
}

export function stringifyDamageProfile(profile) {
  if (!Array.isArray(profile)) return "";
  return profile.map(t => {
    const [n, d, b, type] = [
      Number(t?.[0] ?? 0),
      Number(t?.[1] ?? 0),
      Number(t?.[2] ?? 0),
      (t?.[3] ?? "neutral")
    ];
    let core = "";
    if (n > 0 && d > 0) core = `${n}d${d}${b ? (b > 0 ? `+${b}` : `${b}`) : ""}`;
    else core = `${b || 0}`;
    if (type && type !== "neutral") return `${core} ${type}`;
    return core;
  }).join(", ");
}
