import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.DOWNLOAD_QUEUE_URL;

export async function lambdaHandler(event) {
  const { fileId, userId } = event;

  if (!fileId || !userId) {
    console.error(JSON.stringify({ error: "Missing fileId or userId" }));
    return { statusCode: 400, body: JSON.stringify({ error: "Missing fileId or userId" }) };
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ fileId, userId }),
  }));

  console.log(JSON.stringify({ event: "download_counter_queued", fileId, userId }));
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
