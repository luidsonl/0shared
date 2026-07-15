# File Upload — 0shared

## Overview

File uploads use a two-phase flow:

1. **Presigned URL phase:** Client requests a presigned upload URL from the API (Lambda returns a URL).
2. **Direct upload phase:** Client PUTs the file directly to S3 using the presigned URL (no Lambda involvement).

After the file lands in S3, an event notification triggers SQS, which triggers the Registration Lambda to persist file metadata in DynamoDB.

**SAM handler:** `sam-app/src/handlers/upload.mjs` (presigned URL generation)
**Registration Lambda:** `terraform/aws-app/src/register-upload.mjs` (DynamoDB write, SQS-triggered)

---

## Upload Flow Diagram

```
  Client                     API (SAM)                    S3                      SQS                  DynamoDB
    │                            │                          │                       │                       │
    │  POST /api/upload          │                          │                       │                       │
    │  {filename, contentType}   │                          │                       │                       │
    │───────────────────────────►│                          │                       │                       │
    │                            │                          │                       │                       │
    │  ◄── presigned URL + fileId│                          │                       │                       │
    │      (5 min TTL)           │                          │                       │                       │
    │                            │                          │                       │                       │
    │  PUT /uploads/...          │                          │                       │                       │
    │  (direct to S3)            │─────────────────────────►│                       │                       │
    │                            │                          │                       │                       │
    │  ◄── 200 OK ──────────────│                          │                       │                       │
    │                            │                          │                       │                       │
    │                            │                          │  S3 Event             │                       │
    │                            │                          │──────────────────────►│                       │
    │                            │                          │                       │  ReceiveMessage        │
    │                            │                          │                       │──────────────────────►│
    │                            │                          │                       │                       │
    │                            │                          │                       │         File entity    │
    │                            │                          │                       │         (PK=USER#,    │
    │                            │                          │                       │          SK=FILE#)    │
```

---

## Presigned URL Generation

**Endpoint:** `POST /api/upload`
**Auth:** Required (Bearer token)

### Request

```json
POST /api/upload
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "document.pdf",
  "contentType": "application/pdf"
}
```

### Response (200)

