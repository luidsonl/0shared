import { expect } from "chai";
import { api } from "./helpers.mjs";

describe("Health API", () => {
  it("GET /api/health returns healthy when DynamoDB and S3 are ok", async () => {
    const res = await api("GET", "/api/health");
    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal("healthy");
    expect(res.body.dynamodb).to.equal("healthy");
    expect(res.body.s3).to.equal("healthy");
  });
});
