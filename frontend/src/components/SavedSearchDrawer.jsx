import React, { useEffect, useState } from "react";
import { listSavedSearches, saveSearch, deleteSearch } from "../utils/api";


// Fires a DOM CustomEvent so existing pages don’t need prop plumbing.
// Your DataBrowser can listen: window.addEventListener("tpka:apply-saved-search", e => { const {q,types}=e.detail; ... })
function applySaved({ q, types }) {
  // Keep URL shareable
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
  if (types) url.searchParams.set("types", types); else url.searchParams.delete("types");
  window.history.replaceState({}, "", url.toString());
  // Notify listeners
  window.dispatchEvent(new CustomEvent("tpka:apply-saved-search", { detail: { q: q || "", types: types || "" } }));
}

export default function SavedSearchDrawer({ open, onClose, ruleset }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [q, setQ] = useState(new URLSearchParams(location.search).get("q") || "");
  const [types, setTypes] = useState(new URLSearchParams(location.search).get("types") || "class,weapon,armor,feat,spell,monster");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    const data = await listSavedSearches(ruleset);
    setRows(data.searches || data.saved || []); // tolerate legacy shape
  }

  useEffect(() => { if (open) refresh().catch(()=>{}); }, [open, ruleset]);

  async function onSave() {
    if (!name.trim()) return;
    setBusy(true); setErr("");
    try {
      await saveSearch({ name: name.trim(), q, types, ruleset });
      await refresh();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(n) {
    setBusy(true); setErr("");
    try {
      await deleteSearch(n, ruleset);
      await refresh();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed inset-0 ${open ? "" : "pointer-events-none"} z-50`}>
      {/* backdrop */}
      <div className={`absolute inset-0 transition-opacity ${open ? "opacity-100 bg-black/40" : "opacity-0"}`} onClick={onClose} />
      {/* drawer */}
      <div className={`absolute right-0 top-0 h-full w-[420px] bg-white text-gray-900 shadow-2xl transition-transform p-4 overflow-y-auto ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Saved Searches</h2>
          <button className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-2 border-b pb-3 mb-3">
          <div className="text-sm text-gray-600">Create new</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Name (e.g., PF2e Shades)" value={name} onChange={e=>setName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder='q (e.g., "shade")' value={q} onChange={e=>setQ(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="types (comma list)" value={types} onChange={e=>setTypes(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={busy} className="px-3 py-1 rounded bg-black text-white hover:opacity-90" onClick={onSave}>Save</button>
            <button disabled={busy} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={()=>applySaved({ q, types })}>Apply</button>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-gray-600">Saved</div>
          {rows.length === 0 && <div className="text-sm text-gray-500">No saved searches yet.</div>}
          {rows.map((r) => (
            <div key={r.name} className="border rounded p-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-600">q=<code>{r.q || ""}</code></div>
                <div className="text-xs text-gray-600">types=<code>{r.types || ""}</code></div>
              </div>
              <div className="flex flex-col gap-1">
                <button className="px-2 py-1 rounded bg-blue-600 text-white hover:opacity-90" onClick={()=>applySaved({ q: r.q || "", types: r.types || "" })}>Apply</button>
                <button className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={()=>{ const url=new URL(location.href); url.searchParams.set("q", r.q||""); url.searchParams.set("types", r.types||""); navigator.clipboard.writeText(url.toString()).catch(()=>{}); }}>Copy Link</button>
                <button className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100" onClick={()=>onDelete(r.name)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: the URL reflects the current search (q &amp; types), so you can share it directly.
        </div>
      </div>
    </div>
  );
}
