import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import Spinner from "../components/atoms/Spinner";
import FileList from "../components/organisms/FileList";
import Pagination from "../components/molecules/Pagination";
import { usePaginatedFiles } from "../hooks/usePaginatedFiles";
import { getUser, listUserFiles } from "../api";
import type { FileItem, UserProfile } from "../api";
import { formatDate } from "../lib/format";
import { toMessage } from "../lib/errors";

export default function UserProfilePage() {
  const { userId = "" } = useParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const { items, nextToken, loading, error, hasPrev, nextPage, prevPage } =
    usePaginatedFiles<FileItem>(
      (token) => listUserFiles(userId, { nextToken: token, limit: 20 }),
      userId,
    );

  useEffect(() => {
    let cancelled = false;
    getUser(userId)
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setProfileError(null);
          setLoadedUserId(userId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProfileError(toMessage(err));
          setProfile(null);
          setLoadedUserId(userId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = loadedUserId === userId ? profile : null;
  const currentError = loadedUserId === userId ? profileError : null;

  return (
    <>
      <PageTitle>User profile</PageTitle>
      {currentError ? (
        <ErrorText message={currentError} />
      ) : current ? (
        <div className="profile-box sunken-panel" style={{ padding: "12px" }}>
          <div>
            <strong>{current.username}</strong>
            <div className="muted-text">Member since {formatDate(current.createdAt)}</div>
            <div className="muted-text">{current.userId}</div>
          </div>
        </div>
      ) : (
        <Spinner />
      )}
      <PageTitle>Uploaded files</PageTitle>
      {error ? (
        <ErrorText message={error} />
      ) : (
        <>
          <FileList files={items} loading={loading} />
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
