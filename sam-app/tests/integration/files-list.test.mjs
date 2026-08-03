import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { api, randomId, sleep } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SEEDED_KEYS = [];

function makeFileItem(overrides = {}) {
  const fileId = overrides.file_id || randomId();
  const uploadDate = overrides.upload_date || new Date().toISOString();
  const name = overrides.name || "browse.txt";
  const downloadCount = overrides.download_count || 0;
  return {
    PK: `USER#${overrides.owner_user_id}`,
    SK: `FILE#${fileId}`,
    file_id: fileId,
    owner_user_id: overrides.owner_user_id,
    owner_username: overrides.owner_username || "browser",
    name,
    name_lower: name.toLowerCase(),
    size: overrides.size || 100,
    content_type: overrides.content_type || "text/plain",
    upload_date: uploadDate,
    download_count: downloadCount,
    gsidate_pk: "FILE#DATE",
    gsidate_sk: `${uploadDate}#${fileId}`,
    gsiname_pk: `NAME#FILE#${fileId.slice(0, 2).toLowerCase()}`,
    gsiname_sk: `${name.toLowerCase()}#${fileId}`,
    gsidown_pk: "FILE#DOWN",
    gsidown_sk: `${String(downloadCount).padStart(10, "0")}#${fileId}`,
  };
}

async function seedFile(overrides = {}) {
  const item = makeFileItem(overrides);
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  SEEDED_KEYS.push({ PK: item.PK, SK: item.SK });
  return item;
}

async function waitForFiles(fileIds, sortBy = "downloadCount", limit = 100) {
  let files = [];
  for (let i = 0; i < 15; i++) {
    const res = await api("GET", `/api/files?sortBy=${sortBy}&limit=${limit}`);
    files = res.body.files.filter((f) => fileIds.includes(f.fileId));
    if (files.length === fileIds.length) return files;
    await sleep(1000);
  }
  return files;
}

async function findInOrder(fileIds, sortBy, sortOrder) {
  let nextToken = null;
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ sortBy, sortOrder, limit: "100" });
    if (nextToken) query.set("nextToken", nextToken);
    const res = await api("GET", `/api/files?${query}`);
    const matched = res.body.files.filter((f) => fileIds.includes(f.fileId));
    if (matched.length === fileIds.length) return matched;
    if (!res.body.nextToken) return matched;
    nextToken = res.body.nextToken;
  }
  return [];
}

