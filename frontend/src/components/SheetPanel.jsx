import React, {useState, useEffect}from "react";
import api from "../utils/api";


export default function SheetPanel({ title = "Sheet Panel", style, ...rest }) {
  const [types, setTypes] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.rawGet("/damage/types");
        if (alive) setTypes(d?.types || []);
      } catch {
        if (alive) setTypes([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section
      aria-label={title}
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        ...style,
      }}
      {...rest}
    >
      <header style={{ fontWeight: 600, marginBottom: 8 }}>{title}</header>
      <div style={{ opacity: 0.8, fontSize: 13 }}>
        Known damage types: {types.length ? types.join(", ") : "—"}
      </div>
    </section>
  );
}
