import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../atoms/Select";

interface SortOption {
  value: string;
  label: string;
}

interface SortSelectorProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
}

export default function SortSelector({ value, options, onChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted">Sort by</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
