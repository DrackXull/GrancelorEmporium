// frontend/src/components/PF2eSkillsEditor.jsx
import React, { useEffect, useState } from "react";
import  api  from "../utils/api";

const ALL_SKILLS = [
  "acrobatics","arcana","athletics","crafting","deception","diplomacy","intimidation",
  "medicine","nature","occultism","performance","religion","society","stealth",
  "survival","thievery","lore_1","lore_2"
];

export default function PF2eSkillsEditor({ classId }) {
  const [bumps, setBumps]   = useState({});
  const [level, setLevel]   = useState(1);
  const [skillId, setSkillId] = useState("");
  const [issues, setIssues] = useState({});
  const [suggest, setSuggest] = useState(ALL_SKILLS);

  async function refresh() {
    const { data } = await api.get(`/api/skills/plan/${encodeURIComponent(classId)}`);
    setBumps((data?.plan || {}).bumps_by_level || {});
    await validate();
  }

  useEffect(()=>{ if (classId) refresh(); }, [classId]);

  useEffect(()=>{
    (async()=>{
      const { data } = await api.get("/api/skills/suggest", { params: { class_id: classId }});
      setSuggest(data?.skills?.length ? data.skills : ALL_SKILLS);
    })();
  }, [classId]);

  async function save() {
    if (!skillId) return;
    await api.post(`/api/skills/plan/${encodeURIComponent(classId)}/bump`, {
      level: Number(level),
      skill_id: skillId
    });
    await refresh();
    setSkillId("");
  }

  async function removeAt(lv, id) {
    await api.post(`/api/skills/plan/${encodeURIComponent(classId)}/bump`, {
      level: Number(lv),
      skill_id: id,
      remove: true
    });
    await refresh();
  }

  async function validate() {
    const { data } = await api.get("/api/validate/pf2e_skills", { params: { class_id: classId }});
    setIssues(data?.issues_by_level || {});
  }

  const rows = [];
  for (let L=1; L<=20; L++){
    rows.push({ level:L, skills: (bumps[String(L)] || []) });
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="font-semibold">PF2e Skills Plan</div>
      <div className="flex gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Level</label>
          <input
            type="number" min={1} max={20}
            className="border rounded px-2 py-1 w-20"
            value={level}
            onChange={e=>setLevel(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Skill</label>
          <input
            className="border rounded px-2 py-1 w-64"
            list="pf2e-skills"
            value={skillId}
            onChange={e=>setSkillId(e.target.value.trim())}
            placeholder="athletics"
          />
          <datalist id="pf2e-skills">
            {(suggest || ALL_SKILLS).map(s=><option key={s} value={s}>{s}</option>)}
          </datalist>
        </div>
        <button className="px-3 py-1 border rounded" onClick={save}>Add Bump</button>
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold px-2 py-1">
          <div className="col-span-1">Lv</div>
          <div className="col-span-9">Bumps</div>
          <div className="col-span-2">Issues</div>
        </div>
        {rows.map(r=>(
          <div key={r.level} className="grid grid-cols-12 px-2 py-1 border-t text-sm">
            <div className="col-span-1">{r.level}</div>
            <div className="col-span-9">
              {r.skills.length ? r.skills.map(s=>(
                <span key={s} className="inline-flex items-center mr-2 mb-1">
                  <span className="px-2 py-0.5 border rounded text-xs">{s}</span>
                  <button className="ml-1 text-xs underline" onClick={()=>removeAt(r.level, s)}>remove</button>
                </span>
              )) : <span className="text-xs text-gray-500">—</span>}
            </div>
            <div className="col-span-2 text-xs">
              {(issues[r.level] || []).map((m,i)=><div key={i} className="text-red-600">• {m}</div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
