// frontend/src/components/VersionBadge.jsx
import React, { useEffect, useMemo, useState } from "react";
import { http } from "../utils/http";

export default function VersionBadge() {
  const [v, setV] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    http.get("/api/version")
      .then(data => { if (alive) setV(data); })
      .catch(() => { if (alive) setV({ version: "dev" }); });
    return () => { alive = false; };
  }, []);

  if (!v) return <span style={{ opacity: 0.6, fontSize: 12 }}>ver…</span>;
  return (
    <span
      title={`git: ${v.git || "n/a"}`}
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.2)",
        opacity: 0.9,
        marginLeft: 8,
      }}
    >
      v{v.version || "dev"}
    </span>
  );
}
