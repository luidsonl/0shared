import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { api, randomId, sleep } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const BUCKET = process.env.FILES_BUCKET || "luidsonl-0shared-files";
const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TEST_USERS = [];

async function createUser(username) {
  const email = `${randomId()}@test.com`;
  const password = "testpass123!";
  const res = await api("POST", "/api/auth/signup", { email, username, password });
  expect(res.status).to.equal(200);
  const loginRes = await api("POST", "/api/auth/login", { email, password });
  expect(loginRes.status).to.equal(200);
  TEST_USERS.push({ userId: res.body.userId, username, email, password, token: loginRes.body.token });
  return res.body;
}

async function uploadFile(userId, token, filename, content) {
  const res = await api("POST", "/api/upload", { filename, contentType: "text/plain" }, token);
  expect(res.status).to.equal(200);
  const putRes = await fetch(res.body.url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: content });
  expect(putRes.status).to.equal(200);

  let item = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const result = await dynamo.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `FILE#${res.body.fileId}` },
    }));
    if (result.Item) { item = result.Item; break; }
  }
  expect(item).to.not.be.null;
  return item;
}

function makeFileItem(userId, overrides = {}) {
  const fileId = overrides.file_id || randomId();
  const uploadDate = overrides.upload_date || new Date().toISOString();
  return {
    PK: `USER#${userId}`,
    SK: `FILE#${fileId}`,
    file_id: fileId,
    owner_user_id: userId,
    owner_username: overrides.owner_username || "testuser",
    name: overrides.name || "test.txt",
    name_lower: (overrides.name || "test.txt").toLowerCase(),
    size: overrides.size || 100,
    content_type: overrides.content_type || "text/plain",
    upload_date: uploadDate,
    download_count: overrides.download_count || 0,
    gsidate_pk: "FILE#DATE",
    gsidate_sk: `${uploadDate}#${fileId}`,
    gsidown_pk: "FILE#DOWN",
    gsidown_sk: `${String(overrides.download_count || 0).padStart(10, "0")}#${fileId}`,
  };
}

