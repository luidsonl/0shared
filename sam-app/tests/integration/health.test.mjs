import { expect } from "chai";
import { api } from "./helpers.mjs";

describe("Health API", () => {
  it("GET /health retorna healthy quando DynamoDB e S3 estao ok", async () => {
    const res = await api("GET", "/health");
    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal("healthy");
    expect(res.body.dynamodb).to.equal("healthy");
    expect(res.body.s3).to.equal("healthy");
  });
});
