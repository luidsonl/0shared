import { useState } from "react";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import FileList from "../components/organisms/FileList";
import Pagination from "../components/molecules/Pagination";
import SortSelector from "../components/molecules/SortSelector";
import { Logo, Wordmark } from "../components/brand/Logo";
import { usePaginatedFiles } from "../hooks/usePaginatedFiles";
import { listFiles } from "../api";
import type { PublicFileItem, SortBy } from "../api";

const SORT_OPTIONS = [
  { value: "downloadCount", label: "Most downloaded" },
  { value: "uploadDate", label: "Newest" },
];

export default function HomePage() {
  const [sortBy, setSortBy] = useState<SortBy>("downloadCount");
  const reloadKey = 0;
  const { items, nextToken, loading, error, hasPrev, nextPage, prevPage } =
    usePaginatedFiles<PublicFileItem>(
      (next) => listFiles({ sortBy, nextToken: next, limit: 20 }),
      [sortBy, reloadKey],
    );

  return (
    <>
      <section className="mb-10 border-b border-border pb-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Logo className="h-12 w-12 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <Wordmark />
            </h1>
            <p className="mt-1 text-sm text-muted">
              Serverless file sharing with direct downloads. No accounts required to browse.
            </p>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Shared files</PageTitle>
        <SortSelector
          value={sortBy}
          options={SORT_OPTIONS}
          onChange={(v) => setSortBy(v as SortBy)}
        />
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
