
import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000");
const API = API_BASE.replace(/\/$/, "") + "/api";

const styles = {
  box: "border rounded p-3",
  input: "border rounded p-2 bg-transparent",
  btn: "px-4 py-2 rounded border",
  grid2: "grid grid-cols-1 md:grid-cols-2 gap-3",
  grid3: "grid grid-cols-1 md:grid-cols-3 gap-3",
  grid6: "grid grid-cols-2 md:grid-cols-6 gap-3",
};

export default function SheetPanel() {
  const [sheetId, setSheetId] = useState("");
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState(null);

  const fetchSheet = async () => {
    if (!sheetId) {
      setError("Please enter a Character ID.");
      setSheet(null);
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${API}/sheets/${sheetId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to fetch character sheet.");
      }
      const data = await response.json();
      setSheet(data);
    } catch (err) {
      setError(err.message);
      setSheet(null);
    }
  };

  const Item = ({ label, children }) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="text-lg font-mono">{children}</div>
    </label>
  );

  return (
    <div className="p-4 max-w-5xl mx-auto grid gap-4">
      <div className={`${styles.box}`}>
        <h2 className="font-semibold text-lg mb-2">View Character Sheet</h2>
        <div className="flex gap-2">
          <input
            className={styles.input}
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="Enter Character ID (e.g., melee_l1_base)"
          />
          <button className={`${styles.btn} bg-indigo-600 text-white`} onClick={fetchSheet}>
            Load Sheet
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded bg-red-900/50 text-white">{error}</div>}

      {sheet && (
        <div className={`${styles.box}`}>
          <div className={styles.grid3}>
            <Item label="Name">{sheet.name}</Item>
            <Item label="Archetype">{sheet.archetype}</Item>
            <Item label="Level">{sheet.level}</Item>
          </div>
          <div className={`${styles.grid3} mt-3`}>
            <Item label="HP">{sheet.hp}</Item>
            <Item label="AC">{sheet.ac}</Item>
            <Item label="Attacks / Round">{sheet.attacks_per_round}</Item>
          </div>
           <div className={`${styles.grid3} mt-3`}>
            <Item label="Weapon">{sheet.weapon?.name || 'N/A'}</Item>
            <Item label="Armor">{sheet.armor?.name || 'N/A'}</Item>
            <Item label="Damage Profile">{JSON.stringify(sheet.damage_profile)}</Item>
          </div>

          <div className="border-t my-4" />

          <div className={styles.grid6}>
            {Object.entries(sheet.save_bonuses || {}).map(([key, value]) => (
              <Item key={key} label={`${key.toUpperCase()} Save`}>{value > 0 ? `+${value}`: value}</Item>
            ))}
          </div>

          <div className="border-t my-4" />

          <div className={styles.grid2}>
            <div>
              <h3 className="font-semibold mb-2">Abilities & Mods</h3>
              <Item label="Abilities">{JSON.stringify(sheet.abilities)}</Item>
              <Item label="Gear Mods">{JSON.stringify(sheet.gear_mods)}</Item>
              <Item label="Spell Mods">{JSON.stringify(sheet.spell_mods)}</Item>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Resistances</h3>
              <Item label="Resistances">{JSON.stringify(sheet.resists)}</Item>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
