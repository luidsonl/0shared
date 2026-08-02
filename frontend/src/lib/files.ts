import type { FileItem, PublicFileItem } from "../api";

export function isPublicFile(file: PublicFileItem | FileItem): file is PublicFileItem {
  return "ownerId" in file && "ownerUsername" in file;
}
