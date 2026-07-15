import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { api, randomId, sleep } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const BUCKET = process.env.FILES_BUCKET || "luidsonl-0shared-files";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

describe("Download API", () => {
  const id = randomId();
  const user = {
    email: `download-${id}@test.com`,
    username: `download-user-${id}`,
    password: "Test1234",
  };
  let token;
  let userId;
  let uploadedFileId;
  let uploadedKey;

  before(async () => {
    await api("POST", "/api/auth/signup", user);
    const login = await api("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    token = login.body.token;
    userId = login.body.userId;

    const uploadRes = await api("POST", "/api/upload", { filename: "download-test.txt" }, token);
    uploadedFileId = uploadRes.body.fileId;
    uploadedKey = uploadRes.body.key;

    await fetch(uploadRes.body.url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "Download test content",
    });

    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `FILE#${uploadedFileId}` },
      }));
      if (result.Item) break;
    }
  });

  after(async () => {
    if (token) await api("POST", "/api/auth/logout", null, token);
    if (uploadedKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: uploadedKey })).catch(() => {});
    }
  });

  describe("GET /api/download/{fileId}", () => {
    it("returns presigned URL for existing file", async () => {
      const res = await api("GET", `/api/download/${uploadedFileId}`);
      expect(res.status).to.equal(200);
      expect(res.body.url).to.be.a("string");
      expect(res.body.url).to.include("X-Amz-");
      expect(res.body.filename).to.equal("download-test.txt");
      expect(res.body.contentType).to.equal("text/plain");
      expect(res.body.size).to.be.a("number");
      expect(res.body.downloadCount).to.be.a("number");
    });

    it("returns 404 for non-existent file", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await api("GET", `/api/download/${fakeId}`);
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("File not found");
    });

    it("presigned URL allows S3 download", async () => {
      const res = await api("GET", `/api/download/${uploadedFileId}`);
      expect(res.status).to.equal(200);

      const getRes = await fetch(res.body.url);
      expect(getRes.status).to.equal(200);
      const content = await getRes.text();
      expect(content).to.equal("Download test content");
    });

    it("increments download_count after SQS processing", async () => {
      const res = await api("GET", `/api/download/${uploadedFileId}`);
      expect(res.status).to.equal(200);
      const initialCount = res.body.downloadCount;

      await sleep(3000);

      const item = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `FILE#${uploadedFileId}` },
      }));
      expect(item.Item.download_count).to.be.greaterThan(initialCount);
    });
  });
});
