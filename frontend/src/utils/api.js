import axios from "axios";

/** Canonical axios client */
const client = axios.create({
  baseURL: "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err?.response?.data;
    const msg =
      (typeof data === "string" && data) ||
      data?.detail ||
      data?.message ||
      err.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);

/** Low-level helpers (only if you don’t have a dedicated helper yet) */
async function rawGet(path, opts = {}) {
  const { data } = await client.get(path, opts);
  return data;
}
async function rawPost(path, body, opts = {}) {
  const { data } = await client.post(path, body, opts);
  return data;
}

/** Expose axios-like get/post so legacy code keeps working */
async function get(path, opts) {
  return client.get(path, opts); // returns { data, ... }
}
async function post(path, body, opts) {
  return client.post(path, body, opts); // returns { data, ... }
}

/* ------------ Health / Meta ------------ */
export async function ping() {
  const { data } = await client.get("/ping", { headers: { "Cache-Control": "no-store" } });
  return data;
}

export async function getData(ruleset) {
  const { data } = await client.get("/data", { params: ruleset ? { ruleset } : {} });
  return data;
}

/* ------------ Catalog / Progression ------------ */
export async function getCreatorCatalog(ruleset) {
  const { data } = await client.get("/creator/catalog", { params: { ruleset } });
  return data;
}

export async function getProgression({ ruleset, class_id, max_level = 20 }) {
  const { data } = await client.get("/progression", {
    params: { ruleset, class_id, max_level },
  });
  return data;
}

/* ------------ Search & Runes ------------ */
export async function search2(params) {
  const { data } = await client.get("/search2", { params });
  return data;
}

export async function runeSuggest({ q, limit = 8 }) {
  const { data } = await client.get("/runes/suggest", { params: { q, limit } });
  return data;
}

/* ------------ Saved Searches ------------ */
export async function listSavedSearches(ruleset) {
  const { data } = await client.get("/searches", { params: ruleset ? { ruleset } : {} });
  return data;
}
export async function saveSearch({ name, q, types, ruleset }) {
  const { data } = await client.post("/searches", { name, q, types, ruleset });
  return data;
}
export async function deleteSearch(name, ruleset) {
  const { data } = await client.delete("/searches", { params: { name, ruleset } });
  return data;
}

/* ------------ Scoring ------------ */
export async function scoreSpell(payload) {
  const { data } = await client.post("/score/spell", payload);
  return data;
}
export async function spellComparables(payload) {
  const { data } = await client.post("/score/spell/comparables", payload);
  return data;
}
export async function scoreMonster(payload) {
  const { data } = await client.post("/score/monster", payload);
  return data;
}

/* ------------ Sim ------------ */
export async function runSim(payload) {
  const { data } = await client.post("/sim/run", payload);
  return data;
}

/* ------------ Exports ------------ */
export function exportBuildJSON(params) {
  return client.get("/export/build.json", { params, responseType: "json" });
}
export function exportBuildCSV(params) {
  return client.get("/export/build.csv", { params, responseType: "blob" });
}

/* ------------ Runtime Overrides (PF2e Skills, etc.) ------------ */
export async function getOverrides() {
  const { data } = await client.get("/runtime/overrides");
  return data;
}
export async function writeOverrides(payload) {
  const { data } = await client.post("/runtime/overrides", payload);
  return data;
}

/* ------------ Creator / seeding ------------ */
export async function seedDefaults({ ruleset, force=false }) {
  const { data } = await client.post("/creator/seed_defaults", { ruleset, force });
  return data;
}

/* ------------ DPR helpers (used by previews) ------------ */
export async function dprPreviewPlus(body) {
  const { data } = await client.post("/dpr/preview_plus", body);
  return data;
}
export async function dprPreviewFromBuild(body) {
  const { data } = await client.post("/dpr/preview_from_build", body);
  return data;
}

const api = {
  // axios-like
  get, post,
  // low-level “raw”
  rawGet, rawPost,
  // helpers
  ping,
  getData,
  getCreatorCatalog,
  getProgression,
  search2,
  runeSuggest,
  listSavedSearches,
  saveSearch,
  deleteSearch,
  scoreSpell,
  spellComparables,
  scoreMonster,
  runSim,
  exportBuildJSON,
  exportBuildCSV,
  getOverrides,
  writeOverrides,
  seedDefaults,
  dprPreviewPlus,
  dprPreviewFromBuild,
};
export default api;
