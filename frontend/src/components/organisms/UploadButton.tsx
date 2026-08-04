import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import Button, { type ButtonProps } from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Progress from "../atoms/Progress";
import Spinner from "../atoms/Spinner";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "../atoms/Dialog";
import { uploadFileToStorage } from "../../api/upload";
import { dispatchFilesChanged } from "../../lib/events";
import { toMessage } from "../../lib/errors";

interface UploadButtonProps extends Pick<ButtonProps, "size" | "variant"> {
  onUploaded?: () => void;
  className?: string;
  children?: ReactNode;
}

type Phase = "idle" | "preparing" | "uploading" | "error";

export default function UploadButton({
  onUploaded,
  className = "",
  size,
  variant,
  children,
}: UploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase === "preparing" || phase === "uploading";

  async function handleUpload() {
    if (!file) return;
    setPhase("preparing");
    setProgress(0);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await uploadFileToStorage(file, {
        signal: controller.signal,
        onStatus: setPhase,
        onProgress: (p) => setProgress(p.percent),
      });
      toast.success("File uploaded", { description: file.name });
      onUploaded?.();
      dispatchFilesChanged();
      setOpen(false);
      setFile(null);
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Upload cancelled"
          : toMessage(err),
      );
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    if (busy) {
      abortRef.current?.abort();
      return;
    }
    resetAndClose();
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setPhase("idle");
    setFile(e.target.files?.[0] ?? null);
  }

  function resetAndClose() {
    setError(null);
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    if (busy) return;
    resetAndClose();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size={size} variant={variant} className={className}>
        {children ?? "Upload"}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent title="Upload file">
          <DialogBody>
            <p className="text-sm text-muted">Select a file to upload. Up to 50 GB.</p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                onChange={handlePick}
                disabled={busy}
                className="max-w-full text-sm text-foreground file:mr-3 file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-accent hover:file:border-muted disabled:opacity-50"
              />
            </div>
            {file && (
              <p className="truncate text-xs text-muted">
                Selected: <span className="text-foreground">{file.name}</span> (
                {(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            {phase === "preparing" && <Spinner label="Preparing upload…" />}
            {phase === "uploading" && <Progress value={progress} label={`${progress}%`} />}
            {error && <ErrorText message={error} />}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button variant="accent" onClick={handleUpload} disabled={!file || busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
