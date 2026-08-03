import { expect } from "chai";
import { api, randomId, purgeUser } from "./helpers.mjs";

const TEST_USERS = [];
let authToken;

async function createUser(username) {
  const email = `${randomId()}@test.com`;
  const password = "testpass123!";
  const res = await api("POST", "/api/auth/signup", { email, username, password });
  expect(res.status).to.equal(200);
  const loginRes = await api("POST", "/api/auth/login", { email, password });
  expect(loginRes.status).to.equal(200);
  TEST_USERS.push({
    userId: res.body.userId,
    username,
    email,
    password,
    tokens: [loginRes.body.token],
  });
  return res.body;
}

async function cleanup() {
  for (const u of TEST_USERS) {
    await purgeUser(u.userId, u.email, u.tokens);
  }
}

describe("Users API — Search", function () {
  const prefix = randomId().slice(0, 6);
  const alicePrefix = `alice_${prefix}`;
  const bobPrefix = `bob_${prefix}`;
  const aliceTestUser = `${alicePrefix}_test`;
  const aliceWorkUser = `${alicePrefix}_work`;

  before(async function () {
    this.timeout(30000);
    await createUser(aliceTestUser);
    await createUser(aliceWorkUser);
    await createUser(bobPrefix);
    const loginRes = await api("POST", "/api/auth/login", {
      email: TEST_USERS[2].email,
      password: TEST_USERS[2].password,
    });
    authToken = loginRes.body.token;
    TEST_USERS[2].tokens.push(authToken);
  });

  after(function () {
    return cleanup();
  });

  describe("GET /api/users/search", function () {
    it("returns users matching prefix", async function () {
      const res = await api("GET", `/api/users/search?q=${alicePrefix}`, null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users).to.be.an("array");
      expect(res.body.users.length).to.equal(2);
      const usernames = res.body.users.map((u) => u.username).sort();
      expect(usernames).to.deep.equal([aliceTestUser, aliceWorkUser].sort());
      for (const u of res.body.users) {
        expect(u).to.have.property("userId").that.is.a("string");
        expect(u).to.have.property("username").that.is.a("string");
      }
    });

    it("returns single user for exact match prefix", async function () {
      const res = await api("GET", `/api/users/search?q=${bobPrefix}`, null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users.length).to.equal(1);
      expect(res.body.users[0].username).to.equal(bobPrefix);
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
      const page1 = await api("GET", `/api/users/search?q=${alicePrefix}&limit=1`, null, authToken);
      expect(page1.status).to.equal(200);
      expect(page1.body.users.length).to.equal(1);
      expect(page1.body.nextToken).to.be.a("string");

      const page2 = await api(
        "GET",
        `/api/users/search?q=${alicePrefix}&limit=1&nextToken=${page1.body.nextToken}`,
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
      const res = await api("GET", `/api/users/search?q=${alicePrefix.toUpperCase()}`, null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.users.length).to.equal(2);
    });
  });
});
