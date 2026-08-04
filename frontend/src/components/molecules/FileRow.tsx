import { Link } from "react-router-dom";
import { Download, File, Trash2 } from "lucide-react";
import Button from "../atoms/Button";
import type { FileItem, PublicFileItem } from "../../api";
import { formatBytes, formatDate } from "../../lib/format";
import { isPublicFile } from "../../lib/files";

interface FileRowProps {
  file: PublicFileItem | FileItem;
  showOwner?: boolean;
  onDownload: (file: PublicFileItem | FileItem) => void;
  onDelete?: (file: PublicFileItem | FileItem) => void;
}

export default function FileRow({ file, showOwner = false, onDownload, onDelete }: FileRowProps) {
  return (
    <tr className="border-b border-border transition-colors hover:bg-surface-elevated max-sm:mb-3 max-sm:block max-sm:rounded-lg max-sm:border max-sm:p-3">
      <td className="py-3 pl-3 pr-2 max-sm:p-0">
        <div className="flex items-center gap-2 max-sm:items-start">
          <File size={14} className="mt-0.5 shrink-0 text-muted" />
          <span className="break-all font-medium text-foreground">{file.name}</span>
        </div>
      </td>
      <td
        data-label="Size"
        className="whitespace-nowrap px-2 py-3 text-right text-sm text-muted max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-1 max-sm:text-left max-sm:whitespace-normal max-sm:before:text-[11px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-widest max-sm:before:content-[attr(data-label)]"
      >
        {formatBytes(file.size)}
      </td>
      <td
        data-label="Downloads"
        className="whitespace-nowrap px-2 py-3 text-right text-sm text-muted max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-1 max-sm:text-left max-sm:whitespace-normal max-sm:before:text-[11px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-widest max-sm:before:content-[attr(data-label)]"
      >
        {file.downloadCount}
      </td>
      <td
        data-label="Uploaded"
        className="whitespace-nowrap px-2 py-3 text-sm text-muted max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-1 max-sm:before:text-[11px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-widest max-sm:before:content-[attr(data-label)]"
      >
        {formatDate(file.uploadDate)}
      </td>
      {showOwner && (
        <td
          data-label="Owner"
          className="whitespace-nowrap px-2 py-3 text-sm max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-1 max-sm:before:text-[11px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-widest max-sm:before:content-[attr(data-label)]"
        >
          {isPublicFile(file) ? (
            <Link to={`/users/${encodeURIComponent(file.ownerId)}`} className="text-accent">
              {file.ownerUsername}
            </Link>
          ) : (
            <span className="text-muted">-</span>
          )}
        </td>
      )}
      <td className="py-3 pl-2 pr-3 text-right max-sm:p-0 max-sm:pt-2 max-sm:text-left">
        <div className="flex items-center justify-end gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2">
          <Button size="sm" variant="secondary" onClick={() => onDownload(file)} className="max-sm:w-full">
            <Download size={14} /> Download
          </Button>
          {onDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(file)}
              aria-label="Delete"
              className="max-sm:w-full"
            >
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
