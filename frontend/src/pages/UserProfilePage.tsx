import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import PageTitle from "../components/atoms/PageTitle";
import ErrorText from "../components/atoms/ErrorText";
import Spinner from "../components/atoms/Spinner";
import Avatar from "../components/atoms/Avatar";
import Badge from "../components/atoms/Badge";
import Button from "../components/atoms/Button";
import Card, { CardBody } from "../components/atoms/Card";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "../components/atoms/Dialog";
import FileList from "../components/organisms/FileList";
import Pagination from "../components/molecules/Pagination";
import { usePaginatedFiles } from "../hooks/usePaginatedFiles";
import { useRefreshOnUpload } from "../hooks/useRefreshOnUpload";
import { deleteFile, getUser, listUserFiles } from "../api";
import type { FileItem, UserProfile } from "../api";
import { useAuth } from "../context/useAuth";
import { formatDate } from "../lib/format";
import { dispatchFilesChanged } from "../lib/events";
import { toMessage } from "../lib/errors";

export default function UserProfilePage() {
  const { userId = "" } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useRefreshOnUpload(() => setTick((t) => t + 1));

  const { items, nextToken, loading, error, hasPrev, nextPage, prevPage } =
    usePaginatedFiles<FileItem>(
      (next) => listUserFiles(userId, { nextToken: next, limit: 20 }),
      [userId, tick],
    );

  const isOwnProfile = !!user && user.userId === userId;

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFile(pendingDelete.fileId);
      toast.success("File deleted", { description: pendingDelete.name });
      setPendingDelete(null);
      dispatchFilesChanged();
    } catch (err) {
      setDeleteError(toMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError(null);
  }

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
          <FileList
            files={items}
            loading={loading}
            onDelete={isOwnProfile ? (f) => setPendingDelete(f as FileItem) : undefined}
          />
          <Pagination
            hasPrev={hasPrev}
            hasNext={!!nextToken}
            onPrev={prevPage}
            onNext={nextPage}
            disabled={loading}
          />
        </>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(next) => !next && closeDeleteDialog()}>
        <DialogContent title="Delete file">
          <DialogBody>
            <p className="text-sm text-muted">
              Delete <span className="text-foreground">{pendingDelete?.name}</span>? This cannot be
              undone.
            </p>
            {deleteError && <ErrorText message={deleteError} />}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDeleteDialog} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
