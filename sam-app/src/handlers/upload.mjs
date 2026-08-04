import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "./middleware/auth.mjs";
import {
  json,
  notFound,
  badRequest,
  unauthorized,
  internalError,
  simpleUploadResponse,
  multipartInitiateResponse,
  multipartCompleteResponse,
  multipartAbortResponse,
} from "./lib/dto.mjs";

const s3 = new S3Client({});
const BUCKET = process.env.FILES_BUCKET;
const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB for simple PUT
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB - use multipart above this
const MULTIPART_MAX_SIZE = 50 * 1024 * 1024 * 1024; // 50 GB max for multipart
const DEFAULT_PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum part size
// Multipart parts are presigned up-front and uploaded sequentially, so the TTL
// must cover the whole upload duration (e.g. a 50 GB file on a slow link).
// 3600 s = 1 hour; S3 allows up to 7 days.
const URL_TTL = 3600;

function sanitizeFilename(name) {
  if (!name) return "unnamed";
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 255);
}

async function generateKey(userId, filename) {
  const { randomUUID } = await import("node:crypto");
  const fileId = randomUUID();
  const sanitized = sanitizeFilename(filename);
  return {
    key: `uploads/${userId}/${fileId}/${sanitized}`,
    fileId,
  };
}

async function handleSimpleUpload(session, filename, contentType) {
  const { key, fileId } = await generateKey(session.userId, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
    ContentLengthRange: [0, MAX_SIZE],
  });

  const url = await getSignedUrl(s3, command, { expiresIn: URL_TTL });

  return simpleUploadResponse(url, fileId, session.userId, key);
}

async function handleMultipartInitiate(session, filename, contentType, fileSize, partSize) {
  if (!fileSize || fileSize <= 0) {
    return badRequest("Invalid fileSize");
  }

  if (fileSize > MULTIPART_MAX_SIZE) {
    return badRequest(`File size exceeds maximum of ${MULTIPART_MAX_SIZE / (1024 * 1024 * 1024)} GB`);
  }

  const actualPartSize = partSize || DEFAULT_PART_SIZE;
  const numParts = Math.ceil(fileSize / actualPartSize);

  if (numParts > 10000) {
    return badRequest("Too many parts (max 10000)");
  }

  const { key, fileId } = await generateKey(session.userId, filename);

  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const createResponse = await s3.send(createCommand);
  const uploadId = createResponse.UploadId;

  const parts = [];
  for (let i = 1; i <= numParts; i++) {
    const start = (i - 1) * actualPartSize;
    const end = Math.min(i * actualPartSize, fileSize);

    const uploadPartCommand = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: i,
      ContentLength: end - start,
    });

    const presignedUrl = await getSignedUrl(s3, uploadPartCommand, { expiresIn: URL_TTL });

    parts.push({
      partNumber: i,
      url: presignedUrl,
      start,
      end: end - 1,
      size: end - start,
    });
  }

  return multipartInitiateResponse({
    uploadId,
    fileId,
    userId: session.userId,
    key,
    partSize: actualPartSize,
    numParts,
    fileSize,
    parts,
  });
}

async function handleMultipartComplete(uploadId, key, parts) {
  if (!uploadId || !key || !parts || !Array.isArray(parts) || parts.length === 0) {
    return badRequest("Missing required fields: uploadId, key, parts");
  }

  const sortedParts = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({
      PartNumber: p.partNumber,
      ETag: p.ETag,
    }));

  const completeCommand = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  await s3.send(completeCommand);

  return multipartCompleteResponse(key);
}

async function handleMultipartAbort(uploadId, key) {
  if (!uploadId || !key) {
    return badRequest("Missing required fields: uploadId, key");
  }

  const abortCommand = new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
  });

  await s3.send(abortCommand);

  return multipartAbortResponse(key);
}

export async function lambdaHandler(event) {
  try {
    const session = await requireAuth(event);
    if (!session) return unauthorized();

    const path = event.path || "";
    const method = event.httpMethod;

    if (path.endsWith("/upload/initiate") && method === "POST") {
      const { filename, contentType, fileSize, partSize } = JSON.parse(event.body || "{}");
      if (!filename) return badRequest("Missing filename");
      return await handleMultipartInitiate(session, filename, contentType, fileSize, partSize);
    }

    if (path.endsWith("/upload/complete") && method === "POST") {
      const { uploadId, key, parts } = JSON.parse(event.body || "{}");
      return await handleMultipartComplete(uploadId, key, parts);
    }

    if (path.endsWith("/upload/abort") && method === "POST") {
      const { uploadId, key } = JSON.parse(event.body || "{}");
      return await handleMultipartAbort(uploadId, key);
    }

    if (path.endsWith("/upload") && method === "POST") {
      const { filename, contentType } = JSON.parse(event.body || "{}");
      if (!filename) return badRequest("Missing filename");
      return await handleSimpleUpload(session, filename, contentType);
    }

    return notFound();
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return internalError();
  }
}
