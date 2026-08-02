import { useState } from "react";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import FileList from "../components/organisms/FileList";
import Pagination from "../components/molecules/Pagination";
import SortSelector from "../components/molecules/SortSelector";
import { usePaginatedFiles } from "../hooks/usePaginatedFiles";
import { listFiles } from "../api";
import type { PublicFileItem, SortBy } from "../api";

const SORT_OPTIONS = [
  { value: "downloadCount", label: "Most downloaded" },
  { value: "uploadDate", label: "Newest" },
];

export default function HomePage() {
  const [sortBy, setSortBy] = useState<SortBy>("downloadCount");
  const { items, nextToken, loading, error, hasPrev, nextPage, prevPage } =
    usePaginatedFiles<PublicFileItem>(
      (token) => listFiles({ sortBy, nextToken: token, limit: 20 }),
      sortBy,
    );

  return (
    <>
      <PageTitle>Shared files</PageTitle>
      <div className="row">
        <SortSelector value={sortBy} options={SORT_OPTIONS} onChange={(v) => setSortBy(v as SortBy)} />
      </div>
      {error ? (
        <ErrorText message={error} />
      ) : (
        <>
          <FileList files={items} showOwner loading={loading} />
          <Pagination
            hasPrev={hasPrev}
            hasNext={!!nextToken}
            onPrev={prevPage}
            onNext={nextPage}
            disabled={loading}
          />
        </>
      )}
    </>
  );
}
