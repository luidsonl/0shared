import { expect } from "chai";
import { api, randomId } from "./helpers.mjs";

describe("Auth API", () => {
  const id = randomId();
  const user = {
    email: `test-${id}@test.com`,
    username: `user-${id}`,
    password: "Test1234",
  };
  let token;
  let userId;

  describe("POST /api/auth/signup", () => {
    it("creates account with valid data", async () => {
      const res = await api("POST", "/api/auth/signup", user);
      expect(res.status).to.equal(200);
      expect(res.body.userId).to.be.a("string");
      expect(res.body.email).to.equal(user.email);
      expect(res.body.username).to.equal(user.username);
      userId = res.body.userId;
    });

    it("rejects duplicate email with 409", async () => {
      const res = await api("POST", "/api/auth/signup", user);
      expect(res.status).to.equal(409);
      expect(res.body.error).to.equal("Email already registered");
    });

    it("rejects short password with 400", async () => {
      const res = await api("POST", "/api/auth/signup", {
        email: `other-${id}@test.com`,
        username: `other-${id}`,
        password: "1234567",
      });
      expect(res.status).to.equal(400);
    });

    it("rejects missing fields with 400", async () => {
      const res = await api("POST", "/api/auth/signup", { email: "x@y.com" });
      expect(res.status).to.equal(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns token with valid credentials", async () => {
      const res = await api("POST", "/api/auth/login", {
        email: user.email,
        password: user.password,
      });
      expect(res.status).to.equal(200);
      expect(res.body.token).to.be.a("string");
      expect(res.body.userId).to.equal(userId);
      expect(res.body.email).to.equal(user.email);
      token = res.body.token;
    });

    it("rejects wrong password with 401", async () => {
      const res = await api("POST", "/api/auth/login", {
        email: user.email,
        password: "wrongpassword",
      });
      expect(res.status).to.equal(401);
    });

    it("rejects non-existent email with 401", async () => {
      const res = await api("POST", "/api/auth/login", {
        email: "nao-existe@test.com",
        password: "Test1234",
      });
      expect(res.status).to.equal(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns profile with valid token", async () => {
      const res = await api("GET", "/api/auth/me", null, token);
      expect(res.status).to.equal(200);
      expect(res.body.userId).to.equal(userId);
      expect(res.body.email).to.equal(user.email);
      expect(res.body.username).to.equal(user.username);
    });

    it("rejects without token with 401", async () => {
      const res = await api("GET", "/api/auth/me");
      expect(res.status).to.equal(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("destroys active session", async () => {
      const res = await api("POST", "/api/auth/logout", null, token);
      expect(res.status).to.equal(200);
    });

    it("GET /api/auth/me rejects token after logout", async () => {
      const res = await api("GET", "/api/auth/me", null, token);
      expect(res.status).to.equal(401);
    });
  });
});
