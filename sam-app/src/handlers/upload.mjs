import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "./middleware/auth.mjs";

const s3 = new S3Client({});
const BUCKET = process.env.FILES_BUCKET;
const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB for simple PUT
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB - use multipart above this
const MULTIPART_MAX_SIZE = 50 * 1024 * 1024 * 1024; // 50 GB max for multipart
const DEFAULT_PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum part size
const URL_TTL = 300; // 5 minutes

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

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

  return json(200, { url, fileId, userId: session.userId, key });
}

async function handleMultipartInitiate(session, filename, contentType, fileSize, partSize) {
  if (!fileSize || fileSize <= 0) {
    return json(400, { error: "Invalid fileSize" });
  }

  if (fileSize > MULTIPART_MAX_SIZE) {
    return json(400, { error: `File size exceeds maximum of ${MULTIPART_MAX_SIZE / (1024 * 1024 * 1024)} GB` });
  }

  const actualPartSize = partSize || DEFAULT_PART_SIZE;
  const numParts = Math.ceil(fileSize / actualPartSize);

  if (numParts > 10000) {
    return json(400, { error: "Too many parts (max 10000)" });
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

  return json(200, {
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
    return json(400, { error: "Missing required fields: uploadId, key, parts" });
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

  return json(200, { ok: true, key });
}

export async function lambdaHandler(event) {
  try {
    const session = await requireAuth(event);
    if (!session) return json(401, { error: "Unauthorized" });

    const path = event.path || "";
    const method = event.httpMethod;

    if (path.endsWith("/upload/initiate") && method === "POST") {
      const { filename, contentType, fileSize, partSize } = JSON.parse(event.body || "{}");
      if (!filename) return json(400, { error: "Missing filename" });
      return await handleMultipartInitiate(session, filename, contentType, fileSize, partSize);
    }

    if (path.endsWith("/upload/complete") && method === "POST") {
      const { uploadId, key, parts } = JSON.parse(event.body || "{}");
      return await handleMultipartComplete(uploadId, key, parts);
    }

    if (path.endsWith("/upload") && method === "POST") {
      const { filename, contentType } = JSON.parse(event.body || "{}");
      if (!filename) return json(400, { error: "Missing filename" });
      return await handleSimpleUpload(session, filename, contentType);
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return json(500, { error: "Internal server error" });
  }
}
