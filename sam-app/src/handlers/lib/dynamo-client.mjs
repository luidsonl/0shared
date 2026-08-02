import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
  QueryCommand,
  BatchGetCommand,
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

async function batchGetItems(keys) {
  if (keys.length === 0) return [];

  const batch = keys.slice(0, 100).map((key) => ({ PK: key.PK, SK: key.SK }));
  const orderedIds = batch.map((key) => `${key.PK}#${key.SK}`);
  const found = [];

  let request = { [TABLE]: { Keys: batch } };
  for (let attempt = 0; attempt < 10 && request?.[TABLE]?.Keys?.length; attempt++) {
    const result = await doc.send(new BatchGetCommand({ RequestItems: request }));
    found.push(...(result.Responses?.[TABLE] || []));
    request = result.UnprocessedKeys;
    if (request?.[TABLE]?.Keys?.length) {
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  const foundByKey = new Map(found.map((item) => [`${item.PK}#${item.SK}`, item]));
  return orderedIds
    .map((id) => foundByKey.get(id))
    .filter(Boolean);
}

export async function listAllFiles(limit, exclusiveStartKey, sortBy = "downloadCount", sortOrder = "desc") {
  const indexMap = {
    downloadCount: { index: "DownloadCountIndex", hash: "gsidown_pk", value: "FILE#DOWN" },
    uploadDate: { index: "UploadDateIndex", hash: "gsidate_pk", value: "FILE#DATE" },
  };

  const config = indexMap[sortBy] || indexMap.downloadCount;

  const params = {
    TableName: TABLE,
    IndexName: config.index,
    KeyConditionExpression: `${config.hash} = :pk`,
    ExpressionAttributeValues: {
      ":pk": config.value,
    },
    Limit: limit,
    ScanIndexForward: sortOrder === "asc",
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }

  const result = await doc.send(new QueryCommand(params));
  const items = await batchGetItems(result.Items || []);
  return { Items: items, LastEvaluatedKey: result.LastEvaluatedKey };
}

export async function listUserFiles(userId, limit, exclusiveStartKey, sortBy = "uploadDate", sortOrder = "desc") {
  const indexMap = {
    uploadDate: "UserFileDateIndex",
    name: "UserFileNameIndex",
    downloadCount: "UserFileDownloadIndex",
  };

  const params = {
    TableName: TABLE,
    IndexName: indexMap[sortBy] || "UserFileDateIndex",
    KeyConditionExpression: "owner_user_id = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
    Limit: limit,
    ScanIndexForward: sortOrder === "asc",
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const result = await doc.send(new QueryCommand(params));
  return { Items: result.Items || [], LastEvaluatedKey: result.LastEvaluatedKey };
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
