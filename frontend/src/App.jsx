import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import CreatorPanel from "./components/CreatorPanel";
import MonteCarloPanel from "./components/MonteCarloPanel";
import http from "./utils/api";

const STORAGE_KEY = "tpka_sim_ui_v3";

const styles = {
  app: (w) => ({ display: "grid", gridTemplateColumns: `${w}px 10px 1fr`, height: "100vh", color: "#e8e8e8", background: "#0f1115", fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif" }),
  sidebar: { borderRight: "1px solid #1e2230", padding: 16, overflow: "auto", background: "#0b0d12" },
  label: { fontSize: 12, color: "#9aa4b2", marginBottom: 4, display: "block" },
  select: { width: "100%", marginBottom: 10, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42", borderRadius: 8, padding: "8px 10px" },
  input: { width: "100%", marginBottom: 10, background: "#121622", color: "#e8e8e8", border: "1px solid #2a2f42", borderRadius: 8, padding: "8px 10px" },
  checkboxWrap: { border: "1px solid #2a2f42", background: "#121622", padding: 8, borderRadius: 8, maxHeight: 150, overflow: "auto", marginBottom: 10 },
  button: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #3b82f6", background: "#1d4ed8", color: "#fff", fontWeight: 700, cursor: "pointer" },
  main: { padding: 16, overflow: "auto" },
  h1: { marginTop: 0, fontSize: 22 },
  metric: { border: "1px solid #1e2230", borderRadius: 12, padding: "12px 14px", background: "#121622" },
  info: { border: "1px solid #1e2230", borderRadius: 12, padding: "10px 12px", background: "#121622" },
  tabs: { display: "flex", gap: 8, marginBottom: 12 },
  tab: (active) => ({ padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2f42", background: active ? "#1a2033" : "#0f1320", cursor: "pointer" })
}

function Metric({ title, value }) { return (<div style={styles.metric}><div style={{ fontSize: 12, color: "#9aa4b2" }}>{title}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div></div>) }
function InfoCard({ title, value }) { return (<div style={styles.info}><div style={{ fontSize: 12, color: "#9aa4b2" }}>{title}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div></div>) }
function Stat({ title, value }) { return (<div style={styles.info}><div style={{ fontSize: 12, color: "#9aa4b2" }}>{title}</div><div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div></div>) }

function ErrorBanner({ error, onClose }) {
  if (!error) return null
  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, maxWidth: 480, zIndex: 100, background: "#7f1d1d", border: "1px solid #b91c1c", color: "#fff", padding: "10px 12px", borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Error</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{String(error)}</div>
      <button onClick={onClose} style={{ marginTop: 8, background: "#991b1b", border: "1px solid #ef4444", color: "#fff", borderRadius: 8, padding: "6px 10px" }}>
        Dismiss
      </button>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastAction, setLastAction] = useState("")
  const [tab, setTab] = useState("encounter")
  const [sidebarWidth, setSidebarWidth] = useState(520)
  const startDrag = (e) => {
    const startX = e.clientX; const startW = sidebarWidth
    const onMove = (ev) => setSidebarWidth(Math.max(360, Math.min(900, startW + (ev.clientX - startX))))
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
  }

  const [partySize, setPartySize] = useState(4)
  const [party, setParty] = useState([])
  const [customs, setCustoms] = useState([])

  const [encId, setEncId] = useState("mirror_room_act1")
  const [trapIds, setTrapIds] = useState([])
  const [ignoreRooms, setIgnoreRooms] = useState(false)

  const [trials, setTrials] = useState(2000)
  const [initiative, setInitiative] = useState("random")
  const [strategy, setStrategy] = useState("focus_lowest")

  const [result, setResult] = useState(null)
  const [series, setSeries] = useState(null)
  const [running, setRunning] = useState(false)

  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState([])

  // Load data + hydrate
  useEffect(() => {
    http.get("/api/data").then(data => {
      setData(data)
      const fallback = data.pc_baselines?.[0]?.id || ""
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          const addAbilities = (m) => ({ ...m, abilities: { sneak_attack: false, action_surge: false, spell_burst: null, ...(m.abilities || {}) } })
          const savedParty = (saved.party?.length ? saved.party : Array.from({ length: 4 }, () => ({ pc_id: fallback, path_id: null, item_ids: [] }))).map(addAbilities)
          setParty(savedParty)

          setTab(saved.tab ?? "encounter")
          setSidebarWidth(saved.sidebarWidth ?? 520)
          setPartySize(saved.partySize ?? 4)
          setCustoms(saved.customs || [])
          setEncId(saved.encId ?? "mirror_room_act1")
          setTrapIds(saved.trapIds || [])
          setIgnoreRooms(!!saved.ignoreRooms)
          setTrials(saved.trials ?? 2000)
          setInitiative(saved.initiative ?? "random")
          setStrategy(saved.strategy ?? "focus_lowest")
          setPresets(saved.presets || [])
          setPresetName(saved.presetName || "")
        } else {
          setParty(Array.from({ length: 4 }, () => ({ pc_id: fallback, path_id: null, item_ids: [], abilities: { sneak_attack: false, action_surge: false, spell_burst: null } })))
        }
      } catch { /* ignore */ }
      setLoading(false)
    }).catch(e => { setError(e.__tpka_message || e.message); setLoading(false) })
  }, [])

  // Persist
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => {
      const payload = { tab, sidebarWidth, partySize, party, customs, encId, trapIds, ignoreRooms, trials, initiative, strategy, presets, presetName }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    }, 100)
    return () => clearTimeout(t)
  }, [tab, sidebarWidth, partySize, party, customs, encId, trapIds, ignoreRooms, trials, initiative, strategy, presets, presetName, data])

  // Sync party count
  useEffect(() => {
    if (!data) return
    const fallback = data.pc_baselines?.[0]?.id || ""
    if (party.length < partySize) {
      const toAdd = partySize - party.length
      setParty(prev => [...prev, ...Array.from({ length: toAdd }, () => ({ pc_id: fallback, path_id: null, item_ids: [], abilities: { sneak_attack: false, action_surge: false, spell_burst: null } }))])
    } else if (party.length > partySize) {
      setParty(prev => prev.slice(0, partySize))
    }
  }, [partySize, data])

  const pcOpts = useMemo(() => data ? data.pc_baselines : [], [data])
  const encOpts = useMemo(() => data ? data.encounters : [], [data])
  const trapOpts = useMemo(() => data ? data.traps : [], [data])
  const pathOpts = useMemo(() => data ? data.paths : [], [data])
  const itemOpts = useMemo(() => data ? data.items : [], [data])
  const enc = useMemo(() => encOpts.find(e => e.id === encId), [encOpts, encId])
  const firstUnit = enc?.waves?.[0]?.units?.[0]
  const enemyObj = useMemo(() => data?.monsters?.find(m => m.id === firstUnit?.monster_id), [data, firstUnit])

  const isCustomId = (id) => id && String(id).startsWith("custom_")
  const getCustomById = (id) => customs.find(c => c.id === id)
  const upsertCustom = (updated) => setCustoms(prev => {
    const i = prev.findIndex(c => c.id === updated.id)
    if (i >= 0) { const cp = [...prev]; cp[i] = updated; return cp }
    return [...prev, updated]
  })

  const runSim = async () => {
    setRunning(true); setResult(null); setSeries(null); setLastAction("Running simulation…")
    try {
      const customsForThisRun = customs.filter(c => party.some(m => m.pc_id === c.id))
      const r = await http.post("/api/run", { encounter_id: encId, trap_ids: trapIds, trials: Number(trials), initiative, strategy, party, ignore_room_effects: ignoreRooms, party_custom: customsForThisRun })
      setResult(r); setLastAction("Simulation done")
    } catch (e) { setError(e.__tpka_message || e.message); setLastAction("Simulation error") }
    finally { setRunning(false) }
  }

  const runSeries = async () => {
    setRunning(true); setSeries(null); setResult(null); setLastAction("Running series…")
    try {
      const customsForThisRun = customs.filter(c => party.some(m => m.pc_id === c.id))
      const payload = { party, party_custom: customsForThisRun, sequence: [{ type: "encounter", encounter_id: encId, trials: Number(trials), trap_ids: trapIds, ignore_room_effects: ignoreRooms }, { type: "short_rest" }, { type: "encounter", encounter_id: encId, trials: Number(trials), trap_ids: trapIds, ignore_room_effects: ignoreRooms }], initiative, strategy }
      const r = await http.post("/api/run_series", payload)
      setSeries(r); setLastAction("Series done")
    } catch (e) { setError(e.__tpka_message || e.message); setLastAction("Series error") }
    finally { setRunning(false) }
  }

  if (loading) return <div style={{ padding: 20, color: "#e8e8e8" }}>Loading data…</div>

  const histData = result ? Object.entries(result.hist_rounds).map(([k, v]) => ({ round: k, count: v })) : []

  return (
    <div style={styles.app(sidebarWidth)}>
      <aside style={styles.sidebar}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={styles.tab(tab === "encounter")} onClick={() => setTab("encounter")}>Encounter</div>
          <div style={styles.tab(tab === "campaign")} onClick={() => setTab("campaign")}>Campaign</div>
          <div style={styles.tab(tab === "dev")} onClick={() => setTab("dev")}>Dev Tools</div>
          <div style={styles.tab(tab === "creator")} onClick={() => setTab("creator")}>Creator</div>
        </div>
        <MonteCarloPanel />
      </aside>

      <div role="separator" aria-orientation="vertical" onMouseDown={startDrag} title="Drag to resize" style={{ cursor: "col-resize", background: "#1e2230", width: 10, height: "100%", userSelect: "none" }} />

      <main style={styles.main}>
        <h1 style={styles.h1}>TPKA Encounter Simulator</h1>

        {tab === "encounter" && (
          <>
            {/* Encounter content */}
          </>
        )}

        {/* Other tabs */}

      </main>

      <ErrorBanner error={error} onClose={() => setError("")} />
    </div>
  )
}
