// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react"
import axiosLib from "axios"
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts"
import CreatorPanel from "./components/CreatorPanel";
import MonteCarloPanel from "./components/MonteCarloPanel"


const API = import.meta.env.VITE_API_BASE || "http://localhost:8000"
const http = axiosLib.create({ baseURL: API, timeout: 10000 })
http.interceptors.response.use(
  r => r,
  e => {
    const msg = e?.response?.data?.detail?.[0]?.msg
      || e?.response?.data?.detail
      || e?.message
      || "Unknown error"
    e.__tpka_message = msg
    return Promise.reject(e)
  }
)

const STORAGE_KEY = "tpka_sim_ui_v3"

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

function Metric({title, value}){ return (<div style={styles.metric}><div style={{fontSize:12, color:"#9aa4b2"}}>{title}</div><div style={{fontSize:24, fontWeight:700}}>{value}</div></div>) }
function InfoCard({title, value}){ return (<div style={styles.info}><div style={{fontSize:12, color:"#9aa4b2"}}>{title}</div><div style={{fontSize:16, fontWeight:600}}>{value}</div></div>) }
function Stat({title, value}){ return (<div style={styles.info}><div style={{fontSize:12, color:"#9aa4b2"}}>{title}</div><div style={{fontSize:18, fontWeight:600}}>{value}</div></div>) }

