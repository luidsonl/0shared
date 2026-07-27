import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { requireAuth } from "./middleware/auth.mjs";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.FILES_BUCKET;

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

async function deleteFile(event) {
  const fileId = event.pathParameters?.fileId;
  if (!fileId) return json(400, { error: "Missing fileId" });

  const user = await requireAuth(event);
  if (!user) return json(401, { error: "Unauthorized" });

  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "FileIdIndex",
    KeyConditionExpression: "file_id = :fileId",
    ExpressionAttributeValues: { ":fileId": fileId },
    Limit: 1,
  }));

  const file = result.Items?.[0];
  if (!file) return json(404, { error: "File not found" });

  if (file.owner_user_id !== user.userId) {
    return json(403, { error: "Not authorized to delete this file" });
  }

  const key = `uploads/${file.owner_user_id}/${fileId}/${file.name}`;

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

  await dynamo.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `USER#${file.owner_user_id}`, SK: `FILE#${fileId}` },
  }));

  return json(200, { message: "File deleted", fileId });
}

export async function lambdaHandler(event) {
  try {
    if (event.httpMethod === "DELETE") return deleteFile(event);
    return json(405, { error: "Method not allowed" });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return json(500, { error: "Internal server error" });
  }
}
