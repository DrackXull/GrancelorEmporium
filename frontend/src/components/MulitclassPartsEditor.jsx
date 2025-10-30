// frontend/src/components/MulticlassPartsEditor.jsx
import React from "react";

export default function MulticlassPartsEditor({ value, onChange }) {
  const [parts, setParts] = React.useState(value || []);
  const dragIndexRef = React.useRef(null);

  React.useEffect(()=>{ setParts(value || []); }, [JSON.stringify(value)]); // eslint-disable-line

  function commit(next) {
    setParts(next);
    onChange?.(next);
  }
  function addEmpty() {
    const next = [...parts, { class_id:"", subclass_id:"", level:1 }];
    commit(next);
  }
  function remove(i) {
    const next = parts.filter((_,idx)=>idx!==i);
    commit(next);
  }
  function setField(i,key,val) {
    const next = [...parts];
    next[i] = { ...next[i], [key]: val };
    commit(next);
  }
  function onDragStart(i, e) {
    dragIndexRef.current = i;
    e.dataTransfer?.setData("text/plain", String(i));
    e.dataTransfer?.setDragImage?.(new Image(), 0, 0);
  }
  function onDragOver(i, e) { e.preventDefault(); }
  function onDrop(i, e) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from == null || from === i) return;
    const next = [...parts];
    const [moved] = next.splice(from,1);
    next.splice(i,0,moved);
    dragIndexRef.current = null;
    commit(next);
  }

  const totalLevels = parts.reduce((s,p)=>s + Number(p.level || 0), 0);

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold">5e Multiclass Parts</div>
        <div className="text-xs text-gray-600">Total Levels: <b>{totalLevels}</b></div>
      </div>

      <div className="space-y-2">
        {parts.map((p,i)=>(
          <div key={i}
               className="grid grid-cols-12 gap-2 items-end bg-white rounded border p-2"
               draggable
               onDragStart={e=>onDragStart(i,e)}
               onDragOver={e=>onDragOver(i,e)}
               onDrop={e=>onDrop(i,e)}>
            <div className="col-span-1 cursor-grab text-center select-none">☰</div>
            <div className="col-span-3">
              <label className="text-xs text-gray-600">Class ID</label>
              <input className="border rounded px-2 py-1 w-full" value={p.class_id}
                     onChange={e=>setField(i,"class_id",e.target.value.trim())} placeholder="fighter"/>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-gray-600">Subclass ID</label>
              <input className="border rounded px-2 py-1 w-full" value={p.subclass_id || ""}
                     onChange={e=>setField(i,"subclass_id",e.target.value.trim())} placeholder="eldritch_knight"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Levels</label>
              <input type="number" min={1} max={20} className="border rounded px-2 py-1 w-full"
                     value={p.level} onChange={e=>setField(i,"level",Number(e.target.value||1))}/>
            </div>
            <div className="col-span-3 flex gap-1 justify-end">
              <button className="px-2 py-1 border rounded" onClick={()=>remove(i)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={addEmpty}>Add Class</button>
      </div>
    </div>
  );
}