function ErrorBanner({error, onClose}){
  if (!error) return null
  return (
    <div style={{position:"fixed", right:16, bottom:16, maxWidth:480, zIndex:100,
      background:"#7f1d1d", border:"1px solid #b91c1c", color:"#fff", padding:"10px 12px",
      borderRadius:10, boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
      <div style={{fontWeight:700, marginBottom:4}}>Error</div>
      <div style={{whiteSpace:"pre-wrap"}}>{String(error)}</div>
      <button onClick={onClose} style={{marginTop:8, background:"#991b1b", border:"1px solid #ef4444", color:"#fff", borderRadius:8, padding:"6px 10px"}}>
        Dismiss
      </button>
    </div>
  )
}

export default function App(){
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
    http.get("/api/data").then(r => {
      setData(r.data)
      const fallback = r.data.pc_baselines?.[0]?.id || ""
      try{
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw){
          const saved = JSON.parse(raw)
          // right after: const saved = JSON.parse(raw)
const addAbilities = (m)=> ({ 
  ...m, 
  abilities: { sneak_attack:false, action_surge:false, spell_burst:null, ...(m.abilities||{}) } 
})
const savedParty = (saved.party?.length ? saved.party : Array.from({length:4}, ()=>({pc_id: fallback, path_id:null, item_ids: []}))).map(addAbilities)
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
          setParty(Array.from({length:4}, ()=>({
  pc_id: fallback, path_id: null, item_ids: [],
  abilities: { sneak_attack:false, action_surge:false, spell_burst:null }
})))
        }
      }catch{ /* ignore */ }
      setLoading(false)
    }).catch(e => { setError(e.__tpka_message || e.message); setLoading(false) })
  }, [])

  // Persist
  useEffect(()=>{
    if (!data) return
    const t = setTimeout(()=>{
      const payload = { tab, sidebarWidth, partySize, party, customs, encId, trapIds, ignoreRooms, trials, initiative, strategy, presets, presetName }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    }, 100)
    return ()=>clearTimeout(t)
  }, [tab, sidebarWidth, partySize, party, customs, encId, trapIds, ignoreRooms, trials, initiative, strategy, presets, presetName, data])

  // Sync party count
  useEffect(()=>{
    if (!data) return
    const fallback = data.pc_baselines?.[0]?.id || ""
    if (party.length < partySize){
      const toAdd = partySize - party.length
     setParty(prev => [
  ...prev,
  ...Array.from({length: toAdd}, ()=>({
    pc_id: fallback, path_id: null, item_ids: [],
    abilities: { sneak_attack:false, action_surge:false, spell_burst:null }
  }))
])
    } else if (party.length > partySize){
      setParty(prev => prev.slice(0, partySize))
    }
  }, [partySize, data])

  // Options
  const pcOpts = useMemo(()=> data ? data.pc_baselines : [], [data])
  const encOpts = useMemo(()=> data ? data.encounters : [], [data])
  const trapOpts = useMemo(()=> data ? data.traps : [], [data])
  const pathOpts = useMemo(()=> data ? data.paths : [], [data])
  const itemOpts = useMemo(()=> data ? data.items : [], [data])
  const enc = useMemo(()=> encOpts.find(e => e.id === encId), [encOpts, encId])
  const firstUnit = enc?.waves?.[0]?.units?.[0]
  const enemyObj = useMemo(()=> data?.monsters?.find(m => m.id === firstUnit?.monster_id), [data, firstUnit])

  const isCustomId = (id) => id && String(id).startsWith("custom_")
  const getCustomById = (id) => customs.find(c => c.id === id)
  const upsertCustom = (updated) => setCustoms(prev => {
    const i = prev.findIndex(c => c.id === updated.id)
    if (i >= 0){ const cp = [...prev]; cp[i] = updated; return cp }
    return [...prev, updated]
  })

  const runSim = async () => {
    setRunning(true); setResult(null); setSeries(null); setLastAction("Running simulation…")
    try{
      const customsForThisRun = customs.filter(c => party.some(m => m.pc_id === c.id))
      const r = await http.post("/api/run", {
        encounter_id: encId, trap_ids: trapIds, trials: Number(trials),
        initiative, strategy, party, ignore_room_effects: ignoreRooms,
        party_custom: customsForThisRun
      })
      setResult(r.data); setLastAction("Simulation done")
    }catch(e){ setError(e.__tpka_message || e.message); setLastAction("Simulation error") }
    finally{ setRunning(false) }
  }

  const runSeries = async () => {
    setRunning(true); setSeries(null); setResult(null); setLastAction("Running series…")
    try{
      const customsForThisRun = customs.filter(c => party.some(m => m.pc_id === c.id))
      const payload = {
        party, party_custom: customsForThisRun,
        sequence: [
          { type: "encounter", encounter_id: encId, trials: Number(trials), trap_ids: trapIds, ignore_room_effects: ignoreRooms },
          { type: "short_rest" },
          { type: "encounter", encounter_id: encId, trials: Number(trials), trap_ids: trapIds, ignore_room_effects: ignoreRooms }
        ],
        initiative, strategy
      }
      const r = await http.post("/api/run_series", payload)
      setSeries(r.data); setLastAction("Series done")
    }catch(e){ setError(e.__tpka_message || e.message); setLastAction("Series error") }
    finally{ setRunning(false) }
  }

  if (loading) return <div style={{padding:20, color:"#e8e8e8"}}>Loading data…</div>

  const histData = result ? Object.entries(result.hist_rounds).map(([k,v])=>({round:k,count:v})) : []
