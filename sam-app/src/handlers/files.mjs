import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { requireAuth } from "./middleware/auth.mjs";
import * as db from "./lib/dynamo-client.mjs";
import {
  json,
  badRequest,
  unauthorized,
  notFound,
  forbidden,
  methodNotAllowed,
  internalError,
  fileDeletedResponse,
  fileListResponse,
  publicFileItemResponse,
} from "./lib/dto.mjs";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.FILES_BUCKET;

async function deleteFile(event) {
  const fileId = event.pathParameters?.fileId;
  if (!fileId) return badRequest("Missing fileId");

  const user = await requireAuth(event);
  if (!user) return unauthorized();

  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "FileIdIndex",
    KeyConditionExpression: "file_id = :fileId",
    ExpressionAttributeValues: { ":fileId": fileId },
    Limit: 1,
  }));

  const file = result.Items?.[0];
  if (!file) return notFound("File not found");

  if (file.owner_user_id !== user.userId) {
    return forbidden("Not authorized to delete this file");
  }

  const key = `uploads/${file.owner_user_id}/${fileId}/${file.name}`;

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

  await dynamo.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `USER#${file.owner_user_id}`, SK: `FILE#${fileId}` },
  }));

  return fileDeletedResponse(fileId);
}

async function listFiles(event) {
  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 100);
  const sortBy = ["downloadCount", "uploadDate"].includes(params.sortBy) ? params.sortBy : "downloadCount";
  const sortOrder = ["asc", "desc"].includes(params.sortOrder) ? params.sortOrder : "desc";
  const exclusiveStartKey = params.nextToken
    ? JSON.parse(Buffer.from(params.nextToken, "base64").toString("utf-8"))
    : undefined;

  const result = await db.listAllFiles(limit, exclusiveStartKey, sortBy, sortOrder);

  const nextToken = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
    : null;

  const files = (result.Items || []).map(publicFileItemResponse);
  return fileListResponse(files, nextToken);
}

export async function lambdaHandler(event) {
  try {
    if (event.httpMethod === "GET" && event.resource === "/api/files") return listFiles(event);
    if (event.httpMethod === "DELETE") return deleteFile(event);
    return methodNotAllowed();
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return internalError();
  }
}
