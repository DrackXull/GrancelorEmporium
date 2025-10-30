import React, { useEffect, useMemo, useState } from "react";
import api, { search2 as apiSearch2, runeSuggest as apiRuneSuggest } from "../utils/api";
import Chip from "./Chip.jsx";

const FACETS = {
  rune_slot: [
    { id: "weapon", label: "Weapon slot" },
    { id: "armor",  label: "Armor slot" },
    { id: "shield", label: "Shield slot" },
  ],
  striking_ge: [
    { id: 1, label: "Striking ≥1" },
    { id: 2, label: "Striking ≥2" },
    { id: 3, label: "Striking ≥3" },
  ],
};

export default function DataBrowser() {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState(["class","weapon","armor","feat","spell"]);
  const [runeSlot, setRuneSlot] = useState(null);
  const [strikingGe, setStrikingGe] = useState(null);
  const [logic, setLogic] = useState("AND");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runeSuggest, setRuneSuggest] = useState([]);
  const [runeQuery, setRuneQuery] = useState("");

  const typesParam = useMemo(() => types.join(","), [types]);

  function toggleType(t) {
    setTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  }

  function runSearch() {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (types.length) p.set("types", typesParam);
    if (runeSlot) p.set("rune_slot", runeSlot);
    if (strikingGe) p.set("striking_ge", String(strikingGe));
    if (logic) p.set("logic", logic);
    apiSearch2(Object.fromEntries(p))
  .then((data) => setResults(data))
  .finally(() => setLoading(false));
  }

  useEffect(()=>{ runSearch(); /* initial load */ }, []); // eslint-disable-line

  useEffect(() => {
    if (!runeQuery) { setRuneSuggest([]); return; }
    const q = new URLSearchParams({ q: runeQuery, limit: "8" });
    apiRuneSuggest({ q: runeQuery, limit: 8 })
  .then(d => setRuneSuggest(d.items || []))
  .catch(() => setRuneSuggest([]));
  }, [runeQuery]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Data Browser</h2>
        <div className="panel-actions">
          <button className="btn" onClick={runSearch} disabled={loading}>{loading ? "Searching…" : "Search"}</button>
        </div>
      </div>

      <div className="card">
        <div className="row gap">
          <input
            className="grow"
            placeholder="Search (e.g., longsword, flaming, rapid shot)…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if (e.key === "Enter") runSearch(); }}
          />
          <select value={logic} onChange={e=>setLogic(e.target.value)}>
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>

        <div className="facet-row">
          <div className="facet-label">Types:</div>
          {["class","weapon","armor","feat","spell"].map(t => {
  const qCount = results?.facets?.q_counts?.[t + (t.endsWith("s") ? "" : "s")];
  const total  = results?.counts?.[t + (t.endsWith("s") ? "" : "s")];
  return (
    <Chip
      key={t}
      label={`${t}${badge(qCount ?? total)}`}
      active={types.includes(t)}
      onClick={() => toggleType(t)}
    />
  );
})}

        </div>

        <div className="facet-row">
          <div className="facet-label">Rune slot:</div>
          {FACETS.rune_slot.map(f => (
            <Chip key={f.id} label={`${f.label}${badge(results?.counts?.classes)}`} active={runeSlot===f.id} onClick={()=>setRuneSlot(runeSlot===f.id?null:f.id)} />
          ))}
        </div>

        <div className="facet-row">
          <div className="facet-label">Striking:</div>
          {FACETS.striking_ge.map(f => (
            <Chip key={f.id} label={f.label} active={strikingGe===f.id} onClick={()=>setStrikingGe(strikingGe===f.id?null:f.id)} />
          ))}
        </div>

        <div className="facet-row">
          <div className="facet-label">Rune:</div>
          <div className="rune-ac">
            <input
              placeholder="Type to search runes (e.g., Flaming)…"
              value={runeQuery}
              onChange={(e)=>setRuneQuery(e.target.value)}
            />
            {runeSuggest?.length ? (
              <div className="suggest">
                {runeSuggest.map(r => (
                  <div key={r.id} className="suggest-row" onClick={()=>{ setQ(r.name); setRuneQuery(""); }}>
                    <div className="s-name">{r.name}</div>
                    <div className="s-tags">{(r.tags||[]).slice(0,3).map(t => <span key={t} className="tag tiny">{t}</span>)}</div>
                    <div className="s-slot">{r.slot}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid two">
        <ResultCard title="Classes" items={results?.results?.classes?.items} count={results?.counts?.classes} kind="class" />
        <ResultCard title="Weapons" items={results?.results?.weapons?.items} count={results?.counts?.weapons} kind="weapon" />
        <ResultCard title="Armors"  items={results?.results?.armors?.items}  count={results?.counts?.armors}  kind="armor" />
        <ResultCard title="Feats"   items={results?.results?.feats?.items}   count={results?.counts?.feats}   kind="feat" />
        <ResultCard title="Spells"  items={results?.results?.spells?.items}  count={results?.counts?.spells}  kind="spell" />
      </div>
    </section>
  );
}

function ResultCard({ title, items, count, kind }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="badge">{count ?? 0}</span>
      </div>
      {!items?.length ? <div className="muted">No results</div> : (
        <ul className="list rich">
          {items.map(i => (
            <li key={i.id}>
              <div className="list-title">{i.name}</div>
              <div className="list-sub muted">{i.id}</div>
              <div className="list-actions">
                {kind === "class" ? <a className="btn ghost xs" href={`#progression-${encodeURIComponent(i.id)}`}>Open</a> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function badge(n) {
  if (n == null) return "";
  return ` ${n}`;
}
