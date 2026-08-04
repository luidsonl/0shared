import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import Spinner from "../components/atoms/Spinner";
import Avatar from "../components/atoms/Avatar";
import Badge from "../components/atoms/Badge";
import Card, { CardBody } from "../components/atoms/Card";
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
      (next) => listUserFiles(userId, { nextToken: next, limit: 20 }),
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
      <div className="mb-8">
        <PageTitle>User profile</PageTitle>
      </div>
      {currentError ? (
        <ErrorText message={currentError} />
      ) : current ? (
        <Card className="mb-8">
          <CardBody className="flex flex-wrap items-center gap-4">
            <Avatar username={current.username} className="h-12 w-12 text-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-foreground">{current.username}</h2>
                <Badge variant="accent">Member</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                Member since {formatDate(current.createdAt)}
              </p>
              <p className="break-all text-[11px] uppercase tracking-widest text-muted">
                {current.userId}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Spinner className="mb-8" />
      )}

      <div className="mb-4">
        <PageTitle>Uploaded files</PageTitle>
      </div>
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