describe("Files API — List all files", function () {
  after(async function () {
    this.timeout(30000);
    const errors = [];
    for (const key of SEEDED_KEYS) {
      try {
        await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: key }));
      } catch (err) {
        errors.push(`${key.PK}#${key.SK}: ${err.message}`);
      }
    }
    if (errors.length) {
      console.error(`[files-list cleanup] failed to delete: ${errors.join("; ")}`);
    }
  });

  describe("GET /api/files", function () {
    it("is public and returns a files array without token", async function () {
      const res = await api("GET", "/api/files");
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
      expect(res.body).to.have.property("nextToken");
    });

    it("returns files sorted by download count descending by default", async function () {
      const ownerId = `owner-${randomId()}`;
      const seeds = [
        { name: "popular.txt", download_count: 99 },
        { name: "regular.txt", download_count: 50 },
        { name: "rare.txt", download_count: 1 },
      ];
      const ids = [];
      for (const s of seeds) {
        const item = await seedFile({ owner_user_id: ownerId, name: s.name, download_count: s.download_count });
        ids.push(item.file_id);
      }

      const matched = await waitForFiles(ids, "downloadCount");
      expect(matched.length).to.equal(3);
      expect(matched.map((f) => f.name)).to.deep.equal(["popular.txt", "regular.txt", "rare.txt"]);
    });

    it("sorts by upload date descending (newest first)", async function () {
      const ownerId = `owner-${randomId()}`;
      const base = Date.now() + 60000;
      const dates = [
        new Date(base + 2000).toISOString(),
        new Date(base).toISOString(),
        new Date(base + 1000).toISOString(),
      ];
      const ids = [];
      for (let i = 0; i < dates.length; i++) {
        const item = await seedFile({
          owner_user_id: ownerId,
          name: `date-${i}.txt`,
          upload_date: dates[i],
        });
        ids.push(item.file_id);
      }

      const matched = await waitForFiles(ids, "uploadDate");
      expect(matched.length).to.equal(3);
      expect(matched.map((f) => f.uploadDate)).to.deep.equal([dates[0], dates[2], dates[1]]);
    });

    it("sorts by upload date ascending (oldest first)", async function () {
      const ownerId = `owner-${randomId()}`;
      const base = Date.now() + 60000;
      const dates = [
        new Date(base + 2000).toISOString(),
        new Date(base).toISOString(),
        new Date(base + 1000).toISOString(),
      ];
      const ids = [];
      for (let i = 0; i < dates.length; i++) {
        const item = await seedFile({
          owner_user_id: ownerId,
          name: `asc-${i}.txt`,
          upload_date: dates[i],
        });
        ids.push(item.file_id);
      }

      const matched = await findInOrder(ids, "uploadDate", "asc");
      expect(matched.length).to.equal(3);
      expect(matched.map((f) => f.uploadDate)).to.deep.equal([dates[1], dates[2], dates[0]]);
    });

    it("supports pagination with limit and nextToken", async function () {
      const ownerId = `owner-${randomId()}`;
      const seeds = [
        { name: "page-high.txt", download_count: 9999999999 },
        { name: "page-mid.txt", download_count: 9999999998 },
        { name: "page-low.txt", download_count: 9999999997 },
      ];
      const ids = [];
      for (const s of seeds) {
        const item = await seedFile({ owner_user_id: ownerId, name: s.name, download_count: s.download_count });
        ids.push(item.file_id);
      }

      await waitForFiles(ids, "downloadCount");

      const page1 = await api("GET", "/api/files?sortBy=downloadCount&limit=2");
      expect(page1.status).to.equal(200);
      expect(page1.body.files.length).to.equal(2);
      expect(page1.body.nextToken).to.be.a("string");

      const page2 = await api(
        "GET",
        `/api/files?sortBy=downloadCount&limit=10&nextToken=${page1.body.nextToken}`
      );
      expect(page2.status).to.equal(200);
      expect(page2.body.files).to.have.lengthOf.at.least(1);

      const combined = [...page1.body.files, ...page2.body.files];

      const seen = combined.filter((f) => ids.includes(f.fileId));
      expect(seen).to.have.lengthOf(3);
      expect(seen.map((f) => f.name)).to.deep.equal(["page-high.txt", "page-mid.txt", "page-low.txt"]);

      const allIds = combined.map((f) => f.fileId);
      expect(new Set(allIds).size).to.equal(allIds.length);
    });

    it("respects limit between 1 and 100", async function () {
      const res0 = await api("GET", "/api/files?limit=0");
      expect(res0.status).to.equal(200);
      expect(res0.body.files.length).to.be.at.most(20);

      const res200 = await api("GET", "/api/files?limit=200");
      expect(res200.status).to.equal(200);
      expect(res200.body.files.length).to.be.at.most(100);
    });

    it("defaults to downloadCount for invalid sortBy", async function () {
      const res = await api("GET", "/api/files?sortBy=invalid&limit=100");
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
    });

    it("defaults to desc for invalid sortOrder", async function () {
      const res = await api("GET", "/api/files?sortOrder=invalid&limit=100");
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
    });

    it("returns ownerId and ownerUsername in each item", async function () {
      const ownerId = `owner-${randomId()}`;
      const item = await seedFile({ owner_user_id: ownerId, owner_username: "alice", name: "shape.txt" });

      const matched = await waitForFiles([item.file_id], "downloadCount");
      expect(matched.length).to.equal(1);
      const file = matched[0];
      expect(file).to.have.all.keys(
        "fileId", "name", "size", "contentType", "uploadDate", "downloadCount", "ownerId", "ownerUsername"
      );
      expect(file.ownerId).to.equal(ownerId);
      expect(file.ownerUsername).to.equal("alice");
      expect(file.name).to.equal("shape.txt");
    });
  });
});
