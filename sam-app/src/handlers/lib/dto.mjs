const JSON_HEADERS = { "Content-Type": "application/json" };

export function ok(data) {
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

export function created(data) {
  return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

export function json(statusCode, data) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

export function notFound(message = "Not found") {
  return json(404, { error: message });
}

export function badRequest(message) {
  return json(400, { error: message });
}

export function unauthorized(message = "Unauthorized") {
  return json(401, { error: message });
}

export function forbidden(message) {
  return json(403, { error: message });
}

export function conflict(message) {
  return json(409, { error: message });
}

export function internalError() {
  return json(500, { error: "Internal server error" });
}

export function methodNotAllowed() {
  return json(405, { error: "Method not allowed" });
}

export function degraded(checks) {
  return json(503, { status: "degraded", timestamp: new Date().toISOString(), ...checks });
}

export function healthy(checks) {
  return ok({ status: "healthy", timestamp: new Date().toISOString(), ...checks });
}

export function signupResponse(userId, email, username) {
  return ok({ userId, email, username });
}

export function loginResponse(token, userId, email, username, expiresAt) {
  return ok({ token, userId, email, username, expiresAt });
}

export function logoutResponse() {
  return ok({ message: "Logged out" });
}

export function meResponse(userId, email, username, createdAt) {
  return ok({ userId, email, username, createdAt });
}

export function simpleUploadResponse(url, fileId, userId, key) {
  return ok({ url, fileId, userId, key });
}

export function multipartInitiateResponse({ uploadId, fileId, userId, key, partSize, numParts, fileSize, parts }) {
  return ok({ uploadId, fileId, userId, key, partSize, numParts, fileSize, parts });
}

export function multipartCompleteResponse(key) {
  return ok({ ok: true, key });
}

export function downloadResponse({ url, filename, contentType, size, downloadCount }) {
  return ok({ url, filename, contentType, size, downloadCount });
}

export function fileDeletedResponse(fileId) {
  return ok({ message: "File deleted", fileId });
}

export function userSearchResponse(users, nextToken) {
  return ok({ users, nextToken });
}

export function userResponse(userId, username, createdAt) {
  return ok({ userId, username, createdAt });
}

export function fileListResponse(files, nextToken) {
  return ok({ files, nextToken });
}

export function fileItemResponse(item) {
  return {
    fileId: item.file_id,
    name: item.name,
    size: item.size,
    contentType: item.content_type,
    uploadDate: item.upload_date,
    downloadCount: item.download_count,
  };
}

export function publicFileItemResponse(item) {
  return {
    fileId: item.file_id,
    name: item.name,
    size: item.size,
    contentType: item.content_type,
    uploadDate: item.upload_date,
    downloadCount: item.download_count,
    ownerId: item.owner_user_id,
    ownerUsername: item.owner_username,
  };
}
