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
}

export default function FileList({ files, showOwner = false, loading = false }: FileListProps) {
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
    <div className="table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Downloads</th>
            <th>Uploaded</th>
            {showOwner && <th>Owner</th>}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow key={file.fileId} file={file} showOwner={showOwner} onDownload={handleDownload} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
