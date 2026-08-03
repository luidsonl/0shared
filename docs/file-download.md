# File Download — 0shared

## Overview

File downloads use a two-phase flow:

1. **Presigned URL phase:** Client requests a presigned download URL from the API (Lambda returns a URL). No authentication required.
2. **Direct download phase:** Client GETs the file directly from S3 using the presigned URL (no Lambda involvement).

After the URL is generated, a download counter is incremented asynchronously via the Terraform interface Lambda. This keeps the API response fast while still tracking downloads.

**SAM handler:** `sam-app/src/handlers/download.mjs` (presigned URL + async counter invoke)
**Interface Lambda:** `terraform/aws-app/src/invoke-download-counter.mjs` (receives async invoke, increments download_count, updates GSI)

---

## Download Flow Diagram

```
  Client                     API (SAM)                 Interface Lambda (TF)         DynamoDB
    │                            │                            │                         │
    │  GET /api/download/{fileId}│                            │                         │
    │───────────────────────────►│                            │                         │
    │                            │  Query FileIdIndex         │                         │
    │                            │─────────────────────────────────────────────────────►│
    │                            │  ◄── file entity ─────────│                         │
    │                            │                            │                         │
    │  ◄── presigned URL ────────│                            │                         │
    │      (5 min TTL)           │                            │                         │
    │                            │                            │                         │
    │  GET /uploads/...          │                            │                         │
    │  (direct to S3)            │                            │                         │
    │                            │                            │                         │
    │  ◄── file content ─────────│                            │                         │
    │                            │                            │                         │
    │                            │  InvokeAsync (Event)       │                         │
    │                            │───────────────────────────►│                         │
    │                            │                            │  Update download_count  │
    │                            │                            │  + gsidown_sk           │
    │                            │                            │────────────────────────►│
    │                            │                            │                         │
```

---

## Presigned URL Generation

**Endpoint:** `GET /api/download/:fileId`
**Auth:** None (public)

### Request

```
GET /api/download/550e8400-e29b-41d4-a716-446655440000
```

### Response (200)

```json
{
  "url": "https://s3.us-east-1.amazonaws.com/bucket/uploads/user-id/file-id/document.pdf?...",
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "size": 1234567,
  "downloadCount": 42
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `url` | Presigned S3 GET URL (valid for 5 minutes) |
| `filename` | Original filename |
| `contentType` | MIME type |
| `size` | File size in bytes |
| `downloadCount` | Current download count (before this download) |

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Missing `fileId` in path |
| 404 | File not found (no matching `file_id` in FileIdIndex GSI) |

---

## File Lookup by `fileId`

Since files are stored under `PK=USER#{userId}, SK=FILE#{fileId}`, looking up a file by `fileId` alone requires the `FileIdIndex` GSI:

```js
const result = await dynamo.send(new QueryCommand({
  TableName: TABLE,
  IndexName: "FileIdIndex",
  KeyConditionExpression: "file_id = :fileId",
  ExpressionAttributeValues: { ":fileId": fileId },
  Limit: 1,
}));
```

The `FileIdIndex` GSI has:
- Partition key: `file_id`
- Projection: `ALL` (all attributes available without additional lookups)

This enables public download URLs (no auth needed) — anyone with a `fileId` can download.

---

## S3 Key Reconstruction

The S3 key is reconstructed from the file entity returned by the GSI query:

```
uploads/{owner_user_id}/{fileId}/{filename}
```

Example: `uploads/user_abc123/550e8400-e29b-41d4-a716-446655440000/document.pdf`

---

## Direct Download from S3

The client downloads directly from S3 using the presigned URL:

```ts
const response = await fetch(url);
const blob = await response.blob();
```

S3 handles the download — no Lambda is involved in this phase.

The presigned URL includes `ContentDisposition: attachment` to force a download dialog rather than inline rendering.

---

## Download Counter (Async)

The download counter is incremented asynchronously to keep the API response fast.

### Why Async?

The download endpoint must return quickly. The counter update is "fire and forget" — the user doesn't need to wait for it. The async pattern provides:
- Fast API response (no blocking on DynamoDB write)
- The Terraform interface Lambda owns the counter write, keeping SAM as a pure storefront

### Why a Lambda Interface?

SAM must not touch async processing infrastructure directly. SAM owns the "storefront" (API-triggered Lambdas); Terraform owns all async processing. The Interface Lambda acts as the boundary:

```
SAM (Download Lambda) ──async invoke──► Interface Lambda (Terraform) ──► DynamoDB
```

This clean separation means SAM and Terraform have no circular dependencies.

### Phase 1: Async Lambda Invoke

The Download Lambda invokes the Interface Lambda asynchronously (`InvocationType: "Event"`):

```js
await lambda.send(new InvokeCommand({
  FunctionName: INTERFACE_LAMBDA_NAME,
  InvocationType: "Event",
  Payload: Buffer.from(JSON.stringify({ fileId, userId: file.owner_user_id })),
})).catch((err) => {
  console.error(JSON.stringify({ error: "Failed to invoke interface Lambda", detail: err.message }));
});
```

- `InvocationType: "Event"` = fire-and-forget (no response awaited)
- The `.catch()` logs but does not fail the download request
- If the Interface Lambda errors, Lambda retries the async invoke twice automatically (best-effort counting)

### Phase 2: Interface Lambda → DynamoDB

**Handler:** `terraform/aws-app/src/invoke-download-counter.mjs`

The Interface Lambda receives the payload and increments the counter directly in DynamoDB:

1. Parse `fileId` and `userId` from the payload
2. Fetch the current `download_count` from DynamoDB
3. Increment the count by 1
4. Generate the new `gsidown_sk` (zero-padded for correct sort order)
5. Update both fields atomically

### Counter Update Logic

```js
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
```

**Note:** The current `download_count` is fetched from DynamoDB and then updated. This is a read-then-write pattern (not atomic increment), which is acceptable for a download counter where exact precision is not critical.

### Logging

```json
{"event": "download_counted", "fileId": "...", "userId": "...", "newCount": 43}
```

---

## Error Scenarios

| Scenario | Handling |
|----------|----------|
| Missing `fileId` in request | 400 error returned |
| File not found in GSI | 404 error returned |
| S3 key reconstruction fails | 500 error returned (unlikely if file entity is correct) |
| Async invoke fails | Logged, download still succeeds (counter not incremented) |
| Interface Lambda fails | Lambda async-invoke retries twice, then the count is lost (best-effort) |
| `download_count` is missing | Defaults to `0` before incrementing |

---

## DynamoDB GSI (`gsidown`)

The `gsidown_pk` and `gsidown_sk` fields enable sorting files by download count:

- `gsidown_pk`: `FILE#DOWN` (constant for all files)
- `gsidown_sk`: `{zero-padded_count}#{fileId}` (e.g., `0000000042#550e8400-...`)

This allows querying "most downloaded files" with a simple `Query` on the `gsidown` GSI, sorted by `gsidown_sk` descending.

---

## See Also

- [Architecture](./architecture.md) — deployment, tooling, infrastructure
- [Backend](./backend.md) — API structure, error handling
- [File Upload](./file-upload.md) — presigned URL upload flow
- [DynamoDB Schema](./dynamodb-schema.md) — entity definitions, GSIs
