import React, { useState, useEffect } from "react";
import api from "../utils/api";

export default function DPRPreview({
  weaponDice = "1d8",
  strikingRank = 0,
  properties = [],
  targetAC = 20,
  attackBonus = 10,
  strikes = 1,
  isAgile = false,
}) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const body = {
      weaponDice,
      strikingRank,
      properties,
      targetAC,
      attackBonus,
      strikes,
      isAgile,
    };
    let cancel = false;
    api
      .dprPreviewPlus(body)
      .then((data) => { if (!cancel) setPreview(data); })
      .catch(() => { if (!cancel) setPreview(null); });
    return () => { cancel = true; };
  }, [weaponDice, strikingRank, targetAC, attackBonus, strikes, isAgile, JSON.stringify(properties)]);

  if (!preview) return null;

  return (
    <div className="border rounded p-3 text-sm space-y-1">
      <div className="font-semibold">Damage Preview</div>
      <div>Per-hit avg: <b>{preview.avg_per_hit.toFixed(2)}</b></div>
      <div>Total DPR: <b>{preview.dpr_total.toFixed(2)}</b> (over {preview.strikes} strike{preview.strikes>1?"s":""})</div>
      <div className="text-xs text-gray-600">Crit rules included, MAP: {preview.map_penalties.join(", ")}</div>
      <div className="text-xs text-gray-600">Breakdown: {preview.breakdown}</div>
    </div>
  );
}