```json
{
  "url": "https://s3.us-east-1.amazonaws.com/bucket/uploads/user-id/file-id/document.pdf?...",
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_abc123",
  "key": "uploads/user_abc123/550e8400-.../document.pdf"
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `url` | Presigned S3 PUT URL (valid for 5 minutes) |
| `fileId` | Unique file identifier (UUID) — needed later for download |
| `userId` | Owner's user ID (for reference) |
| `key` | S3 object key (for reference/debugging) |

### Validation

- `filename` is required (returns 400 if missing)
- `contentType` is optional (defaults to `application/octet-stream`)
- Max file size: 1 GB (enforced at the presigned URL level via `ContentLengthRange`)
- `ContentLengthRange: [0, 1073741824]` — S3 rejects oversized uploads at the edge with zero Lambda cost

---

## Filename Sanitization

The filename is sanitized before being used in the S3 key:

1. Replace non-alphanumeric characters (except `._-`) with `_`
2. Collapse consecutive underscores
3. Trim leading/trailing underscores
4. Truncate to 255 characters

Examples:

| Input | Sanitized |
|-------|-----------|
| `my document.pdf` | `my_document.pdf` |
| `file (copy).jpg` | `file_copy_.jpg` |
| `a__b___c.txt` | `a_b_c.txt` |
| `_leading.txt` | `leading.txt` |
| `a`.repeat(300) + `.txt` | `aaa...aaa.txt` (255 chars) |

---

## S3 Key Format

```
uploads/{user_id}/{file_id}/{sanitized_filename}
```

Example: `uploads/user_abc123/550e8400-e29b-41d4-a716-446655440000/document.pdf`

This format enables:
- **User isolation:** All files for a user are under `uploads/{user_id}/`
- **Direct download by key:** The download handler can reconstruct the key from metadata
- **Easy listing:** S3 prefix listing by user ID

---

## Direct Upload to S3

The client uploads directly to S3 using the presigned URL:

```ts
await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body: file,
});
```

S3 handles the upload — no Lambda is involved in this phase.

---

## S3 Event → SQS → Registration Lambda

After the file lands in S3, an event notification is sent:

1. **S3 Event Notification:** Configured in Terraform (`terraform/aws-app/resources/modules/files/main.tf`) — sends `s3:ObjectCreated:*` events to the upload SQS queue.
2. **SQS Message:** Contains the S3 event record (bucket, key, size).
3. **Registration Lambda:** Triggered by SQS event source mapping (Terraform-managed). Processes the message and writes the file entity to DynamoDB.

---

## Registration Lambda (`register-upload.mjs`)

**Trigger:** SQS (upload queue)
**Location:** `terraform/aws-app/src/register-upload.mjs`

### Processing Flow

For each SQS message:

1. Parse the S3 event record from the message body
2. Extract `bucket`, `key`, `size` from the S3 record
3. Parse the S3 key to extract `userId`, `fileId`, `filename`
4. Call `HeadObject` on S3 to get the `ContentType`
5. Look up the user's `username` from DynamoDB
6. Write the file entity to DynamoDB

### File Entity Created

| Field | Value | Description |
|-------|-------|-------------|
| `PK` | `USER#{userId}` | Partition key (owner) |
| `SK` | `FILE#{fileId}` | Sort key |
| `file_id` | UUID | Unique file identifier |
| `owner_user_id` | user ID | Owner reference |
| `owner_username` | username | Denormalized username |
| `name` | filename | Original filename |
| `name_lower` | lowercase filename | For case-insensitive sorting |
| `size` | bytes | File size |
| `content_type` | MIME type | e.g., `application/pdf` |
| `upload_date` | ISO timestamp | When the file was registered |
| `download_count` | `0` | Initial download count |
| `gsiname_pk` | `NAME#FILE#{shard}` | GSI sort key prefix for name sorting |
| `gsiname_sk` | `{name_lower}#{fileId}` | GSI sort key for name sorting |
| `gsidate_pk` | `FILE#DATE` | GSI partition key for date sorting |
| `gsidate_sk` | `{timestamp}#{fileId}` | GSI sort key for date sorting |
| `gsidown_pk` | `FILE#DOWN` | GSI partition key for download sorting |
| `gsidown_sk` | `{padded_count}#{fileId}` | GSI sort key for download sorting |

### S3 Key Parsing

```
uploads/{userId}/{fileId}/{filename}
  [0]      [1]      [2]     [3...]
```

- Requires at least 4 parts
- First part must be `uploads`
- `userId` = `parts[1]`
- `fileId` = `parts[2]`
- `filename` = `parts.slice(3).join("/")` (handles filenames with `/`)

### Error Handling

- Uses SQS batch item failure reporting (`batchItemFailures`)
- Failed messages are returned to the queue for retry
- Messages that exceed the visibility timeout are retried by SQS
- Failed messages eventually land in the DLQ after maxReceiveCount (3)

### Logging

```json
{"event": "file_registered", "fileId": "...", "userId": "...", "filename": "..."}
```

---

## SQS Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Visibility timeout | 4 minutes | Allows Lambda to process without re-triggering |
| Message retention | 14 days | Enough time to debug failures |
| Max receive count | 3 | Retry before sending to DLQ |
| DLQ retention | 14 days | Time to inspect and replay failed messages |

---

## Error Scenarios

| Scenario | Handling |
|----------|----------|
| S3 key format invalid | Logged, message skipped (not sent to DLQ) |
| HeadObject fails | Message sent to DLQ for retry |
| DynamoDB write fails | Message sent to DLQ for retry |
| File > 1 GB | Rejected at the presigned URL edge — zero cost |

---

## See Also

- [Architecture](./architecture.md) — deployment, tooling, infrastructure
- [Backend](./backend.md) — API structure, error handling
- [File Download](./file-download.md) — presigned URL download flow
- [DynamoDB Schema](./dynamodb-schema.md) — entity definitions, GSIs
