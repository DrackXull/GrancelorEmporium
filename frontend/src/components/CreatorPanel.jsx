import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000");
const API = API_BASE.replace(/\/$/, "") + "/api";

const styles = {
  box: "border rounded p-3",
  input: "border rounded p-2 bg-transparent",
  select: "border rounded p-2 bg-transparent",
  btn: "px-4 py-2 rounded border",
  grid2: "grid grid-cols-1 md:grid-cols-2 gap-3",
  grid3: "grid grid-cols-1 md:grid-cols-3 gap-3",
};

export default function CreatorPanel(){
  const [catalog, setCatalog] = useState({classes:[],weapons:[],armors:[],paths:[],items:[],monsters_baseline:[]});
  const [pcs, setPcs] = useState([]);
  const [mons, setMons] = useState([]);
  const [items, setItems] = useState([]);
  const [spells, setSpells] = useState([]);
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

  // Item form
  const [item, setItem] = useState({
    id: null,
    name: "New Item",
    slot: "weapon",
    gs: 0,
    mods: {},
    temp_buff: {},
    notes: ""
  });

  // Spell form
  const [spell, setSpell] = useState({
    id: null,
    name: "New Spell",
    level: 1,
    school: "evocation",
    casting_time: "1 action",
    range: "60 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    description: "",
    higher_level: ""
  });

  // load catalog + saved
  useEffect(()=> {
    Promise.all([
      fetch(`${API}/creator/catalog`).then(r=>r.json()),
      fetch(`${API}/creator/pcs`).then(r=>r.json()),
      fetch(`${API}/creator/monsters`).then(r=>r.json()),
      fetch(`${API}/items`).then(r=>r.json()),
      fetch(`${API}/spells`).then(r=>r.json()),
    ]).then(([cat, pcs, mons, items, spells])=> {
      setCatalog(cat||{});
      setPcs(pcs||[]);
      setMons(mons||[]);
      setItems(items||[]);
      setSpells(spells||[]);
    }).catch(()=>{});
  },[]);

  const savePc = async ()=> {
    const method = pc.id ? "PUT":"POST";
    const url = pc.id ? `${API}/creator/pcs/${pc.id}` : `${API}/creator/pcs`;
    const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(pc)});
    const data = await res.json();
    // refresh
    const list = await fetch(`${API}/creator/pcs`).then(r=>r.json());
    setPcs(list);
    setPc(data);
  };
  const deletePc = async ()=> {
    if (!pc.id) return;
    await fetch(`${API}/creator/pcs/${pc.id}`,{method:"DELETE"});
    const list = await fetch(`${API}/creator/pcs`).then(r=>r.json());
    setPcs(list);
    setPc({...pc, id:null});
  };

  const saveMon = async ()=> {
    const method = mon.id ? "PUT":"POST";
    const url = mon.id ? `${API}/creator/monsters/${mon.id}` : `${API}/creator/monsters`;
    const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(mon)});
    const data = await res.json();
    const list = await fetch(`${API}/creator/monsters`).then(r=>r.json());
    setMons(list);
    setMon(data);
  };
  const deleteMon = async ()=> {
    if (!mon.id) return;
    await fetch(`${API}/creator/monsters/${mon.id}`,{method:"DELETE"});
    const list = await fetch(`${API}/creator/monsters`).then(r=>r.json());
    setMons(list);
    setMon({...mon, id:null});
  };

  const saveItem = async () => {
    const method = item.id ? "PUT" : "POST";
    const url = item.id ? `${API}/items/${item.id}` : `${API}/items`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    const data = await res.json();
    const list = await fetch(`${API}/items`).then(r => r.json());
    setItems(list);
    setItem(data);
  };
  const deleteItem = async () => {
    if (!item.id) return;
    await fetch(`${API}/items/${item.id}`, { method: "DELETE" });
    const list = await fetch(`${API}/items`).then(r => r.json());
    setItems(list);
    setItem({ ...item, id: null });
  };

  const saveSpell = async () => {
    const method = spell.id ? "PUT" : "POST";
    const url = spell.id ? `${API}/spells/${spell.id}` : `${API}/spells`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spell) });
    const data = await res.json();
    const list = await fetch(`${API}/spells`).then(r => r.json());
    setSpells(list);
    setSpell(data);
  };
  const deleteSpell = async () => {
    if (!spell.id) return;
    await fetch(`${API}/spells/${spell.id}`, { method: "DELETE" });
    const list = await fetch(`${API}/spells`).then(r => r.json());
    setSpells(list);
    setSpell({ ...spell, id: null });
  };

  const Item = ({label,children}) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );

  const ResistEditor = ({value,onChange})=> {
    const [k,setK]=useState(""); const [v,setV]=useState("1.0");
    const entries = Object.entries(value||{});
    return (
      <div className="border rounded p-2">
        <div className="text-xs text-gray-400 mb-2">Add/edit per-type multipliers (0=immune, 0.5=resist, 1=neutral, 1.5=weak)</div>
        <div className="flex gap-2 mb-2">
          <input value={k} onChange={e=>setK(e.target.value)} placeholder="type (e.g. fire)" className={styles.input}/>
          <input value={v} onChange={e=>setV(e.target.value)} placeholder="mult (e.g. 0.5)" className={styles.input}/>
          <button className={`${styles.btn}`} onClick={()=> {
            const f = parseFloat(v); if (!k || Number.isNaN(f)) return;
            onChange({...value, [k]: f});
            setK(""); setV("1.0");
          }}>Add/Update</button>
        </div>
        {!!entries.length && (
          <div className="grid grid-cols-2 gap-2">
            {entries.map(([t,m])=> (
              <div key={t} className="flex items-center justify-between border rounded px-2 py-1">
                <span className="text-sm">{t}: <span className="text-gray-300">{m}</span></span>
                <button className={`${styles.btn}`} onClick={()=> {
                  const cp = {...value}; delete cp[t]; onChange(cp);
                }}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex gap-2 mb-4">
        <button className={`${styles.btn} ${tab==='pc'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('pc')}>Player Character</button>
        <button className={`${styles.btn} ${tab==='mon'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('mon')}>Monster</button>
        <button className={`${styles.btn} ${tab==='item'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('item')}>Item</button>
        <button className={`${styles.btn} ${tab==='spell'?'bg-gray-800 text-white':'bg-transparent'}`} onClick={()=>setTab('spell')}>Spell</button>
      </div>

      {tab==='pc' ? (
        <div className="grid gap-4">
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
              <Item label="Level">
                <input className={styles.input} type="number" min="1" max="20" value={pc.level} onChange={e=>setPc({...pc, level:Number(e.target.value)})}/>
              </Item>
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
                <input className={styles.input} value={JSON.stringify(pc.damage_profile)} onChange={e=> {
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

          <div className={`${styles.box}`}>
            <h3 className="font-semibold mb-2">Saved PCs</h3>
            {!pcs.length ? <div className="text-sm text-gray-400">No saved PCs yet.</div> : (
              <div className="grid gap-2">
                {pcs.map(p=> (
                  <div key={p.id} className="border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.name} <span className="text-xs text-gray-400">({p.id})</span></div>
                      <div className="text-xs text-gray-400">{p.archetype} L{p.level} · AC {p.ac} · HP {p.hp}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className={styles.btn} onClick={()=>setPc(p)}>Edit</button>
                      <button className={styles.btn} onClick={()=> {
                        navigator.clipboard?.writeText(p.id)
                      }}>Copy ID</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">Tip: Paste the ID into your Party “Baseline (or Custom ID)” selector.</div>
          </div>
        </div>
      ) : tab==='mon' ? (
        <div className="grid gap-4">
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
                <input className={styles.input} value={JSON.stringify(mon.damage_profile)} onChange={e=> {
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

          <div className={`${styles.box}`}>
            <h3 className="font-semibold mb-2">Saved Monsters</h3>
            {!mons.length ? <div className="text-sm text-gray-400">No saved monsters yet.</div> : (
              <div className="grid gap-2">
                {mons.map(m=> (
                  <div key={m.id} className="border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{m.name} <span className="text-xs text-gray-400">({m.id})</span></div>
                      <div className="text-xs text-gray-400">AC {m.ac} · HP {m.hp} · +{m.attack_bonus} · {m.attacks_per_round}x</div>
                    </div>
                    <div className="flex gap-2">
                      <button className={styles.btn} onClick={()=>setMon(m)}>Edit</button>
                      <button className={styles.btn} onClick={()=>navigator.clipboard?.writeText(m.id)}>Copy ID</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">Tip: You can reference custom monsters in encounters or load them via future tools.</div>
          </div>
        </div>
      ) : tab === 'item' ? (
        <div className="grid gap-4">
          <div className={`${styles.box}`}>
            <div className={styles.grid3}>
              <Item label="ID"><input className={styles.input} value={item.id} onChange={e=>setItem({...item, id:e.target.value})} /></Item>
              <Item label="Name"><input className={styles.input} value={item.name} onChange={e=>setItem({...item, name:e.target.value})} /></Item>
              <Item label="Slot"><input className={styles.input} value={item.slot} onChange={e=>setItem({...item, slot:e.target.value})} /></Item>
            </div>
            <div className={styles.grid3}>
              <Item label="GS"><input className={styles.input} type="number" value={item.gs} onChange={e=>setItem({...item, gs:Number(e.target.value)})} /></Item>
              <Item label="Mods (JSON)"><input className={styles.input} value={JSON.stringify(item.mods)} onChange={e=>{ try{ const v = JSON.parse(e.target.value); setItem({...item, mods:v}); }catch{} }} /></Item>
              <Item label="Temp Buff (JSON)"><input className={styles.input} value={JSON.stringify(item.temp_buff)} onChange={e=>{ try{ const v = JSON.parse(e.target.value); setItem({...item, temp_buff:v}); }catch{} }} /></Item>
            </div>
            <Item label="Notes"><textarea className={styles.input} value={item.notes} onChange={e=>setItem({...item, notes:e.target.value})} /></Item>
            <div className="flex gap-3 mt-3">
              <button className={`${styles.btn} bg-indigo-600 text-white`} onClick={saveItem}>{item.id ? "Update Item":"Save Item"}</button>
              {item.id && <button className={`${styles.btn} bg-red-700 text-white`} onClick={deleteItem}>Delete</button>}
            </div>
          </div>
          <div className={`${styles.box}`}>
            <h3 className="font-semibold mb-2">Saved Items</h3>
            {!items.length ? <div className="text-sm text-gray-400">No saved items yet.</div> : (
              <div className="grid gap-2">
                {items.map(i=> (
                  <div key={i.id} className="border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{i.name} <span className="text-xs text-gray-400">({i.id})</span></div>
                      <div className="text-xs text-gray-400">Slot: {i.slot} · GS: {i.gs}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className={styles.btn} onClick={()=>setItem(i)}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
        <div className={`${styles.box}`}>
          <div className={styles.grid3}>
            <Item label="ID"><input className={styles.input} value={spell.id} onChange={e=>setSpell({...spell, id:e.target.value})} /></Item>
            <Item label="Name"><input className={styles.input} value={spell.name} onChange={e=>setSpell({...spell, name:e.target.value})} /></Item>
            <Item label="Level"><input className={styles.input} type="number" value={spell.level} onChange={e=>setSpell({...spell, level:Number(e.target.value)})} /></Item>
          </div>
          <div className={styles.grid3}>
            <Item label="School"><input className={styles.input} value={spell.school} onChange={e=>setSpell({...spell, school:e.target.value})} /></Item>
            <Item label="Casting Time"><input className={styles.input} value={spell.casting_time} onChange={e=>setSpell({...spell, casting_time:e.target.value})} /></Item>
            <Item label="Range"><input className={styles.input} value={spell.range} onChange={e=>setSpell({...spell, range:e.target.value})} /></Item>
          </div>
          <div className={styles.grid2}>
            <Item label="Components (comma-separated)"><input className={styles.input} value={(spell.components||[]).join(', ')} onChange={e=>setSpell({...spell, components:e.target.value.split(',').map(s=>s.trim())})} /></Item>
            <Item label="Duration"><input className={styles.input} value={spell.duration} onChange={e=>setSpell({...spell, duration:e.target.value})} /></Item>
          </div>
          <Item label="Description"><textarea className={styles.input} value={spell.description} onChange={e=>setSpell({...spell, description:e.target.value})} /></Item>
          <Item label="Higher Level"><textarea className={styles.input} value={spell.higher_level} onChange={e=>setSpell({...spell, higher_level:e.target.value})} /></Item>

          <div className="flex gap-3 mt-3">
            <button className={`${styles.btn} bg-indigo-600 text-white`} onClick={saveSpell}>{spell.id ? "Update Spell":"Save Spell"}</button>
            {spell.id && <button className={`${styles.btn} bg-red-700 text-white`} onClick={deleteSpell}>Delete</button>}
          </div>
        </div>
        <div className={`${styles.box}`}>
          <h3 className="font-semibold mb-2">Saved Spells</h3>
          {!spells.length ? <div className="text-sm text-gray-400">No saved spells yet.</div> : (
            <div className="grid gap-2">
              {spells.map(s=> (
                <div key={s.id} className="border rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.name} <span className="text-xs text-gray-400">({s.id})</span></div>
                    <div className="text-xs text-gray-400">L{s.level} {s.school}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className={styles.btn} onClick={()=>setSpell(s)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
