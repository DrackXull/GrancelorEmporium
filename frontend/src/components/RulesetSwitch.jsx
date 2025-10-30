import React from "react";
import { api } from "../utils/api";

export default function RulesetSwitch({ ruleset, setRuleset, onReload }) {
  async function change(val) {
    setRuleset(val);
    try {
      await api.post("/api/ruleset", { ruleset: val });
    } catch {}
    onReload?.(val);
  }
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
      <span style={{ fontSize:12, opacity:0.7 }}>Ruleset</span>
      <select value={ruleset} onChange={(e)=>change(e.target.value)}>
        <option value="5e">D&D 5e (SRD, CC-BY-4.0)</option>
        <option value="pf2e">Pathfinder 2e (ORC)</option>
      </select>
    </div>
  );
}
