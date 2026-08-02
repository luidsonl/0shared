import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <form className="field-row" onSubmit={handleSubmit}>
      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users"
        aria-label="Search users"
      />
      <Button>Search</Button>
    </form>
  );
}
