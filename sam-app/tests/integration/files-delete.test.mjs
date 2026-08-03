import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { api, randomId, purgeUser } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const BUCKET = process.env.FILES_BUCKET || "luidsonl-0shared-files";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Creates a file entity directly in DynamoDB and uploads to S3.
 * Works with both sam local (API) and real AWS (S3 + DynamoDB).
 */
async function createTestFile(token, userId, filename) {
  const uploadRes = await api("POST", "/api/upload", { filename }, token);
  expect(uploadRes.status).to.equal(200);
  const { url, key, fileId } = uploadRes.body;

  const content = `test-content-${filename}`;
  const putRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: content,
  });
  expect(putRes.status).to.equal(200);

  const now = new Date().toISOString();
  const shard = fileId.slice(0, 2);

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `FILE#${fileId}`,
      file_id: fileId,
      owner_user_id: userId,
      owner_username: "test-user",
      name: filename,
      name_lower: filename.toLowerCase(),
      size: content.length,
      content_type: "text/plain",
      upload_date: now,
      download_count: 0,
      gsiname_pk: `NAME#FILE#${shard}`,
      gsiname_sk: `${filename.toLowerCase()}#${fileId}`,
      gsidate_pk: "FILE#DATE",
      gsidate_sk: `${now}#${fileId}`,
      gsidown_pk: "FILE#DOWN",
      gsidown_sk: `0000000000#${fileId}`,
    },
  }));

  return { fileId, key, content };
}

async function fileExists(userId, fileId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FILE#${fileId}` },
  }));
  return result.Item;
}

async function s3ObjectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (err.name === "NotFound") return false;
    throw err;
  }
}

describe("Files API — DELETE", () => {
  const id = randomId();
  const owner = {
    email: `file-owner-${id}@test.com`,
    username: `file-owner-${id}`,
    password: "Test1234",
  };
  const other = {
    email: `file-other-${id}@test.com`,
    username: `file-other-${id}`,
    password: "Test1234",
  };
  let ownerToken, ownerUserId;
  let otherToken, otherUserId;

  before(async () => {
    await api("POST", "/api/auth/signup", owner);
    const loginOwner = await api("POST", "/api/auth/login", {
      email: owner.email,
      password: owner.password,
    });
    ownerToken = loginOwner.body.token;
    ownerUserId = loginOwner.body.userId;

    await api("POST", "/api/auth/signup", other);
    const loginOther = await api("POST", "/api/auth/login", {
      email: other.email,
      password: other.password,
    });
    otherToken = loginOther.body.token;
    otherUserId = loginOther.body.userId;
  });

  after(async () => {
    if (ownerToken) await api("POST", "/api/auth/logout", null, ownerToken);
    if (otherToken) await api("POST", "/api/auth/logout", null, otherToken);
    await purgeUser(ownerUserId, owner.email, [ownerToken]);
    await purgeUser(otherUserId, other.email, [otherToken]);
  });

  describe("DELETE /api/files/{fileId}", () => {
    let fileIdToDelete;
    let keyToDelete;

    before(async () => {
      const file = await createTestFile(ownerToken, ownerUserId, "delete-me.txt");
      fileIdToDelete = file.fileId;
      keyToDelete = file.key;
    });

    it("deletes file owned by authenticated user", async () => {
      const res = await api("DELETE", `/api/files/${fileIdToDelete}`, null, ownerToken);
      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal("File deleted");
      expect(res.body.fileId).to.equal(fileIdToDelete);
    });

    it("S3 object is removed", async () => {
      const exists = await s3ObjectExists(keyToDelete);
      expect(exists).to.equal(false);
    });

    it("DynamoDB entity is removed", async () => {
      const item = await fileExists(ownerUserId, fileIdToDelete);
      expect(item).to.be.undefined;
    });

    it("returns 404 for download after deletion", async () => {
      const res = await api("GET", `/api/download/${fileIdToDelete}`);
      expect(res.status).to.equal(404);
    });
  });

  describe("Authentication", () => {
    let fileId;

    before(async () => {
      const file = await createTestFile(ownerToken, ownerUserId, "auth-test.txt");
      fileId = file.fileId;
    });

    it("rejects without token with 401", async () => {
      const res = await api("DELETE", `/api/files/${fileId}`);
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Unauthorized");
    });

    it("rejects with invalid token with 401", async () => {
      const res = await api("DELETE", `/api/files/${fileId}`, null, "invalid-token");
      expect(res.status).to.equal(401);
    });

    after(async () => {
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: `uploads/${ownerUserId}/${fileId}/auth-test.txt`,
      })).catch(() => {});
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${ownerUserId}`, SK: `FILE#${fileId}` },
      })).catch(() => {});
    });
  });

  describe("Authorization", () => {
    let ownerFileId;
    let ownerFileKey;

    before(async () => {
      const file = await createTestFile(ownerToken, ownerUserId, "owner-file.txt");
      ownerFileId = file.fileId;
      ownerFileKey = file.key;
    });

    it("rejects deletion by non-owner with 403", async () => {
      const res = await api("DELETE", `/api/files/${ownerFileId}`, null, otherToken);
      expect(res.status).to.equal(403);
      expect(res.body.error).to.equal("Not authorized to delete this file");
    });

    it("owner file still exists after rejected attempt", async () => {
      const item = await fileExists(ownerUserId, ownerFileId);
      expect(item).to.not.be.undefined;
      expect(item.file_id).to.equal(ownerFileId);
    });

    after(async () => {
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET, Key: ownerFileKey,
      })).catch(() => {});
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${ownerUserId}`, SK: `FILE#${ownerFileId}` },
      })).catch(() => {});
    });
  });

  describe("Not found", () => {
    it("returns 404 for non-existent fileId", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await api("DELETE", `/api/files/${fakeId}`, null, ownerToken);
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("File not found");
    });
  });
});
