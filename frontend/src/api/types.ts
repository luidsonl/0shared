export type SortBy = "name" | "downloadCount" | "uploadDate";
export type SortOrder = "asc" | "desc";

export interface Pagination {
  nextToken: string | null;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  dynamodb: string;
  s3: string;
}

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
}

export interface SignupResponse {
  userId: string;
  email: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  email: string;
  username: string;
  expiresAt: string;
}

export interface MeResponse {
  userId: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface FileItem {
  fileId: string;
  name: string;
  size: number;
  contentType: string;
  uploadDate: string;
  downloadCount: number;
}

export interface PublicFileItem extends FileItem {
  ownerId: string;
  ownerUsername: string;
}

export interface FileListResponse extends Pagination {
  files: FileItem[];
}

export interface PublicFileListResponse extends Pagination {
  files: PublicFileItem[];
}

export interface UserProfile {
  userId: string;
  username: string;
  createdAt: string;
}

export interface SimpleUploadRequest {
  filename: string;
  contentType?: string;
}

export interface SimpleUploadResponse {
  url: string;
  fileId: string;
  userId: string;
  key: string;
}

export interface MultipartPart {
  partNumber: number;
  url: string;
  start: number;
  end: number;
  size: number;
}

export interface MultipartInitiateRequest {
  filename: string;
  contentType?: string;
  fileSize: number;
  partSize?: number;
}

export interface MultipartInitiateResponse {
  uploadId: string;
  fileId: string;
  userId: string;
  key: string;
  partSize: number;
  numParts: number;
  fileSize: number;
  parts: MultipartPart[];
}

export interface MultipartCompleteRequest {
  uploadId: string;
  key: string;
  parts: { partNumber: number; ETag: string }[];
}

export interface MultipartCompleteResponse {
  key: string;
}

export interface MultipartAbortResponse {
  message: string;
  key: string;
}

export interface DownloadResponse {
  url: string;
  filename: string;
  contentType: string;
  size: number;
  downloadCount: number;
}

export interface DeleteFileResponse {
  message: string;
  fileId: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
