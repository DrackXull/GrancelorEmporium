export default function Chip({ label, active=false, onClick, onRemove, title }) {
  return (
    <span className={"chip" + (active ? " active" : "")} title={title || (typeof label === "string" ? label : "")}>
      <button onClick={onClick}>{label}</button>
      {onRemove ? <button className="chip-x" onClick={onRemove} aria-label="Remove">×</button> : null}
    </span>
  );
}
