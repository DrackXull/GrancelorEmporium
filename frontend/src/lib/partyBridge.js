// frontend/src/lib/partyBridge.js
const STORAGE_KEY = "tpka_sim_ui_v3";

/**
 * Read the app payload from localStorage
 */
export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Write payload back to localStorage and notify App.jsx
 * - Emits a CustomEvent so the main app (which listens) can sync state
 */
export function writeState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("tpka:party:update", { detail: next }));
}

/**
 * Set a specific party slot (0-based) to a given pcId.
 * - Preserves existing path_id, item_ids, abilities if present, unless overrides provided.
 */
export function setPartySlot(slotIndex, pcId, overrides = {}) {
  const st = readState() || {};
  const partySize = st.partySize || 4;
  const party = Array.isArray(st.party) ? [...st.party] : [];
  // ensure length
  while (party.length < partySize) {
    party.push({ pc_id: pcId, path_id: null, item_ids: [], abilities: { sneak_attack:false, action_surge:false, spell_burst:null } });
  }
  const prev = party[slotIndex] || { pc_id: pcId, path_id: null, item_ids: [], abilities: { sneak_attack:false, action_surge:false, spell_burst:null } };
  party[slotIndex] = {
    ...prev,
    pc_id: pcId,
    ...overrides
  };
  const next = { ...st, party };
  writeState(next);
}

/**
 * Convenience: set party size if you want (optional)
 */
export function setPartySize(n) {
  const st = readState() || {};
  const next = { ...st, partySize: n };
  writeState(next);
}
