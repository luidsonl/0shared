import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  badRequest,
  notFound,
  internalError,
  downloadResponse,
} from "./lib/dto.mjs";

const s3 = new S3Client({});
const lambda = new LambdaClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.FILES_BUCKET;
const INTERFACE_LAMBDA_NAME = process.env.INTERFACE_LAMBDA_NAME;
const URL_TTL = 300; // 5 minutes

export async function lambdaHandler(event) {
  try {
    const fileId = event.pathParameters?.fileId;
    if (!fileId) return badRequest("Missing fileId");

    const result = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "FileIdIndex",
      KeyConditionExpression: "file_id = :fileId",
      ExpressionAttributeValues: { ":fileId": fileId },
      Limit: 1,
    }));

    const file = result.Items?.[0];
    if (!file) return notFound("File not found");

    const key = `uploads/${file.owner_user_id}/${fileId}/${file.name}`;

    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).catch((err) => {
      if (err.name === "NotFound" || err.name === "NoSuchKey") return null;
      throw err;
    });

    if (!head) return notFound("File not found");

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${file.name}"`,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: URL_TTL });

    await lambda.send(new InvokeCommand({
      FunctionName: INTERFACE_LAMBDA_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({
        fileId,
        userId: file.owner_user_id,
      })),
    })).catch((err) => {
      console.error(JSON.stringify({ error: "Failed to invoke interface Lambda", detail: err.message }));
    });

    return downloadResponse({
      url,
      filename: file.name,
      contentType: file.content_type,
      size: file.size,
      downloadCount: file.download_count,
    });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return internalError();
  }
}
