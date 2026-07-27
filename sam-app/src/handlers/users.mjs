import { requireAuth } from "./middleware/auth.mjs";
import * as db from "./lib/dynamo-client.mjs";

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export async function lambdaHandler(event) {
  try {
    if (event.httpMethod === "GET" && event.path === "/api/users/search") {
      return handleSearch(event);
    }
    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return json(500, { error: "Internal server error" });
  }
}

async function handleSearch(event) {
  const session = await requireAuth(event);
  if (!session) return json(401, { error: "Unauthorized" });

  const params = event.queryStringParameters || {};
  const q = (params.q || "").trim();
  if (!q) return json(400, { error: "Missing query parameter 'q'" });

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 100);
  const exclusiveStartKey = params.nextToken
    ? JSON.parse(Buffer.from(params.nextToken, "base64").toString("utf-8"))
    : undefined;

  const result = await db.searchUsers(q.toLowerCase(), limit, exclusiveStartKey);

  const nextToken = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
    : null;

  const users = (result.Items || []).map((item) => ({
    userId: item.userId,
    username: item.username,
  }));

  return json(200, { users, nextToken });
}
