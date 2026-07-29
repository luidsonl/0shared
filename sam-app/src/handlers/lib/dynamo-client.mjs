import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

const TABLE = process.env.DYNAMODB_TABLE;

function now() {
  return new Date().toISOString();
}

export async function getUserById(userId) {
  const result = await doc.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: "PROFILE" },
  }));
  return result.Item || null;
}

export async function getUserByEmail(email) {
  const lookup = await doc.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `EMAIL#${email.toLowerCase()}`, SK: "METADATA" },
  }));
  if (!lookup.Item) return null;
  return getUserById(lookup.Item.userId);
}

export async function createUser(userId, email, username, passwordHash) {
  await doc.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: TABLE,
          ConditionExpression: "attribute_not_exists(PK)",
          Item: {
            PK: `USER#${userId}`,
            SK: "PROFILE",
            userId,
            email,
            username,
            username_lower: username.toLowerCase(),
            passwordHash,
            createdAt: now(),
            gsiname_pk: "NAME#USER",
            gsiname_sk: `${username.toLowerCase()}#${userId}`,
          },
        },
      },
      {
        Put: {
          TableName: TABLE,
          ConditionExpression: "attribute_not_exists(PK)",
          Item: {
            PK: `EMAIL#${email}`,
            SK: "METADATA",
            userId,
          },
        },
      },
    ],
  }));
}

export async function createSession(userId) {
  const { randomUUID } = await import("node:crypto");
  const token = randomUUID();
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await doc.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: TABLE,
          Item: {
            PK: `SESSION#${token}`,
            SK: `SESSION#${token}`,
            token,
            userId,
            expiresAt,
            createdAt,
          },
        },
      },
      {
        Put: {
          TableName: TABLE,
          Item: {
            PK: `USER#${userId}`,
            SK: `SESSION#${token}`,
            expiresAt,
          },
        },
      },
    ],
  }));

  return { token, expiresAt };
}

export async function getSession(token) {
  const result = await doc.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `SESSION#${token}`, SK: `SESSION#${token}` },
  }));
  return result.Item || null;
}

export async function deleteSession(token) {
  const session = await getSession(token);
  if (!session) return;

  await doc.send(new TransactWriteCommand({
    TransactItems: [
      {
        Delete: {
          TableName: TABLE,
          Key: { PK: `SESSION#${token}`, SK: `SESSION#${token}` },
        },
      },
      {
        Delete: {
          TableName: TABLE,
          Key: { PK: `USER#${session.userId}`, SK: `SESSION#${token}` },
        },
      },
    ],
  }));
}

export async function listUserFiles(userId, limit, exclusiveStartKey, sortBy = "uploadDate", sortOrder = "desc") {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":skPrefix": "FILE#",
    },
    Limit: limit,
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const result = await doc.send(new QueryCommand(params));
  const sorted = (result.Items || []).sort((a, b) => {
    const dir = sortOrder === "asc" ? 1 : -1;
    switch (sortBy) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "downloadCount":
        return dir * ((a.download_count || 0) - (b.download_count || 0));
      default:
        return dir * a.upload_date.localeCompare(b.upload_date);
    }
  });
  return { Items: sorted, LastEvaluatedKey: result.LastEvaluatedKey };
}

export async function searchUsers(queryPrefix, limit, exclusiveStartKey) {
  const params = {
    TableName: TABLE,
    IndexName: "NameSearch",
    KeyConditionExpression: "gsiname_pk = :pk AND begins_with(gsiname_sk, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": "NAME#USER",
      ":skPrefix": queryPrefix,
    },
    Limit: limit,
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const result = await doc.send(new QueryCommand(params));
  return { Items: result.Items || [], LastEvaluatedKey: result.LastEvaluatedKey };
}
