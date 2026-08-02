export default function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <progress style={{ width: "120px" }} />
      <span className="muted-text">Loading...</span>
    </div>
  );
}