//Tabs
  return (
    <div style={styles.app(sidebarWidth)}>
      <aside style={styles.sidebar}>
        <div style={{ display:"flex", gap: 8, marginBottom: 12 }}>
          <div style={styles.tab(tab==="encounter")} onClick={()=>setTab("encounter")}>Encounter</div>
          <div style={styles.tab(tab==="campaign")} onClick={()=>setTab("campaign")}>Campaign</div>
          <div style={styles.tab(tab==="dev")} onClick={()=>setTab("dev")}>Dev Tools</div>
          <div style={styles.tab(tab==="creator")} onClick={()=>setTab("creator")}>Creator</div>
        </div>

        <h2 style={{marginTop:0}}>Party</h2>
        <label style={styles.label}>Party Size</label>
        <input type="number" min="1" max="8" value={partySize} onChange={e=>setPartySize(Number(e.target.value))} style={styles.input}/>

        <div style={{display:"grid", gap:10, marginBottom:12}}>
          {Array.from({length:partySize}).map((_,i)=>(
            <div key={i} style={{border:"1px solid #1e2230", borderRadius:10, padding:10, background:"#0f1320"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                <div style={{fontWeight:700}}>Member {i+1}</div>
                <div style={{fontSize:12, color:"#9aa4b2"}}>{isCustomId(party[i]?.pc_id) ? "Custom" : "Baseline"}</div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
  <label style={{...styles.label, display:"flex", alignItems:"center", gap:8}}>
    <input
      type="checkbox"
      checked={!!(party[i]?.abilities?.sneak_attack)}
      onChange={(e)=>{
        const v = e.target.checked
        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, abilities:{...(m.abilities||{}), sneak_attack:v}} : m))
      }}
    />
    Sneak Attack (1/rd)
  </label>
  <label style={{...styles.label, display:"flex", alignItems:"center", gap:8}}>
    <input
      type="checkbox"
      checked={!!(party[i]?.abilities?.action_surge)}
      onChange={(e)=>{
        const v = e.target.checked
        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, abilities:{...(m.abilities||{}), action_surge:v}} : m))
      }}
    />
    Action Surge (once)
  </label>
</div>

<div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
  <label style={styles.label}>Spell Burst</label>
  <select
    value={party[i]?.abilities?.spell_burst || ""}
    onChange={(e)=>{
      const v = e.target.value || null
      setParty(prev => prev.map((m,idx)=> idx===i ? {...m, abilities:{...(m.abilities||{}), spell_burst:v}} : m))
    }}
    style={styles.select}
  >
    <option value="">None</option>
    <option value="L1">L1 (2d8 once)</option>
    <option value="L2">L2 (3d8 once)</option>
    <option value="L3">L3 (4d8 once)</option>
  </select>
