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
  const name = overrides.name || "search.txt";
  const downloadCount = overrides.download_count || 0;
  const nameLower = name.toLowerCase();
  const shard = /^[a-z0-9]/.test(nameLower[0] || "") ? nameLower[0] : "_";
  return {
    PK: `USER#${overrides.owner_user_id}`,
    SK: `FILE#${fileId}`,
    file_id: fileId,
    owner_user_id: overrides.owner_user_id,
    owner_username: overrides.owner_username || "searcher",
    name,
    name_lower: nameLower,
    size: overrides.size || 100,
    content_type: overrides.content_type || "text/plain",
    upload_date: uploadDate,
    download_count: downloadCount,
    gsidate_pk: "FILE#DATE",
    gsidate_sk: `${uploadDate}#${fileId}`,
    gsiname_pk: `NAME#FILE#${shard}`,
    gsiname_sk: `${nameLower}#${fileId}`,
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

describe("Files API — Search", function () {
  const prefix = randomId().slice(0, 6);
  const sharedPrefix = `report_${prefix}`;
  const otherPrefix = `note_${prefix}`;

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
      console.error(`[files-search cleanup] failed to delete: ${errors.join("; ")}`);
    }
  });

  describe("GET /api/files/search", function () {
    before(async function () {
      this.timeout(30000);
      await seedFile({ name: `${sharedPrefix}_a.txt`, download_count: 1 });
      await seedFile({ name: `${sharedPrefix}_b.txt`, download_count: 99 });
      await seedFile({ name: `${otherPrefix}_x.txt`, download_count: 5 });
      await sleep(1000);
    });

    it("is public and returns matching files without token", async function () {
      const res = await api("GET", `/api/files/search?q=${sharedPrefix}`);
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
      expect(res.body).to.have.property("nextToken");
      const names = res.body.files.map((f) => f.name);
      expect(names).to.have.lengthOf(2);
      expect(names).to.include(`${sharedPrefix}_a.txt`);
      expect(names).to.include(`${sharedPrefix}_b.txt`);
    });

    it("sorts matching files by download count descending", async function () {
      const res = await api("GET", `/api/files/search?q=${sharedPrefix}`);
      expect(res.status).to.equal(200);
      expect(res.body.files.map((f) => f.name)).to.deep.equal([
        `${sharedPrefix}_b.txt`,
        `${sharedPrefix}_a.txt`,
      ]);
    });

    it("excludes non-matching files", async function () {
      const res = await api("GET", `/api/files/search?q=${sharedPrefix}`);
      const names = res.body.files.map((f) => f.name);
      expect(names).to.not.include(`${otherPrefix}_x.txt`);
    });

    it("returns ownerId and ownerUsername in each item", async function () {
      const ownerId = `owner-${randomId()}`;
      await seedFile({
        name: `${sharedPrefix}_owner.txt`,
        owner_user_id: ownerId,
        owner_username: "carol",
        download_count: 50,
      });
      await sleep(1000);

      const res = await api("GET", `/api/files/search?q=${sharedPrefix}`);
      const file = res.body.files.find((f) => f.name === `${sharedPrefix}_owner.txt`);
      expect(file).to.have.all.keys(
        "fileId", "name", "size", "contentType", "uploadDate", "downloadCount", "ownerId", "ownerUsername"
      );
      expect(file.ownerId).to.equal(ownerId);
      expect(file.ownerUsername).to.equal("carol");
    });

    it("returns empty array for non-matching prefix", async function () {
      const res = await api("GET", "/api/files/search?q=zzzzzzzz");
      expect(res.status).to.equal(200);
      expect(res.body.files).to.be.an("array");
      expect(res.body.files.length).to.equal(0);
      expect(res.body.nextToken).to.be.null;
    });

    it("supports pagination with limit and nextToken", async function () {
      for (let i = 0; i < 5; i++) {
        await seedFile({
          name: `${sharedPrefix}_p${i}.txt`,
          download_count: 1000 - i,
        });
      }
      await sleep(1000);

      const page1 = await api("GET", `/api/files/search?q=${sharedPrefix}&limit=3`);
      expect(page1.status).to.equal(200);
      expect(page1.body.files.length).to.equal(3);
      expect(page1.body.nextToken).to.be.a("string");

      const page2 = await api(
        "GET",
        `/api/files/search?q=${sharedPrefix}&limit=3&nextToken=${page1.body.nextToken}`
      );
      expect(page2.status).to.equal(200);
      expect(page2.body.files.length).to.be.at.least(1);

      const combined = [...page1.body.files, ...page2.body.files];
      const allIds = combined.map((f) => f.fileId);
      expect(new Set(allIds).size).to.equal(allIds.length);

      const seen = combined.filter((f) => f.name.startsWith(`${sharedPrefix}_p`));
      expect(seen).to.have.lengthOf(5);
    });

    it("is case-insensitive", async function () {
      const res = await api("GET", `/api/files/search?q=${sharedPrefix.toUpperCase()}`);
      expect(res.status).to.equal(200);
      expect(res.body.files.length).to.be.greaterThan(0);
    });

    it("matches a single-character query", async function () {
      const res = await api("GET", `/api/files/search?q=${sharedPrefix[0]}`);
      expect(res.status).to.equal(200);
      const names = res.body.files.map((f) => f.name);
      expect(names).to.include(`${sharedPrefix}_b.txt`);
    });

    it("matches files whose name starts with an uppercase letter", async function () {
      await seedFile({ name: `Archive_${prefix}.zip`, download_count: 7 });
      await sleep(1000);
      const res = await api("GET", `/api/files/search?q=archive`);
      expect(res.status).to.equal(200);
      const names = res.body.files.map((f) => f.name);
      expect(names).to.include(`Archive_${prefix}.zip`);
    });

    it("handles names starting with non-alphanumeric characters", async function () {
      const dashName = `_backup_${prefix}.tar`;
      const dotName = `.hidden_${prefix}.env`;
      await seedFile({ name: dashName, download_count: 8 });
      await seedFile({ name: dotName, download_count: 4 });
      await sleep(1000);

      const res = await api("GET", `/api/files/search?q=_backup`);
      expect(res.status).to.equal(200);
      expect(res.body.files.map((f) => f.name)).to.include(dashName);
      expect(res.body.files.map((f) => f.name)).to.not.include(dotName);

      const dotRes = await api("GET", `/api/files/search?q=.hidden`);
      expect(dotRes.body.files.map((f) => f.name)).to.include(dotName);
    });

    it("matches single-character filenames", async function () {
      await seedFile({ name: "z", download_count: 2 });
      await sleep(1000);
      const res = await api("GET", `/api/files/search?q=z`);
      expect(res.status).to.equal(200);
      expect(res.body.files.map((f) => f.name)).to.include("z");
    });

    it("returns 400 for missing query parameter", async function () {
      const res = await api("GET", "/api/files/search");
      expect(res.status).to.equal(400);
    });

    it("returns 400 for empty query parameter", async function () {
      const res = await api("GET", "/api/files/search?q=");
      expect(res.status).to.equal(400);
    });
  });
});
