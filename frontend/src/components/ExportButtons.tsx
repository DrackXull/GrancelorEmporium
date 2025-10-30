// frontend/src/components/ExportButtons.tsx
import React from "react";
import { exportBuildJSON, exportBuildCSV } from "../api";

type Props = {
  getBuild: () => any; // function returning the in-memory build object
  buildId?: string;
};

export default function ExportButtons({ getBuild, buildId }: Props) {
  const onExportJson = async () => {
    const data = await exportBuildJSON(buildId ? { build_id: buildId } : { build: getBuild() });
    const blob = new Blob([JSON.stringify(data.build, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "build.json" });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const onExportCsv = async () => {
    const data = await exportBuildCSV(buildId ? { build_id: buildId } : { build: getBuild() });
    const blob = new Blob([data.content], { type: data.mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: data.filename || "build.csv" });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{display:"flex", gap:8}}>
      <button onClick={onExportJson}>Export JSON</button>
      <button onClick={onExportCsv}>Export CSV</button>
    </div>
  );
}