</div>


              <label style={styles.label}>Baseline (or Custom ID)</label>
              <select value={party[i]?.pc_id || ""} onChange={e=>{
                const v=e.target.value
                setParty(prev => prev.map((m,idx)=> idx===i ? {...m, pc_id: v} : m))
              }} style={styles.select}>
                {pcOpts.map(p => <option key={p.id} value={p.id}>{p.archetype} L{p.level} — {p.id}</option>)}
                {customs.map(c => <option key={c.id} value={c.id}>⚙ {c.name} — {c.id}</option>)}
              </select>

              <label style={styles.label}>Display Name</label>
              <input
                style={styles.input}
                value={party[i]?.name || (isCustomId(party[i]?.pc_id) ? (getCustomById(party[i].pc_id)?.name || `Member ${i+1}`) : `Member ${i+1}`)}
                onChange={(e)=>{
                  const val = e.target.value
                  setParty(prev => prev.map((m,idx)=> idx===i ? {...m, name: val} : m))
                  const cid = party[i]?.pc_id
                  if (isCustomId(cid)){
                    const c = getCustomById(cid)
                    if (c){ upsertCustom({...c, name: val}) }
                  }
                }}
              />

              <label style={styles.label}>Path</label>
              <select value={party[i]?.path_id || ""} onChange={e=>{
                const v=e.target.value || null
                setParty(prev => prev.map((m,idx)=> idx===i ? {...m, path_id: v || null} : m))
              }} style={styles.select}>
                <option value="">None</option>
                {pathOpts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label style={styles.label}>Items (Ctrl/Cmd multi-select)</label>
              <select multiple value={party[i]?.item_ids || []} onChange={(e)=>{
                const options = Array.from(e.target.selectedOptions).map(o=>o.value)
                setParty(prev => prev.map((m,idx)=> idx===i ? {...m, item_ids: options} : m))
              }} style={{...styles.select, height:84}}>
                {itemOpts.map(it => <option key={it.id} value={it.id}>{it.name} (GS {it.gs})</option>)}
              </select>

              {/* Inline quick editors for customs */}
              {isCustomId(party[i]?.pc_id) && (
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                  <div>
                    <label style={styles.label}>Class</label>
                    <select
                      value={getCustomById(party[i].pc_id)?.archetype || "fighter"}
                      onChange={async (e)=>{
                        const clsId = e.target.value
                        const cur = getCustomById(party[i].pc_id); if (!cur) return
                        const weaponId = (cur.damage_profile?.[0]?.[1] === 10) ? "arcane_bolt" :
                                         (cur.damage_profile?.[0]?.[1] === 8 ? "longsword" : "dagger")
                        const armorId = cur.ac >= 16 ? "chain" : (cur.ac >= 11 ? "leather" : "cloth")
                        const r = await http.post("/api/build_pc", {
                          class_id: clsId, level: cur.level || 1,
                          armor_id: armorId, weapon_id: weaponId, name: cur.name
                        })
                        const nc = r.data
                        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, pc_id: nc.id, name: nc.name} : m))
                        upsertCustom(nc)
                      }}
                      style={styles.select}
                    >
                      {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Level</label>
                    <input
                      type="number" min="1" max="12"
                      value={getCustomById(party[i].pc_id)?.level || 1}
                      onChange={async (e)=>{
                        const lvl = Number(e.target.value)
                        const cur = getCustomById(party[i].pc_id); if (!cur) return
                        const clsId = cur.archetype
                        const weaponId = (cur.damage_profile?.[0]?.[1] === 10) ? "arcane_bolt" :
                                         (cur.damage_profile?.[0]?.[1] === 8 ? "longsword" : "dagger")
                        const armorId = cur.ac >= 16 ? "chain" : (cur.ac >= 11 ? "leather" : "cloth")
                        const r = await http.post("/api/build_pc", {
                          class_id: clsId, level: lvl, armor_id: armorId, weapon_id: weaponId, name: cur.name
                        })
                        const nc = r.data
                        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, pc_id: nc.id, name: nc.name} : m))
                        upsertCustom(nc)
                      }}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Armor</label>
                    <select
                      value={ (getCustomById(party[i].pc_id)?.ac ?? 10) >= 16 ? "chain" :
                              ((getCustomById(party[i].pc_id)?.ac ?? 10) >= 11 ? "leather" : "cloth") }
                      onChange={async (e)=>{
                        const armorId = e.target.value
                        const cur = getCustomById(party[i].pc_id); if (!cur) return
                        const clsId = cur.archetype
                        const weaponId = (cur.damage_profile?.[0]?.[1] === 10) ? "arcane_bolt" :
                                         (cur.damage_profile?.[0]?.[1] === 8 ? "longsword" : "dagger")
                        const r = await http.post("/api/build_pc", {
                          class_id: clsId, level: cur.level, armor_id: armorId, weapon_id: weaponId, name: cur.name
                        })
                        const nc = r.data
                        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, pc_id: nc.id, name: nc.name} : m))
                        upsertCustom(nc)
                      }}
                      style={styles.select}
                    >
                      {data.armors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Weapon</label>
                    <select
                      value={ (getCustomById(party[i].pc_id)?.damage_profile?.[0]?.[1] === 10) ? "arcane_bolt" :
                              ((getCustomById(party[i].pc_id)?.damage_profile?.[0]?.[1] === 8) ? "longsword" : "dagger") }
                      onChange={async (e)=>{
                        const weaponId = e.target.value
                        const cur = getCustomById(party[i].pc_id); if (!cur) return
                        const clsId = cur.archetype
                        const armorId = cur.ac >= 16 ? "chain" : (cur.ac >= 11 ? "leather" : "cloth")
                        const r = await http.post("/api/build_pc", {
                          class_id: clsId, level: cur.level, armor_id: armorId, weapon_id: weaponId, name: cur.name
                        })
                        const nc = r.data
                        setParty(prev => prev.map((m,idx)=> idx===i ? {...m, pc_id: nc.id, name: nc.name} : m))
                        upsertCustom(nc)
                      }}
                      style={styles.select}
                    >
                      {data.weapons.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <h2>Encounter</h2>
        <label style={styles.label}>Preset</label>
        <select value={encId} onChange={e=>setEncId(e.target.value)} style={styles.select}>
          {encOpts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <label style={styles.label}>Add traps</label>
        <div style={styles.checkboxWrap}>
          {trapOpts.map(t => (
            <div key={t.id} style={{display:"flex", gap:8, alignItems:"center", marginBottom:4}}>
              <input
                id={`trap-${t.id}`} type="checkbox"
                checked={trapIds.includes(t.id)}
                onChange={()=> setTrapIds(prev => prev.includes(t.id) ? prev.filter(x=>x!==t.id) : [...prev, t.id])}
              />
              <label htmlFor={`trap-${t.id}`}>{t.name}</label>
            </div>
          ))}
        </div>

        <label style={{...styles.label, display:"flex", alignItems:"center", gap:8}}>
          <input type="checkbox" checked={ignoreRooms} onChange={e=>setIgnoreRooms(e.target.checked)} />
          Ignore room effects
        </label>

        <h2>Simulation</h2>
        <label style={styles.label}>Trials</label>
        <input type="number" min="100" step="100" value={trials} onChange={e=>setTrials(e.target.value)} style={styles.input}/>
        <label style={styles.label}>Initiative</label>
        <select value={initiative} onChange={e=>setInitiative(e.target.value)} style={styles.select}>
          <option value="random">random</option><option value="players_first">players_first</option><option value="enemies_first">enemies_first</option>
        </select>
        <label style={styles.label}>Target strategy</label>
        <select value={strategy} onChange={e=>setStrategy(e.target.value)} style={styles.select}>
          <option value="focus_lowest">focus_lowest</option><option value="random">random</option><option value="focus_highest">focus_highest</option>
        </select>

        {tab === "encounter" ? (
          <button onClick={runSim} disabled={running} style={styles.button}>
            {running ? "Running…" : "Run Simulation ▶"}
          </button>
        ) : (
           <>
    {/* NEW: Creator tab */}
    <section>
      <h3 style={{marginTop:0}}>Character & Monster Creator</h3>
      <div style={{border:"1px solid #1e2230", borderRadius:10, overflow:"hidden", background:"#0f1320"}}>
        <CreatorPanel />
      </div>
    </section>
  </>
)}
          <button onClick={runSeries} disabled={running} style={styles.button}>
            {running ? "Running…" : "Run Sample Series ▶"}
          </button>
        

        <button
          onClick={async ()=>{
            setLastAction("Reloading data…")
            try{
              await http.post("/api/reload_data")
              const r = await http.get("/api/data")
              setData(r.data); setLastAction("Data reloaded")
            }catch(e){ setError(e.__tpka_message || e.message); setLastAction("Reload failed") }
          }}
          style={{...styles.button, marginTop:10, background:"#14b8a6", borderColor:"#2dd4bf"}}
        >
          Reload Data (no restart)
        </button>

        <button
          onClick={async ()=>{
            setLastAction("Testing API…")
            try{
              const r = await http.get("/api/ping")
              setLastAction(r.data?.ok ? "API OK" : "Ping unexpected")
            }catch(e){ setError(e.__tpka_message || e.message); setLastAction("API error") }
          }}
          style={{...styles.button, marginTop:10, background:"#0ea5e9", borderColor:"#38bdf8"}}
        >
          Test API
        </button>

        <h2>Presets</h2>
        <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8, marginBottom:8}}>
          <input placeholder="Preset name" style={styles.input} value={presetName} onChange={e=>setPresetName(e.target.value)} />
          <button
            onClick={()=>{
              if (!presetName){ setError("Enter a preset name."); return }
              const p = { name: presetName, party, customs, encId, trapIds, ignoreRooms, trials, initiative, strategy, partySize }
              setPresets(prev => {
                const idx = prev.findIndex(x => x.name === presetName)
                if (idx >= 0){ const cp = [...prev]; cp[idx] = p; return cp }
                return [...prev, p]
              })
              setLastAction(`Saved preset "${presetName}"`)
            }}
            style={{...styles.button}}
          >Save</button>
        </div>
        {presets.length === 0 ? (
          <p style={{color:"#9aa4b2", fontSize:12}}>No presets yet.</p>
        ) : (
          <div style={styles.checkboxWrap}>
            {presets.map((p, idx) => (
              <div key={idx} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6}}>
                <span>{p.name}</span>
                <div style={{display:"flex", gap:6}}>
                  <button
                    onClick={()=>{
                      setPresetName(p.name)
                      setParty(p.party); setCustoms(p.customs || [])
                      setEncId(p.encId); setTrapIds(p.trapIds || [])
                      setIgnoreRooms(!!p.ignoreRooms)
                      setTrials(p.trials); setInitiative(p.initiative); setStrategy(p.strategy)
                      setPartySize(p.partySize || p.party.length)
                      setLastAction(`Loaded preset "${p.name}"`)
                    }}
                    style={{background:"#1f2937", color:"#e5e7eb", border:"1px solid #374151", borderRadius:6, padding:"4px 8px"}}
                  >Load</button>
                  <button
                    onClick={()=>{ setPresets(prev => prev.filter(x => x.name !== p.name)); if (presetName === p.name) setPresetName("") }}
                    style={{background:"#7f1d1d", color:"#fff", border:"1px solid #b91c1c", borderRadius:6, padding:"4px 8px"}}
                  >Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{fontSize:12, color:"#9aa4b2", marginTop:8}}>Status: {lastAction || "Idle"}</div>
        <p style={{fontSize:12, color:"#9aa4b2", marginTop:4}}>API: {API}</p>
      </aside>

      <div role="separator" aria-orientation="vertical" onMouseDown={startDrag} title="Drag to resize" style={{cursor:"col-resize", background:"#1e2230", width:10, height:"100%", userSelect:"none"}} />

      <main style={styles.main}>
        <h1 style={styles.h1}>TPKA Encounter Simulator</h1>

        {tab === "encounter" ? (
          <>
            <section style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:16}}>
              <InfoCard title="Encounter" value={enc?.name || "—"} />
              <InfoCard title="Enemy" value={enemyObj?.name || "—"} />
              <InfoCard title="Enemy Count" value={firstUnit?.count ?? "—"} />
              <InfoCard title="Room Effects" value={ignoreRooms ? "Ignored" : (enc?.room_effects||[]).join(", ") || "None"} />
            </section>

            {enemyObj && (
              <section style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:12, marginBottom:24}}>
                <Stat title="AC" value={enemyObj.ac} />
                <Stat title="HP" value={enemyObj.hp} />
                <Stat title="To-Hit" value={`+${enemyObj.attack_bonus}`} />
                <Stat title="Attacks / Round" value={enemyObj.attacks_per_round} />
                <Stat title="Damage" value={enemyObj.damage_profile.map(d=>`${d[0]}d${d[1]}${d[2]?`+${d[2]}`:''}`).join(' + ')} />
              </section>
            )}

            {!result ? (
              <p style={{color:"#9aa4b2"}}>Build the party and hit Run Simulation.</p>
            ) : (
              <>
                <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12}}>
                  <Metric title="Win % (Players)" value={`${result.win_pct.toFixed(1)}%`} />
                  <Metric title="Win % (Enemies)" value={`${result.lose_pct.toFixed(1)}%`} />
                  <Metric title="Draw %" value={`${result.draw_pct.toFixed(1)}%`} />
                  <Metric title="Avg Rounds" value={result.avg_rounds.toFixed(2)} />
                </div>

                <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginTop:12}}>
                  <Metric title="Player Dmg / Combat" value={result.avg_player_dmg_total.toFixed(1)} />
                  <Metric title="Enemy Dmg / Combat" value={result.avg_enemy_dmg_total.toFixed(1)} />
                  <Metric title="Player Dmg / Round" value={result.avg_player_dmg_per_round.toFixed(2)} />
                  <Metric title="Enemy Dmg / Round" value={result.avg_enemy_dmg_per_round.toFixed(2)} />
                </div>

                <section style={{marginTop:16}}>
                  <h3>Party Contribution</h3>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12}}>
                    {Array.from({length:partySize}).map((_,i)=>(
                      <Stat key={i} title={`Member ${i+1} DPR`} value={(result.per_member_avg_dpr?.[i] ?? 0).toFixed(2)} />
                    ))}
                  </div>
                </section>

                <section style={{marginTop:24}}>
                  <h3>Rounds Histogram</h3>
                  <div style={{width:"100%", height:260, border:"1px solid #1e2230", borderRadius:10, background:"#0f1320"}}>
                    <ResponsiveContainer>
                      <LineChart data={histData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#253053" />
                        <XAxis dataKey="round" stroke="#9aa4b2" />
                        <YAxis stroke="#9aa4b2" />
                        <Tooltip contentStyle={{background:"#121622", border:"1px solid #1e2230", color:"#e8e8e8"}} />
                        <Line type="monotone" dataKey="count" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </>
            )}
          </>
        ) : (
          <>
           <>
          {/* NEW: Dev Tools (doesn’t affect your sim) */}
          <section>
            <h3 style={{marginTop:0}}>Developer Tools — Damage Monte Carlo</h3>
              <p style={{color:"#9aa4b2"}}>Validate damage math independent of encounters.</p>
              <div style={{border:"1px solid #1e2230", borderRadius:10, overflow:"hidden", background:"#0f1320"}}>
              <MonteCarloPanel />
            </div>
          </section>
          </>
            {!series ? (
              <p style={{color:"#9aa4b2"}}>Click “Run Sample Series” to simulate Encounter → Short Rest → Encounter.</p>
            ) : (
              <>
                <h3>Campaign Timeline</h3>
                <table style={{width:"100%", borderCollapse:"collapse", background:"#0f1320", border:"1px solid #1e2230", borderRadius:10, overflow:"hidden"}}>
                  <thead>
                    <tr style={{background:"#121622"}}>
                      <th style={{textAlign:"left", padding:8, borderBottom:"1px solid #1e2230"}}>#</th>
                      <th style={{textAlign:"left", padding:8, borderBottom:"1px solid #1e2230"}}>Step</th>
                      <th style={{textAlign:"right", padding:8, borderBottom:"1px solid #1e2230"}}>Win%</th>
                      <th style={{textAlign:"right", padding:8, borderBottom:"1px solid #1e2230"}}>Avg Rounds</th>
                      <th style={{textAlign:"right", padding:8, borderBottom:"1px solid #1e2230"}}>Party HP After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.timeline.map((s,i)=>(
                      <tr key={i}>
                        <td style={{padding:8, borderBottom:"1px solid #1e2230"}}>{s.index}</td>
                        <td style={{padding:8, borderBottom:"1px solid #1e2230"}}>{s.name}</td>
                        <td style={{padding:8, borderBottom:"1px solid #1e2230", textAlign:"right"}}>{s.win_pct ? s.win_pct.toFixed(1) : "-"}</td>
                        <td style={{padding:8, borderBottom:"1px solid #1e2230", textAlign:"right"}}>{s.avg_rounds ? s.avg_rounds.toFixed(2) : "-"}</td>
                        <td style={{padding:8, borderBottom:"1px solid #1e2230", textAlign:"right"}}>{(s.party_hp_after||[]).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </main>

      <ErrorBanner error={error} onClose={()=>setError("")} />
    </div>
  )
}
