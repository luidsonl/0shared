interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
