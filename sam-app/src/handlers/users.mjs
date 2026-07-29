import { requireAuth } from "./middleware/auth.mjs";
import * as db from "./lib/dynamo-client.mjs";
import {
  json,
  notFound,
  badRequest,
  unauthorized,
  internalError,
  userSearchResponse,
  userResponse,
} from "./lib/dto.mjs";

export async function lambdaHandler(event) {
  try {
    if (event.httpMethod === "GET" && event.path === "/api/users/search") {
      return handleSearch(event);
    }
    if (event.httpMethod === "GET" && event.pathParameters?.userId) {
      return handleGetUser(event);
    }
    return notFound();
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return internalError();
  }
}

async function handleGetUser(event) {
  const session = await requireAuth(event);
  if (!session) return unauthorized();

  const userId = event.pathParameters.userId;
  const user = await db.getUserById(userId);
  if (!user) return notFound("User not found");

  return userResponse(user.userId, user.username, user.createdAt);
}

async function handleSearch(event) {
  const session = await requireAuth(event);
  if (!session) return unauthorized();

  const params = event.queryStringParameters || {};
  const q = (params.q || "").trim();
  if (!q) return badRequest("Missing query parameter 'q'");

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 100);
  const exclusiveStartKey = params.nextToken
    ? JSON.parse(Buffer.from(params.nextToken, "base64").toString("utf-8"))
    : undefined;

  const result = await db.searchUsers(q.toLowerCase(), limit, exclusiveStartKey);

  const nextToken = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
    : null;

  const users = (result.Items || []).map((item) => ({
    userId: item.PK.replace("USER#", ""),
    username: item.username,
  }));

  return userSearchResponse(users, nextToken);
}
