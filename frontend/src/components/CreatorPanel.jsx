// frontend/src/components/CreatorPanel.jsx
import { useEffect, useState } from "react";
import { setPartySlot, readState } from "../lib/partyBridge";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000");
const API = API_BASE.replace(/\/$/, "") + "/api";

const styles = {
  box: "border rounded p-3",
  input: "border rounded p-2 bg-transparent",
  select: "border rounded p-2 bg-transparent",
  btn: "px-3 py-1.5 rounded border",
  grid2: "grid grid-cols-1 md:grid-cols-2 gap-3",
  grid3: "grid grid-cols-1 md:grid-cols-3 gap-3",
  tag: "text-xs px-2 py-0.5 border rounded",
};

export default function CreatorPanel(){
  const [catalog, setCatalog] = useState({classes:[],weapons:[],armors:[],paths:[],items:[],monsters_baseline:[]});
  const [pcs, setPcs] = useState([]);
  const [mons, setMons] = useState([]);
  const [tab, setTab] = useState("pc");

  // PC form
  const [pc, setPc] = useState({
    id: null,
    name: "New Hero",
    archetype: "fighter",
    level: 1,
    hp: 10,
    ac: 10,
    weapon_id: "longsword",
    armor_id: "leather",
    damage_profile: [[1,8,3]],
    abilities: { sneak_attack:false, action_surge:false, spell_burst:null },
    resists: {}
  });

  // Monster form
  const [mon, setMon] = useState({
    id: null,
    name: "New Monster",
    hp: 12,
    ac: 12,
    attack_bonus: 3,
    attacks_per_round: 1,
    weapon_id: "dagger",
    damage_profile: [[1,6,0]],
    resists: {}
  });

  // load catalog + saved
  useEffect(()=>{
    Promise.all([
      fetch(`${API}/creator/catalog`).then(r=>r.json()),
      fetch(`${API}/creator/pcs`).then(r=>r.json()),
      fetch(`${API}/creator/monsters`).then(r=>r.json()),
    ]).then(([cat, pcs, mons])=>{
      setCatalog(cat||{});
      setPcs(pcs||[]);
      setMons(mons||[]);
    }).catch(()=>{});
  },[]);

  // ---------- PC CRUD ----------
  const savePc = async ()=>{
    const method = pc.id ? "PUT":"POST";
    const url = pc.id ? `${API}/creator/pcs/${pc.id}` : `${API}/creator/pcs`;
    const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(pc)});
    const data = await res.json();
    const list = await fetch(`${API}/creator/pcs`).then(r=>r.json());
    setPcs(list);
    setPc(data);
  };
  const deletePc = async ()=>{
    if (!pc.id) return;
    await fetch(`${API}/creator/pcs/${pc.id}`,{method:"DELETE"});
    const list = await fetch(`${API}/creator/pcs`).then(r=>r.json());
    setPcs(list);
    setPc({...pc, id:null});
  };

  // ---------- Monster CRUD ----------
  const saveMon = async ()=>{
    const method = mon.id ? "PUT":"POST";
    const url = mon.id ? `${API}/creator/monsters/${mon.id}` : `${API}/creator/monsters`;
    const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(mon)});
    const data = await res.json();
    const list = await fetch(`${API}/creator/monsters`).then(r=>r.json());
    setMons(list);
    setMon(data);
  };
  const deleteMon = async ()=>{
    if (!mon.id) return;
    await fetch(`${API}/creator/monsters/${mon.id}`,{method:"DELETE"});
    const list = await fetch(`${API}/creator/monsters`).then(r=>r.json());
    setMons(list);
    setMon({...mon, id:null});
  };

  // ---------- Helpers ----------
  const Item = ({label,children}) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );

  const ResistEditor = ({value,onChange})=>{
    const [k,setK]=useState(""); const [v,setV]=useState("1.0");
    const entries = Object.entries(value||{});
    return (
      <div className="border rounded p-2">
        <div className="text-xs text-gray-400 mb-2">Add/edit per-type multipliers (0=immune, 0.5=resist, 1=neutral, 1.5=weak)</div>
        <div className="flex gap-2 mb-2">
          <input value={k} onChange={e=>setK(e.target.value)} placeholder="type (e.g. fire)" className={styles.input}/>
          <input value={v} onChange={e=>setV(e.target.value)} placeholder="mult (e.g. 0.5)" className={styles.input}/>
          <button className={`${styles.btn}`} onClick={()=>{
            const f = parseFloat(v); if (!k || Number.isNaN(f)) return;
            onChange({...value, [k]: f});
            setK(""); setV("1.0");
          }}>Add/Update</button>
        </div>
        {!!entries.length && (
          <div className="grid grid-cols-2 gap-2">
            {entries.map(([t,m])=>(
              <div key={t} className="flex items-center justify-between border rounded px-2 py-1">
                <span className="text-sm">{t}: <span className="text-gray-300">{m}</span></span>
                <button className={`${styles.btn}`} onClick={()=>{
                  const cp = {...value}; delete cp[t]; onChange(cp);
                }}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---------- Creator → Party one-click ----------
  function sendPcToSlot(pcId, slot) {
    // minimal override: set display name if present
    const overrides = { name: (pcs.find(p=>p.id===pcId)?.name || undefined) };
    setPartySlot(slot, pcId, overrides);
    // Optional toast
    alert(`Sent ${pcId} to party slot ${slot+1}. Open Encounter tab to run.`);
  }

  // ---------- Use Monster in Encounter ----------
  async function makeMonsterEncounter(monId) {
    const name = mons.find(m=>m.id===monId)?.name || "Custom Monster";
    const count = 3; // default; could add UI later
    const body = { name: `CM: ${name} x${count}`, monster_id: monId, count };
    const r = await fetch(`${API}/custom_encounters`, {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)
    });
    if (!r.ok) {
      const msg = (await r.json())?.detail || "Failed to create encounter";
      alert(msg); return;
    }
    alert(`Custom encounter created. Click "Reload Data (no restart)" in the sidebar, then select it in Encounter.`);
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex gap-2 mb-4">
        <button className={`${styles.btn} ${tab==='pc'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('pc')}>Player Character</button>
        <button className={`${styles.btn} ${tab==='mon'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('mon')}>Monster</button>
      </div>

      {tab==='pc' ? (
        <div className="grid gap-4">
          {/* PC editor */}
          <div className={`${styles.box}`}>
            <div className={styles.grid3}>
              <Item label="Name"><input className={styles.input} value={pc.name} onChange={e=>setPc({...pc, name:e.target.value})}/></Item>
              <Item label="Class / Archetype">
                <select className={styles.select} value={pc.archetype} onChange={e=>setPc({...pc, archetype:e.target.value})}>
                  {(catalog.classes||[]).length ? catalog.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>) : (
                    ['fighter','rogue','mage','cleric'].map(c=><option key={c} value={c}>{c}</option>)
                  )}
                </select>
              </Item>
              <Item label="Level"><input className={styles.input} type="number" min="1" max="20" value={pc.level} onChange={e=>setPc({...pc, level:Number(e.target.value)})}/></Item>
            </div>

            <div className={styles.grid3}>
              <Item label="HP"><input className={styles.input} type="number" min="1" value={pc.hp} onChange={e=>setPc({...pc, hp:Number(e.target.value)})}/></Item>
              <Item label="AC"><input className={styles.input} type="number" min="1" value={pc.ac} onChange={e=>setPc({...pc, ac:Number(e.target.value)})}/></Item>
              <Item label="Weapon">
                <select className={styles.select} value={pc.weapon_id||""} onChange={e=>setPc({...pc, weapon_id:e.target.value})}>
                  {(catalog.weapons||[]).map(w=><option key={w.id} value={w.id}>{w.name||w.id}</option>)}
                  {!catalog.weapons?.length && ['longsword','dagger','arcane_bolt'].map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </Item>
            </div>

            <div className={styles.grid3}>
              <Item label="Armor">
                <select className={styles.select} value={pc.armor_id||""} onChange={e=>setPc({...pc, armor_id:e.target.value})}>
                  {(catalog.armors||[]).map(a=><option key={a.id} value={a.id}>{a.name||a.id}</option>)}
                  {!catalog.armors?.length && ['cloth','leather','chain'].map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </Item>
              <Item label="Damage Profile [(n,d,b)] JSON">
                <input className={styles.input} value={JSON.stringify(pc.damage_profile)} onChange={e=>{
                  try{ const v = JSON.parse(e.target.value); setPc({...pc, damage_profile:v}); }catch{}
                }}/>
              </Item>
              <Item label="Abilities">
                <div className="flex gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pc.abilities?.sneak_attack} onChange={e=>setPc({...pc, abilities:{...pc.abilities, sneak_attack:e.target.checked}})}/> Sneak</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pc.abilities?.action_surge} onChange={e=>setPc({...pc, abilities:{...pc.abilities, action_surge:e.target.checked}})}/> Surge</label>
                  <select className={styles.select} value={pc.abilities?.spell_burst||""} onChange={e=>setPc({...pc, abilities:{...pc.abilities, spell_burst:e.target.value||null}})}>
                    <option value="">No Burst</option>
                    <option value="L1">L1 (2d8)</option>
                    <option value="L2">L2 (3d8)</option>
                    <option value="L3">L3 (4d8)</option>
                  </select>
                </div>
              </Item>
            </div>

            <ResistEditor value={pc.resists} onChange={(v)=>setPc({...pc, resists:v})} />
            <div className="flex gap-3 mt-3">
              <button className={`${styles.btn} bg-indigo-600 text-white`} onClick={savePc}>{pc.id ? "Update PC":"Save PC"}</button>
              {pc.id && <button className={`${styles.btn} bg-red-700 text-white`} onClick={deletePc}>Delete</button>}
            </div>
          </div>

          {/* Saved PCs with one-click to Party */}
          <div className={`${styles.box}`}>
            <h3 className="font-semibold mb-2">Saved PCs</h3>
            {!pcs.length ? <div className="text-sm text-gray-400">No saved PCs yet.</div> : (
              <div className="grid gap-2">
                {pcs.map(p=>(
                  <div key={p.id} className="border rounded p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{p.name} <span className="text-xs text-gray-400">({p.id})</span></div>
                        <div className="text-xs text-gray-400">{p.archetype} L{p.level} · AC {p.ac} · HP {p.hp}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className={styles.btn} onClick={()=>navigator.clipboard?.writeText(p.id)}>Copy ID</button>
                        <button className={styles.btn} onClick={()=>alert(JSON.stringify(p, null, 2))}>View</button>
                      </div>
                    </div>
                    {/* Slot buttons */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className={styles.tag}>Send to slot:</span>
                      {Array.from({length:8}).map((_,i)=>(
                        <button key={i} className={`${styles.btn}`} onClick={()=>sendPcToSlot(p.id, i)}>{i+1}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">Tip: Party auto-saves to localStorage and the app syncs instantly.</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Monster editor */}
          <div className={`${styles.box}`}>
            <div className={styles.grid3}>
              <Item label="Name"><input className={styles.input} value={mon.name} onChange={e=>setMon({...mon, name:e.target.value})}/></Item>
              <Item label="HP"><input className={styles.input} type="number" min="1" value={mon.hp} onChange={e=>setMon({...mon, hp:Number(e.target.value)})}/></Item>
              <Item label="AC"><input className={styles.input} type="number" min="1" value={mon.ac} onChange={e=>setMon({...mon, ac:Number(e.target.value)})}/></Item>
            </div>
            <div className={styles.grid3}>
              <Item label="Attack Bonus"><input className={styles.input} type="number" value={mon.attack_bonus} onChange={e=>setMon({...mon, attack_bonus:Number(e.target.value)})}/></Item>
              <Item label="Attacks / Round"><input className={styles.input} type="number" min="1" value={mon.attacks_per_round} onChange={e=>setMon({...mon, attacks_per_round:Number(e.target.value)})}/></Item>
              <Item label="Weapon">
                <select className={styles.select} value={mon.weapon_id||""} onChange={e=>setMon({...mon, weapon_id:e.target.value})}>
                  {(catalog.weapons||[]).map(w=><option key={w.id} value={w.id}>{w.name||w.id}</option>)}
                  {!catalog.weapons?.length && ['dagger','longsword','arcane_bolt'].map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </Item>
            </div>
            <div className={styles.grid2}>
              <Item label="Damage Profile [(n,d,b)] JSON">
                <input className={styles.input} value={JSON.stringify(mon.damage_profile)} onChange={e=>{
                  try{ const v = JSON.parse(e.target.value); setMon({...mon, damage_profile:v}); }catch{}
                }}/>
              </Item>
              <Item label="Resists">
                <ResistEditor value={mon.resists} onChange={(v)=>setMon({...mon, resists:v})}/>
              </Item>
            </div>
            <div className="flex gap-3 mt-3">
              <button className={`${styles.btn} bg-indigo-600 text-white`} onClick={saveMon}>{mon.id ? "Update Monster":"Save Monster"}</button>
              {mon.id && <button className={`${styles.btn} bg-red-700 text-white`} onClick={deleteMon}>Delete</button>}
            </div>
          </div>

          {/* Saved monsters with "Use in Encounter" */}
          <div className={`${styles.box}`}>
            <h3 className="font-semibold mb-2">Saved Monsters</h3>
            {!mons.length ? <div className="text-sm text-gray-400">No saved monsters yet.</div> : (
              <div className="grid gap-2">
                {mons.map(m=>(
                  <div key={m.id} className="border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{m.name} <span className="text-xs text-gray-400">({m.id})</span></div>
                      <div className="text-xs text-gray-400">AC {m.ac} · HP {m.hp} · +{m.attack_bonus} · {m.attacks_per_round}x</div>
                    </div>
                    <div className="flex gap-2">
                      <button className={styles.btn} onClick={()=>navigator.clipboard?.writeText(m.id)}>Copy ID</button>
                      <button className={`${styles.btn} bg-emerald-700 text-white`} onClick={()=>makeMonsterEncounter(m.id)}>Use in Encounter</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">After adding, click “Reload Data (no restart)” in the sidebar, then select your custom encounter.</div>
          </div>
        </div>
      )}
    </div>
  );
}
