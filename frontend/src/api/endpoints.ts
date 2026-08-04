import { apiFetch, getToken } from "./client";
import type {
  DeleteFileResponse,
  DownloadResponse,
  FileListResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MultipartAbortResponse,
  MultipartCompleteRequest,
  MultipartCompleteResponse,
  MultipartInitiateRequest,
  MultipartInitiateResponse,
  PublicFileListResponse,
  SignupRequest,
  SignupResponse,
  SimpleUploadRequest,
  SimpleUploadResponse,
  SortBy,
  SortOrder,
  UserProfile,
} from "./types";

export async function health(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export async function signup(body: SignupRequest): Promise<SignupResponse> {
  return apiFetch<SignupResponse>("/api/auth/signup", { method: "POST", body });
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", { method: "POST", body });
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST", token: getToken() });
}

export async function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/me", { token: getToken() });
}

export interface ListFilesParams {
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  limit?: number;
  nextToken?: string | null;
}

export async function listFiles(params: ListFilesParams = {}): Promise<PublicFileListResponse> {
  const query = buildQuery(params);
  return apiFetch<PublicFileListResponse>(`/api/files${query}`, { token: getToken() });
}

export async function listUserFiles(userId: string, params: ListFilesParams = {}): Promise<FileListResponse> {
  const query = buildQuery(params);
  return apiFetch<FileListResponse>(`/api/users/${encodeURIComponent(userId)}/files${query}`, { token: getToken() });
}

export async function searchFiles(q: string, params: ListFilesParams = {}): Promise<PublicFileListResponse> {
  const query = buildQuery({ q, ...params });
  return apiFetch<PublicFileListResponse>(`/api/files/search${query}`, { token: getToken() });
}

export async function getUser(userId: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/users/${encodeURIComponent(userId)}`, { token: getToken() });
}

export async function simpleUpload(body: SimpleUploadRequest): Promise<SimpleUploadResponse> {
  return apiFetch<SimpleUploadResponse>("/api/upload", { method: "POST", body, token: getToken() });
}

export async function multipartInitiate(body: MultipartInitiateRequest): Promise<MultipartInitiateResponse> {
  return apiFetch<MultipartInitiateResponse>("/api/upload/initiate", { method: "POST", body, token: getToken() });
}

export async function multipartComplete(body: MultipartCompleteRequest): Promise<MultipartCompleteResponse> {
  return apiFetch<MultipartCompleteResponse>("/api/upload/complete", { method: "POST", body, token: getToken() });
}

export async function abortMultipartUpload(body: { uploadId: string; key: string }): Promise<MultipartAbortResponse> {
  return apiFetch<MultipartAbortResponse>("/api/upload/abort", { method: "POST", body, token: getToken() });
}

export async function download(fileId: string): Promise<DownloadResponse> {
  return apiFetch<DownloadResponse>(`/api/download/${encodeURIComponent(fileId)}`);
}

export async function deleteFile(fileId: string): Promise<DeleteFileResponse> {
  return apiFetch<DeleteFileResponse>(`/api/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    token: getToken(),
  });
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
