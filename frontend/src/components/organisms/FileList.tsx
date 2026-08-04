import { useState } from "react";
import EmptyState from "../atoms/EmptyState";
import ErrorText from "../atoms/ErrorText";
import Spinner from "../atoms/Spinner";
import FileRow from "../molecules/FileRow";
import { download } from "../../api";
import type { FileItem, PublicFileItem } from "../../api";
import { toMessage } from "../../lib/errors";

interface FileListProps {
  files: Array<PublicFileItem | FileItem>;
  showOwner?: boolean;
  loading?: boolean;
  onDelete?: (file: PublicFileItem | FileItem) => void;
}

export default function FileList({ files, showOwner = false, loading = false, onDelete }: FileListProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(file: PublicFileItem | FileItem) {
    setError(null);
    try {
      const res = await download(file.fileId);
      window.open(res.url, "_blank", "noopener");
    } catch (err) {
      setError(toMessage(err));
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorText message={error} />;
  if (files.length === 0) return <EmptyState message="No files here yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-widest text-muted">
            <th className="py-2.5 pl-3 pr-2 text-left font-semibold">Name</th>
            <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Size</th>
            <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Downloads</th>
            <th className="whitespace-nowrap px-2 py-2.5 text-left font-semibold">Uploaded</th>
            {showOwner && <th className="whitespace-nowrap px-2 py-2.5 text-left font-semibold">Owner</th>}
            <th className="py-2.5 pl-2 pr-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow key={file.fileId} file={file} showOwner={showOwner} onDownload={handleDownload} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
