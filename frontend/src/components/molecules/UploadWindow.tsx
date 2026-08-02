import { useRef, useState } from "react";
import Button from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Window from "../atoms/Window";
import { simpleUpload } from "../../api";
import { toMessage } from "../../lib/errors";

interface UploadWindowProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadWindow({ onClose, onUploaded }: UploadWindowProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
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
      setSuccess("File uploaded successfully.");
      onUploaded();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);
    setFile(e.target.files?.[0] ?? null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.3)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "360px", maxWidth: "100%" }}>
        <Window title="Upload file">
          <div className="field-row-stacked">
            <p className="muted-text">Select a file to upload (max 1 GB).</p>
            <div className="row">
              <input
                ref={inputRef}
                type="file"
                onChange={handlePick}
                style={{ maxWidth: "220px" }}
              />
              {file && <span className="muted-text">{file.name}</span>}
            </div>
            {error && <ErrorText message={error} />}
            {success && <p className="success-text">{success}</p>}
            {uploading && <span className="muted-text">Uploading...</span>}
            <div className="row">
              <Button onClick={handleUpload} disabled={!file || uploading}>
                OK
              </Button>
              <Button onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
