import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../atoms/Button";

interface PaginationProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export default function Pagination({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  disabled = false,
}: PaginationProps) {
  return (
    <div className="mt-6 flex items-center gap-2">
      <Button onClick={onPrev} variant="secondary" size="sm" disabled={disabled || !hasPrev}>
        <ChevronLeft size={14} /> Prev
      </Button>
      <Button onClick={onNext} variant="secondary" size="sm" disabled={disabled || !hasNext}>
        Next <ChevronRight size={14} />
      </Button>
    </div>
  );
}