describe("Users API — List files", function () {
  let userA, tokenA, userIdA;
  let userB, tokenB, userIdB;
  let userC, tokenC, userIdC;

  before(async function () {
    this.timeout(60000);
    userA = await createUser("listfiles_a_" + randomId().slice(0, 4));
    userIdA = userA.userId;
    tokenA = TEST_USERS[0].token;

    userB = await createUser("listfiles_b_" + randomId().slice(0, 4));
    userIdB = userB.userId;
    tokenB = TEST_USERS[1].token;

    userC = await createUser("listfiles_c_" + randomId().slice(0, 4));
    userIdC = userC.userId;
    tokenC = TEST_USERS[2].token;
  });

  after(async function () {
    this.timeout(30000);
    for (const u of TEST_USERS) {
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${u.userId}`, SK: "PROFILE" },
      })).catch(() => {});
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `EMAIL#${u.email}`, SK: "METADATA" },
      })).catch(() => {});
    }
  });

  describe("GET /api/users/{userId}/files", function () {
    it("returns empty list for user with no files", async function () {
      const res = await api("GET", `/api/users/${userIdA}/files`, null, tokenA);
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
      expect(res.body.files.length).to.equal(0);
      expect(res.body.nextToken).to.be.null;
    });

    it("returns files after upload via real API", async function () {
      this.timeout(30000);
      const file = await uploadFile(userIdA, tokenA, "list-test.txt", "file list test content");
      const res = await api("GET", `/api/users/${userIdA}/files`, null, tokenA);
      expect(res.status).to.equal(200);
      expect(res.body.files.length).to.be.at.least(1);
      const found = res.body.files.find(f => f.fileId === file.file_id);
      expect(found).to.not.be.undefined;
      expect(found.name).to.equal("list-test.txt");
      expect(found.size).to.equal("file list test content".length);
      expect(found.contentType).to.equal("text/plain");
      expect(found.downloadCount).to.be.a("number");
      expect(found.uploadDate).to.be.a("string");
    });

    it("returns correct file shape for each entry", async function () {
      this.timeout(30000);
      await uploadFile(userIdA, tokenA, "shape-test.txt", "shape check");

      const res = await api("GET", `/api/users/${userIdA}/files`, null, tokenA);
      expect(res.status).to.equal(200);

      for (const file of res.body.files) {
        expect(file).to.have.all.keys(
          "fileId", "name", "size", "contentType", "uploadDate", "downloadCount"
        );
        expect(file.fileId).to.be.a("string");
        expect(file.name).to.be.a("string");
        expect(file.size).to.be.a("number");
        expect(file.contentType).to.be.a("string");
        expect(file.uploadDate).to.be.a("string");
        expect(file.downloadCount).to.be.a("number");
      }
    });

    it("supports pagination with limit and nextToken", async function () {
      const itemIds = [];
      const baseTime = Date.now();
      for (let i = 0; i < 3; i++) {
        const fileId = randomId();
        const item = makeFileItem(userIdC, {
          file_id: fileId,
          name: `paginate-${i}.txt`,
          upload_date: new Date(baseTime + i * 1000).toISOString(),
        });
        await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
        itemIds.push(fileId);
      }

      const page1 = await api(
        "GET",
        `/api/users/${userIdC}/files?limit=2`,
        null,
        tokenC
      );
      expect(page1.status).to.equal(200);
      expect(page1.body.files.length).to.equal(2);
      expect(page1.body.nextToken).to.be.a("string");

      const page2 = await api(
        "GET",
        `/api/users/${userIdC}/files?limit=10&nextToken=${page1.body.nextToken}`,
        null,
        tokenC
      );
      expect(page2.status).to.equal(200);
      expect(page2.body.files).to.have.lengthOf(1);
      expect(page2.body.nextToken).to.be.null;

      const allIds = [...page1.body.files.map(f => f.fileId), ...page2.body.files.map(f => f.fileId)];
      for (const id of itemIds) {
        expect(allIds).to.include(id);
      }
    });

    it("returns files newest first", async function () {
      const dates = [
        new Date("2024-01-03").toISOString(),
        new Date("2024-01-01").toISOString(),
        new Date("2024-01-02").toISOString(),
      ];
      const fileIds = [];
      for (let i = 0; i < dates.length; i++) {
        const fileId = randomId();
        const item = makeFileItem(userIdC, {
          file_id: fileId,
          name: `sort-${i}.txt`,
          upload_date: dates[i],
        });
        await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
        fileIds.push(fileId);
      }

      const res = await api("GET", `/api/users/${userIdC}/files?limit=10`, null, tokenC);
      expect(res.status).to.equal(200);

      const matched = res.body.files.filter(f => fileIds.includes(f.fileId));
      expect(matched.length).to.equal(3);
      expect(matched[0].uploadDate).to.equal(dates[0]);
      expect(matched[1].uploadDate).to.equal(dates[2]);
      expect(matched[2].uploadDate).to.equal(dates[1]);
    });

    it("does not include other users' files", async function () {
      this.timeout(30000);
      await uploadFile(userIdB, tokenB, "other-user.txt", "this belongs to B");

      const resA = await api("GET", `/api/users/${userIdA}/files?limit=100`, null, tokenA);
      expect(resA.status).to.equal(200);
      for (const f of resA.body.files) {
        expect(f.name).to.not.equal("other-user.txt");
      }

      const resB = await api("GET", `/api/users/${userIdB}/files?limit=100`, null, tokenB);
      expect(resB.status).to.equal(200);
      const found = resB.body.files.find(f => f.name === "other-user.txt");
      expect(found).to.not.be.undefined;
    });

    it("rejects without token with 401", async function () {
      const res = await api("GET", `/api/users/${userIdA}/files`);
      expect(res.status).to.equal(401);
    });

    it("rejects with invalid token with 401", async function () {
      const res = await api("GET", `/api/users/${userIdA}/files`, null, "bad-token");
      expect(res.status).to.equal(401);
    });

    it("respects limit between 1 and 100", async function () {
      const res0 = await api(
        "GET",
        `/api/users/${userIdA}/files?limit=0`,
        null,
        tokenA
      );
      expect(res0.status).to.equal(200);
      expect(res0.body.files.length).to.be.at.most(20);

      const res200 = await api(
        "GET",
        `/api/users/${userIdA}/files?limit=200`,
        null,
        tokenA
      );
      expect(res200.status).to.equal(200);
      expect(res200.body.files.length).to.be.at.most(100);
    });

    it("sorts by name ascending", async function () {
      const names = ["gamma.txt", "alpha.txt", "beta.txt"];
      for (const n of names) {
        await dynamo.send(new PutCommand({
          TableName: TABLE,
          Item: makeFileItem(userIdC, { file_id: randomId(), name: n, upload_date: new Date().toISOString() }),
        }));
      }

      const res = await api(
        "GET",
        `/api/users/${userIdC}/files?sortBy=name&sortOrder=asc&limit=50`,
        null,
        tokenC
      );
      expect(res.status).to.equal(200);
      const matched = res.body.files.filter(f => names.includes(f.name));
      expect(matched.length).to.equal(3);
      expect(matched[0].name).to.equal("alpha.txt");
      expect(matched[1].name).to.equal("beta.txt");
      expect(matched[2].name).to.equal("gamma.txt");
    });

    it("sorts by download count descending", async function () {
      const seeds = [
        { name: "low.txt", download_count: 1 },
        { name: "high.txt", download_count: 99 },
        { name: "mid.txt", download_count: 50 },
      ];
      for (const s of seeds) {
        await dynamo.send(new PutCommand({
          TableName: TABLE,
          Item: makeFileItem(userIdC, {
            file_id: randomId(), name: s.name, download_count: s.download_count, upload_date: new Date().toISOString(),
          }),
        }));
      }

      const res = await api(
        "GET",
        `/api/users/${userIdC}/files?sortBy=downloadCount&sortOrder=desc&limit=50`,
        null,
        tokenC
      );
      expect(res.status).to.equal(200);
      const matched = res.body.files.filter(f => seeds.map(s => s.name).includes(f.name));
      expect(matched.length).to.equal(3);
      expect(matched[0].name).to.equal("high.txt");
      expect(matched[1].name).to.equal("mid.txt");
      expect(matched[2].name).to.equal("low.txt");
    });

    it("defaults to uploadDate desc for invalid sortBy", async function () {
      const res = await api(
        "GET",
        `/api/users/${userIdA}/files?sortBy=invalid`,
        null,
        tokenA
      );
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
    });

    it("defaults to desc for invalid sortOrder", async function () {
      const res = await api(
        "GET",
        `/api/users/${userIdA}/files?sortOrder=invalid`,
        null,
        tokenA
      );
      expect(res.status).to.equal(200);
    });
  });
});
