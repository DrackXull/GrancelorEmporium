export default function NavBar({ active, onNavigate, status, version, onOpenCompare }) {
  return (
    <header className="navbar">
      <div className="brand">
        <span className="logo">⚔️</span>
        <div>
          <div className="title">Grancelor’s Emporium</div>
          <div className="subtitle">Builds • Progression • Data</div>
        </div>
      </div>
      <nav className="tabs">
        {["Creator","Progression","Data"].map(tab => (
          <button
            key={tab}
            className={"tab" + (active === tab || (active?.startsWith && active.startsWith(tab)) ? " active" : "")}
            onClick={() => onNavigate(tab)}
          >
            {tab}
          </button>
        ))}
        <button className="tab"  onClick={() => onNavigate("SpellCreator")}>  Spell Creator</button>
        <button  className="tab"  onClick={() => onNavigate("Sim")}>  Sim Lab</button>
        <button className="tab" onClick={onOpenCompare} title="Compare two classes">Compare</button>
      </nav>
      <div className="status">
        <span className={"dot " + (status === "online" ? "ok":"bad")}></span>
        <span className="muted">{status === "online" ? "Online" : "Offline"} {version ? `· v${version}` : ""}</span>
      </div>
    </header>
  );
}
