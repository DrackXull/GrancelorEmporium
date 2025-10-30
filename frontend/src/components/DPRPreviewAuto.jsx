import React, { useState, useEffect } from "react";
import api from "../utils/api";

export default function DPRPreviewAuto({
  classId, level,
  weaponId, weaponDice = "1d8",
  abilityMod = 4, potency = 2, strikingRank = 1,
  properties = [], targetAC = 24, strikes = 2, isAgile = false
}) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    if (!classId || !level) { setRes(null); return; }
    const body = {
      classId, level,
      weaponId, weaponDice,
      abilityMod, potency, strikingRank,
      properties, targetAC, strikes, isAgile
    };
    let cancel = false;
    api
      .dprPreviewFromBuild(body)
      .then((data) => { if (!cancel) setRes(data); })
      .catch(() => { if (!cancel) setRes(null); });
    return () => { cancel = true; };
  }, [classId, level, weaponId, weaponDice, abilityMod, potency, strikingRank, targetAC, strikes, isAgile, JSON.stringify(properties)]);

  if (!res) return null;

  return (
    <div className="border rounded p-3 text-sm space-y-1">
      <div className="font-semibold">Damage Preview (Auto)</div>
      <div>Attack bonus (derived): <b>+{res.attack_bonus}</b></div>
      <div>Per-hit avg: <b>{res.avg_per_hit.toFixed(2)}</b></div>
      <div>Total DPR: <b>{res.dpr_total.toFixed(2)}</b> (over {res.strikes} strike{res.strikes>1?"s":""})</div>
      <div className="text-xs text-gray-600">MAP: {res.map_penalties.join(", ")}</div>
      <div className="text-xs text-gray-600">Breakdown: {res.breakdown}</div>
    </div>
  );
}
