import { Link } from "react-router-dom";
import Button from "../atoms/Button";
import type { FileItem, PublicFileItem } from "../../api";
import { formatBytes, formatDate } from "../../lib/format";
import { isPublicFile } from "../../lib/files";

interface FileRowProps {
  file: PublicFileItem | FileItem;
  showOwner?: boolean;
  onDownload: (file: PublicFileItem | FileItem) => void;
}

export default function FileRow({ file, showOwner = false, onDownload }: FileRowProps) {
  return (
    <tr>
      <td className="file-name">{file.name}</td>
      <td className="num">{formatBytes(file.size)}</td>
      <td className="num">{file.downloadCount}</td>
      <td>{formatDate(file.uploadDate)}</td>
      {showOwner && (
        <td>
          {isPublicFile(file) ? (
            <Link to={`/users/${encodeURIComponent(file.ownerId)}`}>{file.ownerUsername}</Link>
          ) : (
            <span className="muted-text">-</span>
          )}
        </td>
      )}
      <td>
        <Button onClick={() => onDownload(file)}>Download</Button>
      </td>
    </tr>
  );
}
