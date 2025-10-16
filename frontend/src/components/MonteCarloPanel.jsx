import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000");
const API = API_BASE.replace(/\/$/, "") + "/api";

export default function MonteCarloPanel() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({
    runs: 100000,
    baseRoll: "1d8+3",
    damageType: "fire",
    resistMultiplier: 1.0,
    critChance: 0.05,
    critMult: 1.5,
    enableVariance: false,
    varianceRange: 0.03,
    seed: 42,
    // Histogram extras
    histProfileText: "[[1,8,3]]",
    histBinSize: 1
  });
  const [standard, setStandard] = useState(null);
  const [single, setSingle] = useState(null);
  const [hist, setHist] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/damage/types`)
      .then(r => r.json())
      .then(d => setTypes(d.damageTypes || []))
      .catch(() => setTypes([]));
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked :
        (name === "runs" || name === "seed" || name === "histBinSize")
          ? parseInt(value || 0, 10)
          : (name === "resistMultiplier" || name === "critChance" || name === "critMult" || name === "varianceRange")
            ? parseFloat(value || 0)
            : value
    }));
  };

  const runStandard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/damage/montecarlo/standard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs: form.runs,
          baseRoll: form.baseRoll,
          damageType: form.damageType,
          critChance: form.critChance,
          critMult: form.critMult,
          enableVariance: form.enableVariance,
          varianceRange: form.varianceRange,
          seed: form.seed
        })
      });
      setStandard(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const runSingle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/damage/montecarlo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs: form.runs,
          baseRoll: form.baseRoll,
          damageType: form.damageType,
          resistMultiplier: form.resistMultiplier,
          critChance: form.critChance,
          critMult: form.critMult,
          enableVariance: form.enableVariance,
          varianceRange: form.varianceRange,
          seed: form.seed
        })
      });
      setSingle(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const runHistogram = async () => {
    setLoading(true);
    try {
      let profile;
      try {
        profile = JSON.parse(form.histProfileText);
      } catch {
        alert("Histogram profile must be valid JSON like [[1,8,3]]");
        return;
      }
      const res = await fetch(`${API}/damage/montecarlo/hist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs: form.runs,
          profile,
          damageType: form.damageType,
          resistMultiplier: form.resistMultiplier,
          critChance: form.critChance,
          critMult: form.critMult,
          enableVariance: form.enableVariance,
          varianceRange: form.varianceRange,
          seed: form.seed,
          binSize: form.histBinSize
        })
      });
      setHist(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const histData = useMemo(() => {
    if (!hist?.histogram) return [];
    return Object.entries(hist.histogram).map(([bucket, count]) => ({ bucket, count }));
  }, [hist]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Monte Carlo Damage Tools</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Base Roll (for Single/Standard)</span>
          <input name="baseRoll" value={form.baseRoll} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Damage Type</span>
          <select name="damageType" value={form.damageType} onChange={onChange} className="border p-2 rounded bg-transparent">
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Runs</span>
          <input name="runs" type="number" min={1000} step={1000} value={form.runs} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Resist Multiplier</span>
          <input name="resistMultiplier" type="number" step="0.1" value={form.resistMultiplier} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Crit Chance</span>
          <input name="critChance" type="number" step="0.01" value={form.critChance} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Crit Multiplier</span>
          <input name="critMult" type="number" step="0.1" value={form.critMult} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex gap-2 items-center">
          <input name="enableVariance" type="checkbox" checked={form.enableVariance} onChange={onChange} />
          <span className="text-sm text-gray-300">Enable Variance (±{Math.round(form.varianceRange*100)}%)</span>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Variance Range</span>
          <input name="varianceRange" type="number" step="0.01" value={form.varianceRange} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-400">Seed (optional)</span>
          <input name="seed" type="number" value={form.seed} onChange={onChange} className="border p-2 rounded bg-transparent" />
        </label>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={runSingle} className="px-4 py-2 rounded bg-black text-white border border-gray-600 disabled:opacity-50" disabled={loading}>
          Run Single Scenario
        </button>
        <button onClick={runStandard} className="px-4 py-2 rounded bg-gray-800 text-white border border-gray-600 disabled:opacity-50" disabled={loading}>
          Run Standard Set
        </button>
      </div>

      {single && (
        <div className="mb-6 border rounded p-3">
          <h3 className="font-semibold mb-2">Single Scenario</h3>
          <pre className="text-sm bg-black/30 p-2 rounded overflow-auto">{JSON.stringify(single, null, 2)}</pre>
        </div>
      )}

      {standard && (
        <div className="mb-6 border rounded p-3">
          <h3 className="font-semibold mb-2">Standard Scenarios</h3>
          <pre className="text-sm bg-black/30 p-2 rounded overflow-auto">{JSON.stringify(standard, null, 2)}</pre>
        </div>
      )}

      <div className="border rounded p-3">
        <h3 className="font-semibold mb-2">Histogram (legacy profile)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-400">Profile JSON [(n,d,b)]</span>
            <textarea name="histProfileText" value={form.histProfileText} onChange={onChange} rows={3} className="border p-2 rounded bg-transparent font-mono text-xs" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className="text-sm text-gray-400">Bin Size</span>
              <input name="histBinSize" type="number" min={1} step={1} value={form.histBinSize} onChange={onChange} className="border p-2 rounded bg-transparent" />
            </label>
            <div className="flex items-end">
              <button onClick={runHistogram} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={loading}>
                Build Histogram
              </button>
            </div>
          </div>
        </div>

        {hist && (
          <>
            <div className="text-xs text-gray-400 mb-2">min {hist.min} · max {hist.max} · binsize {hist.binSize}</div>
            <div style={{ width: "100%", height: 260, border: "1px solid #1e2230", borderRadius: 10 }}>
              <ResponsiveContainer>
                <BarChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
