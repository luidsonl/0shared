import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "./middleware/auth.mjs";

const s3 = new S3Client({});
const BUCKET = process.env.FILES_BUCKET;
const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB
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

export async function lambdaHandler(event) {
  try {
    const session = await requireAuth(event);
    if (!session) return json(401, { error: "Unauthorized" });

    const { filename, contentType } = JSON.parse(event.body || "{}");
    if (!filename) return json(400, { error: "Missing filename" });

    const { randomUUID } = await import("node:crypto");
    const fileId = randomUUID();
    const sanitized = sanitizeFilename(filename);
    const key = `uploads/${session.userId}/${fileId}/${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      ContentLengthRange: [0, MAX_SIZE],
    });

    const url = await getSignedUrl(s3, command, { expiresIn: URL_TTL });

    return json(200, { url, fileId, userId: session.userId, key });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return json(500, { error: "Internal server error" });
  }
}
