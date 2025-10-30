// frontend/src/App.jsx
import React, { useEffect, useState } from "react";
import SavedSearchDrawer from "./components/SavedSearchDrawer";
import NavBar from "./components/NavBar.jsx";
import CreatorPanel from "./components/CreatorPanel.jsx";
import ProgressionPanel from "./components/ProgressionPanel.jsx";
import DataBrowser from "./components/DataBrowser.jsx";
import CompareDrawer from "./components/CompareDrawer.jsx";
import SkillsEditor from "./components/SkillsEditor.jsx";
import SpellCreator from "./pages/SpellCreator";
import MonsterCreator from "./pages/MonsterCreator";
import SimLab from "./pages/SimLab";
import "./styles.css";
import api from "./utils/api";

export default function App() {
  const [savedOpen, setSavedOpen] = useState(false);
  const [ruleset, setRuleset] = useState("pf2e");

  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q") || "";
    const types = url.searchParams.get("types") || "";
    if (q || types) {
      window.dispatchEvent(
        new CustomEvent("tpka:apply-saved-search", { detail: { q, types } })
      );
    }
  }, []);

  const [route, setRoute] = useState("Creator");
  const [apiHealth, setApiHealth] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [skillsEditor, setSkillsEditor] = useState(null); // {class_id, ruleset} | null

  useEffect(() => {
    let alive = true;
    let controller = null;
    const isProd = import.meta.env.PROD;
    const BASE_MS = isProd ? 30000 : 5000;
    const MAX_MS = isProd ? 120000 : 15000;
    let nextDelay = BASE_MS;
    let timer = null;
    let lastOnline = undefined;

    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (!alive) return;
      if (document.hidden) {
        schedule(BASE_MS);
        return;
      }
      try {
          const d = await api.ping();
          const online = !!d?.ok;
        if (online !== lastOnline || (online && JSON.stringify(d) !== JSON.stringify(apiHealth))) {
          setApiHealth(online ? d : null);
          lastOnline = online;
        }

        nextDelay = BASE_MS;
        schedule(nextDelay);
      } catch {
        if (lastOnline !== false) {
          setApiHealth(null);
          lastOnline = false;
        }
        nextDelay = Math.min(Math.round(nextDelay * 1.7), MAX_MS);
        schedule(nextDelay);
      }
    };

    tick();
    const vis = () => { if (!document.hidden) { nextDelay = BASE_MS; tick(); } };
    document.addEventListener("visibilitychange", vis);

    return () => {
      alive = false;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const parseHash = () => {
      const h = (location.hash || "").replace(/^#\/?/, "").toLowerCase();
      if (h === "creator") setRoute("Creator");
      else if (h === "data") setRoute("Data");
      else if (h === "sim") setRoute("Sim");
      else if (h === "creator/spell" || h === "spellcreator") setRoute("SpellCreator");
      else if (h === "creator/monster" || h === "monstercreator") setRoute("MonsterCreator");
      else if (h.startsWith("progression-")) setRoute("Progression-" + decodeURIComponent(h.slice("progression-".length)));
    };
    window.addEventListener("hashchange", parseHash);
    parseHash();
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  useEffect(() => {
    if (route === "Creator") location.hash = "/creator";
    else if (route === "Data") location.hash = "/data";
    else if (route === "Sim") location.hash = "/sim";
    else if (route === "SpellCreator") location.hash = "/creator/spell";
    else if (route.startsWith("Progression-"))
      location.hash = "/progression-" + encodeURIComponent(route.replace("Progression-", ""));
  }, [route]);

  return (
    <div className="app-shell">
      <NavBar
        active={route}
        onNavigate={setRoute}
        status={apiHealth?.ok ? "online" : "offline"}
        version={apiHealth?.version}
        onOpenCompare={() => setCompareOpen(true)}
      />

      <main className="main">
        {route === "Creator" && (
          <CreatorPanel
            onOpenProgression={(q) => setRoute("Progression-" + JSON.stringify(q))}
            onOpenSkills={(c) => setSkillsEditor(c)}
          />
        )}

        {route.startsWith("Progression") ? (
          <ProgressionPanel initQuery={safeParseRoute(route)} />
        ) : null}

        {route === "Data" && <DataBrowser />}
        {route === "SpellCreator" && <SpellCreator />}
        {route === "MonsterCreator" && <MonsterCreator />}
        {route === "Sim" && <SimLab />}

        {compareOpen && <CompareDrawer onClose={() => setCompareOpen(false)} />}

        {skillsEditor && (
          <SkillsEditor
            classId={skillsEditor.class_id}
            ruleset={skillsEditor.ruleset}
            onClose={() => setSkillsEditor(null)}
          />
        )}

        <button
          className="px-3 py-1 rounded bg-gray-800 text-white hover:opacity-90"
          onClick={() => setSavedOpen(true)}
        >
          Saved Searches
        </button>
      </main>

      <SavedSearchDrawer open={savedOpen} onClose={() => setSavedOpen(false)} ruleset={ruleset} />


      <footer className="footer">
        <span>Grancelor’s Emporium · Phase 4</span>
        {apiHealth?.service && (
          <span className="muted">
            API: {apiHealth.service} v{apiHealth.version}
          </span>
        )}
      </footer>
    </div>
  );
}

function safeParseRoute(route) {
  try {
    if (!route.startsWith("Progression-")) return null;
    return JSON.parse(route.replace("Progression-", ""));
  } catch {
    return null;
  }
}