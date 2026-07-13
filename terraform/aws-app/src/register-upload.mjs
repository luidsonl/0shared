import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.FILES_BUCKET;

export async function lambdaHandler(event) {
  const batchItemFailures = [];

  for (const record of event.Records || []) {
    try {
      const body = JSON.parse(record.body);
      const s3Record = body.Records?.[0]?.s3;
      if (!s3Record) {
        console.error(JSON.stringify({ error: "No S3 record in SQS message" }));
        continue;
      }

      const bucket = s3Record.bucket.name;
      const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, " "));
      const size = s3Record.object.size;

      const parts = key.split("/");
      if (parts.length < 4 || parts[0] !== "uploads") {
        console.error(JSON.stringify({ error: "Invalid key format", key }));
        continue;
      }

      const userId = parts[1];
      const fileId = parts[2];
      const filename = parts.slice(3).join("/");

      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      const contentType = head.ContentType || "application/octet-stream";

      const userResult = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        ProjectionExpression: "username",
      }));
      const ownerUsername = userResult.Item?.username || "unknown";

      const now = new Date().toISOString();
      const shard = fileId.slice(0, 2).toLowerCase();
      const nameLower = filename.toLowerCase();

      await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: `FILE#${fileId}`,
          file_id: fileId,
          owner_user_id: userId,
          owner_username: ownerUsername,
          name: filename,
          name_lower: nameLower,
          size,
          content_type: contentType,
          upload_date: now,
          download_count: 0,
          gsiname_pk: `NAME#FILE#${shard}`,
          gsiname_sk: `${nameLower}#${fileId}`,
          gsidate_pk: "FILE#DATE",
          gsidate_sk: `${now}#${fileId}`,
          gsidown_pk: "FILE#DOWN",
          gsidown_sk: `${String(0).padStart(10, "0")}#${fileId}`,
        },
      }));

      console.log(JSON.stringify({ event: "file_registered", fileId, userId, filename }));
    } catch (err) {
      console.error(JSON.stringify({ error: err.message, messageId: record.messageId }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
