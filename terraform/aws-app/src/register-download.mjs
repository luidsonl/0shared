import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;

export async function lambdaHandler(event) {
  const batchItemFailures = [];

  for (const record of event.Records || []) {
    try {
      const body = JSON.parse(record.body);
      const { fileId, userId } = body;

      if (!fileId || !userId) {
        console.error(JSON.stringify({ error: "Missing fileId or userId", messageId: record.messageId }));
        continue;
      }

      const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `FILE#${fileId}` },
        ProjectionExpression: "download_count, gsidown_sk",
      }));

      if (!result.Item) {
        console.error(JSON.stringify({ error: "File not found", fileId, userId }));
        continue;
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
    } catch (err) {
      console.error(JSON.stringify({ error: err.message, messageId: record.messageId }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
