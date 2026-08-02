import Button from "../atoms/Button";

interface PaginationProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export default function Pagination({ hasPrev, hasNext, onPrev, onNext, disabled = false }: PaginationProps) {
  return (
    <div className="row mt">
      <Button onClick={onPrev} disabled={disabled || !hasPrev}>
        &lt; Prev
      </Button>
      <Button onClick={onNext} disabled={disabled || !hasNext}>
        Next &gt;
      </Button>
    </div>
  );
}
