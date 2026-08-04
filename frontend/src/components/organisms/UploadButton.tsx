import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import Button, { type ButtonProps } from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "../atoms/Dialog";
import { simpleUpload } from "../../api";
import { toMessage } from "../../lib/errors";

interface UploadButtonProps extends Pick<ButtonProps, "size" | "variant"> {
  onUploaded?: () => void;
  className?: string;
  children?: ReactNode;
}

export default function UploadButton({
  onUploaded,
  className = "",
  size,
  variant,
  children,
}: UploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await simpleUpload({
        filename: file.name,
        contentType: file.type || undefined,
      });
      const response = await fetch(res.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
      toast.success("File uploaded", {
        description: file.name,
      });
      onUploaded?.();
      setOpen(false);
      setFile(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  function resetAndClose() {
    setError(null);
    setFile(null);
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size={size} variant={variant} className={className}>
        {children ?? "Upload"}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
        <DialogContent title="Upload file">
          <DialogBody>
            <p className="text-sm text-muted">Select a file to upload. Maximum size: 1 GB.</p>
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                onChange={handlePick}
                className="max-w-full text-sm text-foreground file:mr-3 file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-accent hover:file:border-muted"
              />
            </div>
            {file && (
              <p className="truncate text-xs text-muted">
                Selected: <span className="text-foreground">{file.name}</span> (
                {(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            {error && <ErrorText message={error} />}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={resetAndClose} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="accent" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
