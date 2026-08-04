import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BASE = process.env.API_ENDPOINT || "http://127.0.0.1:3000";
const TABLE = process.env.DYNAMODB_TABLE || "0shared";
const BUCKET = process.env.FILES_BUCKET || "luidsonl-0shared-files";
const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, body: await res.json() };
}

export function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cleans up a completed upload. Registration in DynamoDB happens asynchronously
 * (S3 event → SQS → register lambda), so we wait for the FILE# record before
 * deleting it, and only delete the S3 object afterwards to avoid the register
 * lambda failing a HeadObject on a deleted object.
 */
export async function purgeFile(userId, fileId, objectKey) {
  if (!userId || !fileId) return;
  const key = { PK: `USER#${userId}`, SK: `FILE#${fileId}` };
  for (let i = 0; i < 10; i++) {
    const result = await dynamo.send(new GetCommand({ TableName: TABLE, Key: key }));
    if (result.Item) {
      await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: key })).catch(() => {});
      if (objectKey) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey })).catch(() => {});
      }
      return;
    }
    await sleep(1000);
  }
  if (objectKey) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey })).catch(() => {});
  }
}

/**
 * Deletes everything a test user created: DynamoDB items under the
 * USER#<userId> prefix (PROFILE, SESSION#, FILE#), their S3 objects,
 * the EMAIL#<email> record, and the top-level SESSION#<token> items.
 */
export async function purgeUser(userId, email, tokens = []) {
  if (!userId) return;
  const errors = [];
  let username;

  let lastKey;
  do {
    const res = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${userId}` },
      ExclusiveStartKey: lastKey,
    }));
    lastKey = res.LastEvaluatedKey;
    for (const item of res.Items || []) {
      const sk = item.SK;
      if (sk === "PROFILE" && item.username) username = item.username;
      try {
        if (typeof sk === "string" && sk.startsWith("FILE#")) {
          const objectKey = `uploads/${item.owner_user_id}/${item.file_id}/${item.name}`;
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }));
        }
        await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { PK: item.PK, SK: sk } }));
      } catch (err) {
        errors.push(`${item.PK}#${sk}: ${err.message}`);
      }
    }
  } while (lastKey);

  if (username) {
    try {
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USERNAME#${username.toLowerCase()}`, SK: "METADATA" },
      }));
    } catch (err) {
      errors.push(`USERNAME#${username.toLowerCase()}: ${err.message}`);
    }
  }

  if (email) {
    try {
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `EMAIL#${email.toLowerCase()}`, SK: "METADATA" },
      }));
    } catch (err) {
      errors.push(`EMAIL#${email.toLowerCase()}: ${err.message}`);
    }
  }

  for (const token of tokens) {
    if (!token) continue;
    try {
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `SESSION#${token}`, SK: `SESSION#${token}` },
      }));
    } catch (err) {
      errors.push(`SESSION#${token}: ${err.message}`);
    }
  }

  if (errors.length) {
    console.error(`[purgeUser] cleanup errors for ${userId}: ${errors.join("; ")}`);
  }
}
