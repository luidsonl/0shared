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

  describe("POST /auth/signup", () => {
    it("cria conta com dados validos", async () => {
      const res = await api("POST", "/auth/signup", user);
      expect(res.status).to.equal(200);
      expect(res.body.userId).to.be.a("string");
      expect(res.body.email).to.equal(user.email);
      expect(res.body.username).to.equal(user.username);
      userId = res.body.userId;
    });

    it("rejeita email duplicado com 409", async () => {
      const res = await api("POST", "/auth/signup", user);
      expect(res.status).to.equal(409);
      expect(res.body.error).to.equal("Email already registered");
    });

    it("rejeita senha curta com 400", async () => {
      const res = await api("POST", "/auth/signup", {
        email: `other-${id}@test.com`,
        username: `other-${id}`,
        password: "1234567",
      });
      expect(res.status).to.equal(400);
    });

    it("rejeita campos faltando com 400", async () => {
      const res = await api("POST", "/auth/signup", { email: "x@y.com" });
      expect(res.status).to.equal(400);
    });
  });

  describe("POST /auth/login", () => {
    it("retorna token com credenciais validas", async () => {
      const res = await api("POST", "/auth/login", {
        email: user.email,
        password: user.password,
      });
      expect(res.status).to.equal(200);
      expect(res.body.token).to.be.a("string");
      expect(res.body.userId).to.equal(userId);
      expect(res.body.email).to.equal(user.email);
      token = res.body.token;
    });

    it("rejeita senha errada com 401", async () => {
      const res = await api("POST", "/auth/login", {
        email: user.email,
        password: "wrongpassword",
      });
      expect(res.status).to.equal(401);
    });

    it("rejeita email inexistente com 401", async () => {
      const res = await api("POST", "/auth/login", {
        email: "nao-existe@test.com",
        password: "Test1234",
      });
      expect(res.status).to.equal(401);
    });
  });

  describe("GET /auth/me", () => {
    it("retorna perfil com token valido", async () => {
      const res = await api("GET", "/auth/me", null, token);
      expect(res.status).to.equal(200);
      expect(res.body.userId).to.equal(userId);
      expect(res.body.email).to.equal(user.email);
      expect(res.body.username).to.equal(user.username);
    });

    it("rejeita sem token com 401", async () => {
      const res = await api("GET", "/auth/me");
      expect(res.status).to.equal(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("destroi sessao ativa", async () => {
      const res = await api("POST", "/auth/logout", null, token);
      expect(res.status).to.equal(200);
    });

    it("GET /auth/me rejeita token apos logout", async () => {
      const res = await api("GET", "/auth/me", null, token);
      expect(res.status).to.equal(401);
    });
  });
});
