import { useSearchParams } from "react-router-dom";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import Spinner from "../components/atoms/Spinner";
import Pagination from "../components/molecules/Pagination";
import UserList from "../components/organisms/UserList";
import { useUserSearch } from "../hooks/useUserSearch";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { users, nextToken, loading, error, hasPrev, nextPage, prevPage } = useUserSearch(q);

  return (
    <>
      <PageTitle>Search users</PageTitle>
      {q ? (
        <>
          <p className="muted-text">Results for &ldquo;{q}&rdquo;</p>
          {error ? (
            <ErrorText message={error} />
          ) : loading ? (
            <Spinner />
          ) : (
            <>
              <UserList users={users} />
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
        <p className="muted-text">Type a username in the search box above.</p>
      )}
    </>
  );
}
