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
    <div className="row">
      <label htmlFor="sort-select">Sort by:</label>
      <select id="sort-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
