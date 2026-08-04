import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import Button from "../atoms/Button";
import TextInput from "../atoms/TextInput";

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users"
        aria-label="Search users"
        className="h-8 w-44 sm:w-56"
      />
      <Button type="submit" size="sm" variant="ghost" aria-label="Search">
        <Search size={14} />
      </Button>
    </form>
  );
}
