import { expect } from "chai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { api, randomId } from "./helpers.mjs";

const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TEST_USERS = [];
let authToken;

async function createUser(username) {
  const email = `${randomId()}@test.com`;
  const password = "testpass123!";
  const res = await api("POST", "/api/auth/signup", { email, username, password });
  expect(res.status).to.equal(200);
  const loginRes = await api("POST", "/api/auth/login", { email, password });
  expect(loginRes.status).to.equal(200);
  TEST_USERS.push({ userId: res.body.userId, username, email, password });
  return res.body;
}

async function cleanup() {
  for (const u of TEST_USERS) {
    await dynamo.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `USER#${u.userId}`, SK: "PROFILE" },
    }));
    await dynamo.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `EMAIL#${u.email}`, SK: "METADATA" },
    })).catch(() => {});
  }
}

describe("Users API — Search", function () {
  before(async function () {
    this.timeout(30000);
    await createUser("alice_test");
    await createUser("alice_work");
    const bob = await createUser("bob_test");
    const loginRes = await api("POST", "/api/auth/login", {
      email: TEST_USERS[2].email,
      password: TEST_USERS[2].password,
    });
    authToken = loginRes.body.token;
  });

  after(function () {
    return cleanup();
  });

  describe("GET /api/users/search", function () {
    it("returns users matching prefix", async function () {
      const res = await api("GET", "/api/users/search?q=alice_", null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users).to.be.an("array");
      expect(res.body.users.length).to.equal(2);
      const usernames = res.body.users.map((u) => u.username).sort();
      expect(usernames).to.deep.equal(["alice_test", "alice_work"]);
      for (const u of res.body.users) {
        expect(u).to.have.property("userId").that.is.a("string");
        expect(u).to.have.property("username").that.is.a("string");
      }
    });

    it("returns single user for exact match prefix", async function () {
      const res = await api("GET", "/api/users/search?q=bob_", null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users.length).to.equal(1);
      expect(res.body.users[0].username).to.equal("bob_test");
      expect(res.body.users[0]).to.have.property("userId").that.is.a("string");
    });

    it("returns empty array for non-matching prefix", async function () {
      const res = await api("GET", "/api/users/search?q=zzz_", null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users).to.be.an("array");
      expect(res.body.users.length).to.equal(0);
      expect(res.body.nextToken).to.be.null;
    });

    it("supports pagination with limit and nextToken", async function () {
      const page1 = await api("GET", "/api/users/search?q=alice_&limit=1", null, authToken);
      expect(page1.status).to.equal(200);
      expect(page1.body.users.length).to.equal(1);
      expect(page1.body.nextToken).to.be.a("string");

      const page2 = await api(
        "GET",
        `/api/users/search?q=alice_&limit=1&nextToken=${page1.body.nextToken}`,
        null,
        authToken
      );
      expect(page2.status).to.equal(200);
      expect(page2.body.users.length).to.equal(1);
      expect(page2.body.nextToken).to.be.null;
      expect(page2.body.users[0].username).to.not.equal(
        page1.body.users[0].username
      );
    });

    it("returns 400 for missing query parameter", async function () {
      const res = await api("GET", "/api/users/search", null, authToken);
      expect(res.status).to.equal(400);
    });

    it("returns 400 for empty query parameter", async function () {
      const res = await api("GET", "/api/users/search?q=", null, authToken);
      expect(res.status).to.equal(400);
    });

    it("rejects without token with 401", async function () {
      const res = await api("GET", "/api/users/search?q=alice_");
      expect(res.status).to.equal(401);
    });

    it("rejects with invalid token with 401", async function () {
      const res = await api("GET", "/api/users/search?q=alice_", null, "bad-token");
      expect(res.status).to.equal(401);
    });

    it("is case-insensitive", async function () {
      const res = await api("GET", "/api/users/search?q=ALICE_", null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users.length).to.equal(2);
    });
  });
});
