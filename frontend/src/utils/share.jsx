// frontend/src/utils/share.js
export function encodeStateToUrl(state) {
  try {
    const json = JSON.stringify(state);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const safe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return `${location.origin}${location.pathname}?s=${safe}`;
  } catch {
    return location.href;
  }
}

export function decodeStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const s = params.get("s");
  if (!s) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "tpka_config.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
