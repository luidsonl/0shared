import { Link } from "react-router-dom";
import { Download, File } from "lucide-react";
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
    <tr className="border-b border-border transition-colors hover:bg-surface-elevated">
      <td className="py-3 pl-3 pr-2">
        <div className="flex items-center gap-2">
          <File size={14} className="shrink-0 text-muted" />
          <span className="break-all font-medium text-foreground">{file.name}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-right text-sm text-muted">
        {formatBytes(file.size)}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-right text-sm text-muted">
        {file.downloadCount}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-sm text-muted">{formatDate(file.uploadDate)}</td>
      {showOwner && (
        <td className="whitespace-nowrap px-2 py-3 text-sm">
          {isPublicFile(file) ? (
            <Link to={`/users/${encodeURIComponent(file.ownerId)}`} className="text-accent">
              {file.ownerUsername}
            </Link>
          ) : (
            <span className="text-muted">-</span>
          )}
        </td>
      )}
      <td className="py-3 pl-2 pr-3 text-right">
        <Button size="sm" variant="secondary" onClick={() => onDownload(file)}>
          <Download size={14} /> Download
        </Button>
      </td>
    </tr>
  );
}
