import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const FILES_BUCKET = process.env.FILES_BUCKET;

export const lambdaHandler = async (event) => {
  console.log(JSON.stringify({ event: "health_check_started", table: TABLE_NAME, bucket: FILES_BUCKET }));

  const checks = {};
  let allHealthy = true;

  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    checks.dynamodb = "healthy";
  } catch (err) {
    checks.dynamodb = `unhealthy: ${err.message}`;
    allHealthy = false;
  }

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: FILES_BUCKET }));
    checks.s3 = "healthy";
  } catch (err) {
    checks.s3 = `unhealthy: ${err.message}`;
    allHealthy = false;
  }

  const statusCode = allHealthy ? 200 : 503;
  const body = {
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    ...checks,
  };

  console.log(JSON.stringify(body));

  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
};
