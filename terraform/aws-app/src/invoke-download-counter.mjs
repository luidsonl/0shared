import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;

export async function lambdaHandler(event) {
  const { fileId, userId } = event;

  if (!fileId || !userId) {
    console.error(JSON.stringify({ error: "Missing fileId or userId" }));
    return { statusCode: 400, body: JSON.stringify({ error: "Missing fileId or userId" }) };
  }

  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FILE#${fileId}` },
    ProjectionExpression: "download_count",
  }));

  if (!result.Item) {
    console.error(JSON.stringify({ error: "File not found", fileId, userId }));
    return { statusCode: 404, body: JSON.stringify({ error: "File not found" }) };
  }

  const currentCount = result.Item.download_count || 0;
  const newCount = currentCount + 1;
  const newGsiKey = `${String(newCount).padStart(10, "0")}#${fileId}`;

  await dynamo.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FILE#${fileId}` },
    UpdateExpression: "SET download_count = :newCount, gsidown_sk = :newGsiKey",
    ExpressionAttributeValues: {
      ":newCount": newCount,
      ":newGsiKey": newGsiKey,
    },
  }));

  console.log(JSON.stringify({ event: "download_counted", fileId, userId, newCount }));
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
