import { expect } from "chai";
import { api, randomId } from "./helpers.mjs";

describe("Upload API", () => {
  const id = randomId();
  const user = {
    email: `upload-${id}@test.com`,
    username: `upload-user-${id}`,
    password: "Test1234",
  };
  let token;

  before(async () => {
    await api("POST", "/api/auth/signup", user);
    const login = await api("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    token = login.body.token;
  });

  after(async () => {
    if (token) await api("POST", "/api/auth/logout", null, token);
  });

  describe("POST /api/upload", () => {
    it("retorna presigned URL com auth valida", async () => {
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

    it("retorna presigned URL com content type", async () => {
      const res = await api(
        "POST",
        "/api/upload",
        { filename: "image.png", contentType: "image/png" },
        token
      );
      expect(res.status).to.equal(200);
      expect(res.body.url).to.be.a("string").and.include("X-Amz-SignedHeaders");
    });

    it("sanitiza nome do arquivo", async () => {
      const res = await api(
        "POST",
        "/api/upload",
        { filename: "my file (copy).pdf" },
        token
      );
      expect(res.status).to.equal(200);
      expect(res.body.key).to.include("my_file_copy_.pdf");
    });

    it("rejeita sem token com 401", async () => {
      const res = await api("POST", "/api/upload", { filename: "test.pdf" });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Unauthorized");
    });

    it("rejeita sem filename com 400", async () => {
      const res = await api("POST", "/api/upload", {}, token);
      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Missing filename");
    });

    it("trunca filename longo", async () => {
      const longName = "a".repeat(300) + ".pdf";
      const res = await api("POST", "/api/upload", { filename: longName }, token);
      expect(res.status).to.equal(200);
      const filePart = res.body.key.split("/").pop();
      expect(filePart.length).to.be.at.most(255);
    });
  });
});
