import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { api, randomId, sleep } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const BUCKET = process.env.FILES_BUCKET || "luidsonl-0shared-files";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

describe("Upload API", () => {
  const id = randomId();
  const user = {
    email: `upload-${id}@test.com`,
    username: `upload-user-${id}`,
    password: "Test1234",
  };
  let token;
  let userId;

  before(async () => {
    await api("POST", "/api/auth/signup", user);
    const login = await api("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    token = login.body.token;
    userId = login.body.userId;
  });

  after(async () => {
    if (token) await api("POST", "/api/auth/logout", null, token);
  });

  describe("POST /api/upload", () => {
    it("returns presigned URL with valid auth", async () => {
      const res = await api("POST", "/api/upload", { filename: "test.pdf" }, token);
      expect(res.status).to.equal(200);
      expect(res.body.url).to.be.a("string");
      expect(res.body.url).to.include("X-Amz-");
      expect(res.body.fileId).to.be.a("string");
      expect(res.body.userId).to.be.a("string");
      expect(res.body.key).to.include("uploads/");
      expect(res.body.key).to.include(res.body.fileId);
      expect(res.body.key).to.include("test.pdf");
    });

    it("returns presigned URL with content type", async () => {
      const res = await api(
        "POST",
        "/api/upload",
        { filename: "image.png", contentType: "image/png" },
        token
      );
      expect(res.status).to.equal(200);
      expect(res.body.url).to.be.a("string").and.include("X-Amz-SignedHeaders");
    });

    it("sanitizes filename", async () => {
      const res = await api(
        "POST",
        "/api/upload",
        { filename: "my file (copy).pdf" },
        token
      );
      expect(res.status).to.equal(200);
      expect(res.body.key).to.include("my_file_copy_.pdf");
    });

    it("rejects without token with 401", async () => {
      const res = await api("POST", "/api/upload", { filename: "test.pdf" });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Unauthorized");
    });

    it("rejects without filename with 400", async () => {
      const res = await api("POST", "/api/upload", {}, token);
      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Missing filename");
    });

    it("truncates long filename", async () => {
      const longName = "a".repeat(300) + ".pdf";
      const res = await api("POST", "/api/upload", { filename: longName }, token);
      expect(res.status).to.equal(200);
      const filePart = res.body.key.split("/").pop();
      expect(filePart.length).to.be.at.most(255);
    });
  });

  describe("Upload complete (E2E)", () => {
    let uploadedKey;

    it("uploads to S3 and confirms object exists", async () => {
      const res = await api("POST", "/api/upload", { filename: "e2e-test.txt" }, token);
      expect(res.status).to.equal(200);
      const { url, key, fileId } = res.body;
      uploadedKey = key;

      const content = "Hello from integration test!";
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: content,
      });
      expect(putRes.status).to.equal(200);

      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      expect(head.ContentType).to.equal("text/plain");
      expect(head.ContentLength).to.equal(content.length);
    });

    it("creates DynamoDB reference after SQS processing", async () => {
      const res = await api("POST", "/api/upload", { filename: "dynamo-test.txt" }, token);
      expect(res.status).to.equal(200);
      const { url, key, fileId } = res.body;

      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "DynamoDB registration test",
      });

      let item = null;
      for (let i = 0; i < 10; i++) {
        await sleep(1000);
        const result = await dynamo.send(new GetCommand({
          TableName: TABLE,
          Key: { PK: `USER#${res.body.userId}`, SK: `FILE#${fileId}` },
        }));
        if (result.Item) { item = result.Item; break; }
      }

      expect(item).to.not.be.null;
      expect(item.file_id).to.equal(fileId);
      expect(item.owner_user_id).to.equal(res.body.userId);
      expect(item.name).to.equal("dynamo-test.txt");
      expect(item.content_type).to.equal("text/plain");
      expect(item.size).to.be.a("number");
      expect(item.download_count).to.equal(0);
    });

    after(async () => {
      if (uploadedKey) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: uploadedKey })).catch(() => {});
      }
    });
  });

  describe("Upload failure", () => {
    it("rejects invalid presigned URL", async () => {
      const fakeUrl = `https://${BUCKET}.s3.amazonaws.com/uploads/fake-key`;
      const putRes = await fetch(fakeUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "should fail",
      });
      expect(putRes.status).to.be.oneOf([403, 400]);
    });

    it("expired presigned URL rejects upload", async () => {
      const res = await api("POST", "/api/upload", { filename: "expired.txt" }, token);
      expect(res.status).to.equal(200);

      const expiredUrl = res.body.url.replace("X-Amz-Expires=300", "X-Amz-Expires=1");
      await sleep(2000);

      const putRes = await fetch(expiredUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "should fail",
      });
      expect(putRes.status).to.equal(403);
    });
  });
});
