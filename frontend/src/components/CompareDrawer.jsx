import { useEffect, useState } from "react";

export default function CompareDrawer({ onClose }) {
  const [classes, setClasses] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    api.get("/api/catalog", { params: { kind: "classes", page: 1, page_size: 1000 }})
  .then(({data:d})=>{
      setClasses(d.items || []);
      if (d.items?.[0]) setA(d.items[0].id);
      if (d.items?.[1]) setB(d.items[1].id);
    });
  },[]);

  function runCompare() {
    if (!a || !b) return;
    setLoading(true);
    const p = new URLSearchParams({ class_id_a: a, class_id_b: b });
    api.get("/api/compare/builds", { params: Object.fromEntries(p) }).then(({data})=>setDiff(data)).finally(()=>setLoading(false));
  }

  return (
    <div className="drawer">
      <div className="drawer-card">
        <div className="drawer-head">
          <h3>Compare Builds</h3>
          <button className="icon" onClick={onClose}>×</button>
        </div>

        <div className="grid two">
          <div className="field">
            <label>Class A</label>
            <select value={a} onChange={e=>setA(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Class B</label>
            <select value={b} onChange={e=>setB(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="row gap">
          <button className="btn" onClick={runCompare} disabled={loading || !a || !b}>
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>

        <div className="hr" />
        {!diff ? <div className="muted">Pick two classes to diff.</div> : (
          <>
            <h4>Gear changes</h4>
            <DiffTable rows={diff.gear_changes} />
            <h4 style={{marginTop:12}}>Skills changes</h4>
            <DiffTable rows={diff.skills_changes} isSkills />
          </>
        )}
      </div>
    </div>
  );
}

function DiffTable({ rows, isSkills }) {
  if (!rows?.length) return <div className="muted">No differences.</div>;
  return (
    <table className="table">
      <thead><tr><th>Level</th><th>A</th><th>B</th></tr></thead>
      <tbody>
        {rows.map(r=>(
          <tr key={r.level}>
            <td> {r.level} </td>
            <td><pre className="pre">{pretty(isSkills ? r.a?.bumps : r.a)}</pre></td>
            <td><pre className="pre">{pretty(isSkills ? r.b?.bumps : r.b)}</pre></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pretty(obj) {
  if (!obj) return "—";
  return JSON.stringify(obj, null, 0);
}
