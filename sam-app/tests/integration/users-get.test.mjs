import { expect } from "chai";
import { api, randomId, purgeUser } from "./helpers.mjs";

const TEST_USERS = [];
let authToken;
let existingUserId;

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

describe("Users API — Get by ID", function () {
  before(async function () {
    this.timeout(30000);
    await createUser("getuser_test");
    existingUserId = TEST_USERS[0].userId;
    const loginRes = await api("POST", "/api/auth/login", {
      email: TEST_USERS[0].email,
      password: TEST_USERS[0].password,
    });
    authToken = loginRes.body.token;
    TEST_USERS[0].tokens.push(authToken);
  });

  after(function () {
    return cleanup();
  });

  describe("GET /api/users/{userId}", function () {
    it("returns user by id", async function () {
      const res = await api("GET", `/api/users/${existingUserId}`, null, authToken);
      expect(res.status).to.equal(200);
      expect(res.body.userId).to.equal(existingUserId);
      expect(res.body.username).to.equal("getuser_test");
      expect(res.body).to.have.property("createdAt").that.is.a("string");
      expect(res.body).to.not.have.property("email");
    });

    it("returns 404 for non-existent user", async function () {
      const res = await api("GET", "/api/users/nonexistent-id", null, authToken);
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("User not found");
    });

    it("rejects without token with 401", async function () {
      const res = await api("GET", `/api/users/${existingUserId}`);
      expect(res.status).to.equal(401);
    });

    it("rejects with invalid token with 401", async function () {
      const res = await api("GET", `/api/users/${existingUserId}`, null, "bad-token");
      expect(res.status).to.equal(401);
    });
  });
});
