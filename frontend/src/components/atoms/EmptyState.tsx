interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="sunken-panel" style={{ padding: "16px", textAlign: "center" }}>
      <p className="muted-text">{message}</p>
    </div>
  );
}
