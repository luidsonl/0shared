import { useSearchParams } from "react-router-dom";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import Spinner from "../components/atoms/Spinner";
import Pagination from "../components/molecules/Pagination";
import FileList from "../components/organisms/FileList";
import { useFileSearch } from "../hooks/useFileSearch";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { files, nextToken, loading, error, hasPrev, nextPage, prevPage } = useFileSearch(q);

  return (
    <>
      <div className="mb-6">
        <PageTitle>Search files</PageTitle>
      </div>
      {q ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Results for <span className="text-foreground">&ldquo;{q}&rdquo;</span>
          </p>
          {error ? (
            <ErrorText message={error} />
          ) : loading ? (
            <Spinner />
          ) : (
            <>
              <FileList files={files} showOwner />
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
      ) : (
        <p className="text-sm text-muted">Type a filename in the search box above.</p>
      )}
    </>
  );
}
