# Architecture Manual — Serverless File Sharing with Terraform + SAM

## Overview

This document describes the architecture, tooling decisions, and integration patterns used in **0shared**. It serves as a reference for building similar serverless applications with a clear separation between infrastructure (Terraform) and application (AWS SAM) layers.

The backend API is served under the `/api` path prefix so that a single CloudFront distribution can serve both the static frontend (`/*`) and the API (`/api/*`) from one domain, without CORS.

---

## Architecture Diagram

```
                         CloudFront
                        ┌──────────┐
                        │  CDN     │
                        └────┬─────┘
            ┌────────────────┴────────────────┐
            │                                  │
            ▼                                  ▼
      ┌──────────┐                    ┌──────────────┐
      │ S3       │                    │ API Gateway  │
      │ (static) │                    │ (REST API)   │
      └──────────┘                    └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │ Lambda       │
                                      │ (Node.js 22) │
                                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │ DynamoDB     │
                                      │ (Terraform)  │
                                      └──────────────┘

Upload flow (presigned URL + S3 event):

  Client ──► POST /api/upload ──► Upload Lambda ──► presigned PUT URL
                                                            │
  Client ◄── presigned URL ─────────────────────────────────┘
      │
      ▼ (direct PUT to S3)
  ┌──────────┐
  │ S3       │
  │ (files)  │──► S3 Event ──► SQS Queue ──► Registration Lambda ──► DynamoDB
  └──────────┘                                                      (File entity)
```

---

## Project Structure

```
├── terraform/
│   ├── aws-bootstrap/     # S3 bucket for Terraform state (one-time)
│   ├── aws-app/           # DynamoDB table + S3 files bucket + SQS queue + registration Lambda
│   └── aws-frontend/      # S3 static bucket + CloudFront + OAC + deploy
├── frontend/              # React + Vite SPA (src/App.tsx, vite.config.ts)
├── docs/
│   ├── architecture-manual.md
│   └── dynamodb-schema.md
└── sam-app/               # API Gateway + API-triggered Lambda (stateless compute)
    ├── template.yaml      # SAM template (health, auth, upload functions + API)
    ├── samconfig.toml     # SAM config (stack name, parameter overrides)
    ├── resources.env      # Central resource names (source of truth)
    ├── Makefile           # Convenience targets (deploy, test, clean)
    ├── env.json           # Local environment variables
    ├── scripts/clean.sh    # Clean DynamoDB + S3
    ├── tests/integration/ # HTTP integration tests (mocha + chai)
    └── src/handlers/      # Lambda code (Node.js ESM)
        ├── health.mjs     # Health check endpoint (SAM)
        ├── auth.mjs       # Signup, login, logout, me (SAM)
        ├── upload.mjs     # Generate presigned upload URL (SAM)
        ├── register-upload.mjs  # SQS-triggered file registration (Terraform)
        ├── middleware/     # Request middleware (auth validation)
        └── lib/           # Shared utilities (DynamoDB client, etc.)
```

---

## Tooling Strategy

### Terraform — Infrastructure as Code

Terraform manages all **stateful, long-lived infrastructure**:

| Resource | Responsibility |
|---|---|
| `terraform/aws-bootstrap/` | S3 bucket for Terraform state |
| `terraform/aws-app/` | DynamoDB table, S3 files bucket (CORS + event notification), SQS upload queue + DLQ, registration Lambda (SQS-triggered), event source mapping (SQS → Lambda) |
| `terraform/aws-frontend/` | S3 static bucket, CloudFront distribution, OAC, frontend deploy |

**Why Terraform for these?**
- DynamoDB tables are stateful — deleting and recreating them loses data.
- S3 buckets and CloudFront are foundational infrastructure.
- SQS queues, event notifications, and event source mappings are stateful infrastructure.
- Registration Lambda is not API-triggered — centralizing it with SQS keeps all upload infrastructure together.
- Terraform's `prevent_destroy` lifecycle protects critical resources.
- State can be shared across a team via the S3 backend.

### AWS SAM — Application Layer

SAM manages **stateless, ephemeral compute** (API-triggered Lambdas):

| Resource | Responsibility |
|---|---|
| `template.yaml` | Lambda functions (health, auth, upload), API Gateway (REST API) |
| `src/handlers/` | Business logic (Node.js 22 ESM) |

**Why SAM for these?**
- Lambda functions are code that changes frequently.
- API Gateway is tightly coupled to Lambda routing.
- SAM provides a simpler syntax for Lambda + API Gateway than raw CloudFormation.
- `sam local start-api` enables local testing of API-triggered Lambdas.

---

## Resource Name Centralization

### Derivation Chain

```
terraform/aws-app/terraform.tfvars     sam-app/resources.env (final values)
──────────────────────────────         ─────────────────────────────
namespace=luidsonl                      │
project_name=0shared                    │
environment=""                          │
table_suffix=""                         ├── DYNAMODB_TABLE = 0shared
files_bucket_suffix="-files"            ├── FILES_BUCKET   = luidsonl-0shared-files
                                        ├── UPLOAD_QUEUE_URL = <Terraform output>
terraform/aws-frontend/terraform.tfvars │
front_bucket_suffix="-front"            ├── S3 frontend   = luidsonl-0shared-front
oac_name_suffix="-s3-oac"               ├── OAC           = 0shared-s3-oac
```

**Naming formula:**

| Resource | Formula | Example |
|----------|---------|---------|
| DynamoDB table | `{project_name}{env_under}{table_suffix}` | `0shared` |
| Files S3 bucket | `{namespace}-{project_name}{env_dash}{files_bucket_suffix}` | `luidsonl-0shared-files` |
| Upload SQS queue | `{project_name}{env_under}{queue_suffix}` | `0shared-upload` |
| Frontend S3 bucket | `{namespace}-{project_name}{env_dash}{front_bucket_suffix}` | `luidsonl-0shared-front` |
| CloudFront OAC | `{project_name}{env_dash}{oac_name_suffix}` | `0shared-s3-oac` |
| SAM stack | `app-0shared-backend` (hardcoded in `samconfig.toml`) | `app-0shared-backend` |

### How each file consumes the names

| File | Consumption |
|------|-----------|
| `terraform/aws-app/terraform.tfvars` | Defines `namespace`, `project_name`, `environment`, `table_suffix`, `files_bucket_suffix` |
| `terraform/aws-frontend/terraform.tfvars` | Defines frontend `namespace`, `project_name`, `environment`, `front_bucket_suffix`, `oac_name_suffix` |
| `sam-app/resources.env` | Documents the final derived names (must match Terraform output) |
| `sam-app/samconfig.toml` | Hardcoded values with `# Must match resources.env` comments |
| `sam-app/env.json` | Hardcoded values for local `sam local start-api` |
| `sam-app/Makefile` | `include resources.env` — targets inherit names as env vars |

---

## Integration Between Terraform and SAM

### The Problem

Terraform and SAM deploy independently. Terraform doesn't know about SAM resources and vice versa. But they need to share information — for example, Lambda functions need to know the DynamoDB table name, and the frontend's CloudFront distribution needs to know the API Gateway URL.

### Solution 1: CloudFormation Exports → Terraform Data Sources (SAM → Terraform)

SAM exports the API endpoint as a CloudFormation export:

```yaml
# sam-app/template.yaml
Outputs:
  ApiEndpoint:
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.${AWS::URLSuffix}/Prod"
    Export:
      Name: sam-app-ApiEndpoint
```

Terraform reads the export in the frontend layer:

```hcl
# terraform/aws-frontend/main.tf
data "aws_cloudformation_export" "api_url" {
  name = "sam-app-ApiEndpoint"
}
```

**Flow:**

```
SAM deploy ──► CloudFormation Export ──► Terraform data source ──► CloudFront /api/* origin
```

### Solution 2: SAM Parameters (Terraform → SAM)

For values flowing the other direction (Terraform → SAM), use SAM parameters:

```yaml
# sam-app/template.yaml
Parameters:
  DynamoDBTableName:
    Type: String
  FilesBucketName:
    Type: String
```

```bash
# Deploy command
sam build && sam deploy
```

The values live in `sam-app/samconfig.toml` (`parameter_overrides`) and are kept in sync with `resources.env`. For another environment, override on the command line:

```bash
sam deploy --parameter-overrides \
  DynamoDBTableName=staging_table \
  FilesBucketName=staging-bucket
```

---

## Deployment Order

```
 1. terraform/aws-bootstrap/   (one-time S3 state bucket)
 2. terraform/aws-app/        (DynamoDB + S3 + SQS + registration Lambda + event source mapping)
 3. sam-app/                  (API-triggered Lambdas + API Gateway, exports ApiEndpoint)
 4. terraform/aws-frontend/   (S3 + CloudFront + frontend build & upload)
```

Dependencies between steps:

```
Step 2 → all stateful infra: DynamoDB table, S3 files bucket, SQS queue, DLQ,
         registration Lambda (SQS-triggered), S3 event notification, event source mapping
Step 3 → reads table/bucket names from samconfig.toml, deploys API-triggered Lambdas
Step 3 → exports API URL (sam-app-ApiEndpoint) → consumed by Step 4
Step 4 → reads the export, builds the SPA, uploads to S3, invalidates CloudFront
```

### Deploy Commands

```bash
# Step 1 — one-time (S3 state bucket)
cd terraform/aws-bootstrap && terraform init && terraform apply

# Step 2 — DynamoDB + S3 + SQS + registration Lambda + event source mapping
cd terraform/aws-app && terraform init && terraform apply

# Step 3 — API-triggered Lambdas + API Gateway (exports sam-app-ApiEndpoint)
cd sam-app && sam build && sam deploy

# Step 4 — S3 + CloudFront + frontend build/upload
cd terraform/aws-frontend && terraform init && terraform apply
```

> `sam deploy` reads resource names from `samconfig.toml`, whose `parameter_overrides`
> must match `resources.env`. The `aws-frontend` apply blocks until the SAM export exists.

---

## Data Flow (Production)

### API Requests

```
User ──► https://<cloudfront>.cloudfront.net/
                │
                ├── /api/* ──► CloudFront origin "api-gateway"
                │                 │
                │                 └── /Prod/api/* ──► API Gateway ──► Lambda ──► DynamoDB
                │
                └── /* (default) ──► CloudFront origin "s3-frontend"
                                        │
                                        └── GET /index.html ──► S3 bucket
```

### File Upload

```
1. Client ──► POST /api/upload ──► Upload Lambda (validates auth)
                                      │
                                      ├── Generates presigned PUT URL (1 GB max, 5 min TTL)
                                      │   S3 key: uploads/{user_id}/{file_id}/{filename}
                                      │
2. Client ◄── { url, file_id } ◄──────┘

3. Client ──► PUT <presigned_url> ──► S3 (files bucket) ──► ObjectCreated event
                                                              │
4. S3 ──► SQS Queue ──► Registration Lambda
                          │
                          ├── Parse S3 key → user_id, file_id, filename
                          ├── S3 HeadObject → content_type, size
                          ├── DynamoDB GetItem → owner_username
                          └── DynamoDB PutItem → File entity + GSI attributes
```

---

## Frontend Integration

### Development

Vite runs a dev server at `http://localhost:5173` and proxies `/api/*` to the SAM local API:

```ts
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

SAM local API runs at `http://localhost:3000` and invokes Lambda functions locally:

```bash
sam local start-api --env-vars env.json --host 0.0.0.0
```

### Production

The frontend is built with `npm run build` and uploaded to S3 by the `null_resource.frontend_deploy`
inside `terraform/aws-frontend`. CloudFront serves:
- Static files (`/*`) from the S3 origin
- API requests (`/api/*`) from the API Gateway origin

The frontend always uses **relative paths** (`/api/health`, `/api/auth/login`). In dev, Vite proxies them.
In production, CloudFront routes them. No environment-specific configuration is needed in the frontend code.

---

## Local Development Workflow

```
Terminal 1:     sam local start-api        (Lambda + API Gateway on :3000)
Terminal 2:     npm run dev                (Vite on :5173, proxies /api → :3000)
Terminal 3:     (optional) aws dynamodb    (interact directly with DynamoDB)
                put-item / scan / etc.
```

---

## Integration Tests

Tests run against the real API (local or AWS) over HTTP, without mocks.

```bash
# Terminal 1 — start the local API
cd sam-app && make start-api

# Terminal 2 — run the integration tests (health + auth)
cd sam-app && make test

# Optional — clean data generated by tests
cd sam-app && make clean
```

Against AWS (after deploy):

```bash
make test-aws
# or manually (note the /api suffix on the CloudFront domain):
API_ENDPOINT=https://<cloudfront>.cloudfront.net/api npm test
```

The `API_ENDPOINT` variable (default `http://127.0.0.1:3000`) is read in
`tests/integration/helpers.mjs`. The Makefile injects it via an env var.

### Clean Script

Cleans DynamoDB + S3. Useful between test runs. Reads defaults from `resources.env`.

```bash
cd sam-app && make clean                   # clean everything (uses resources.env)
cd sam-app && ./scripts/clean.sh --dry-run # show what would be deleted
```

---

## Security Considerations

### S3 Bucket (frontend)

- Public access blocked (`block_public_acls`, `block_public_policy`, etc.)
- Only CloudFront can read objects (via Origin Access Control + bucket policy)
- Bucket policy restricts `s3:GetObject` to the specific CloudFront distribution

### S3 Bucket (files)

- Public access blocked (`block_public_acls`, `block_public_policy`, etc.)
- No public bucket policy — objects are private by default
- CORS configured for direct browser-to-S3 uploads (PUT, POST, GET, HEAD from `*`)
- `force_destroy = false` — prevents accidental deletion with objects present
- `prevent_destroy = true` — Terraform lifecycle protection

### SQS (upload queue)

- Dead-letter queue (DLQ) catches failed registration attempts (14-day retention)
- Main queue visibility timeout: 4 minutes (allows Lambda to process without re-triggering)
- Message retention: 14 days
- Only the Registration Lambda has `sqs:ReceiveMessage` permissions (via SAM event source mapping)

### CloudFront

- OAC (Origin Access Control) is used instead of legacy OAI
- Viewer protocol policy: `redirect-to-https`
- API requests (`/api/*`) use the `CachingDisabled` cache policy (no caching of dynamic data)

### API Gateway

- REST API is deployed with a public endpoint
- Auth routes (`/api/auth/*`) are publicly accessible
- Protected routes validate the session via a Bearer token lookup in DynamoDB

### File Upload

- Presigned URLs expire after 5 minutes (short TTL limits exposure)
- Presigned URLs enforce 1 GB max file size via `Content-Length-Range` condition
- S3 key embeds `user_id` and `file_id` — no custom metadata needed
- Filenames are sanitized (dangerous chars stripped, truncated to 255 chars)
- Registration Lambda validates the S3 key structure before writing to DynamoDB

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **REST API over HTTP API** | `sam local start-api` has better support for REST API (`Type: Api`) |
| **CloudFront over direct API** | Single domain for frontend + API, no CORS needed |
| **`/api` path prefix** | Same code works in dev (Vite proxy) and prod (CloudFront) |
| **Separate `aws-frontend` module** | Frontend infra (S3 + CloudFront) is decoupled from stateful app infra |
| **CloudFormation Export** | Cleanest way to pass values from SAM to Terraform without SSM costs |
| **`null_resource` for deploy** | Frontend build + upload + invalidation in a single `terraform apply` |
| **Presigned URL + S3 event** | Lambda doesn't wait for upload — browser PUTs directly to S3, S3 triggers SQS |
| **SQS over direct S3→Lambda** | SQS provides DLQ, visibility timeout, retry control — S3 event notifications alone are opaque |
| **Registration Lambda in Terraform** | Not API-triggered; centralizes all upload infrastructure (SQS + Lambda + events) in one layer |
| **Upload Lambda in SAM** | API-triggered; benefits from `sam local start-api` for local testing |
| **User ID in S3 key** | Registration Lambda identifies file owner by parsing `uploads/{user_id}/{file_id}/{filename}` |
| **1 GB presigned URL limit** | S3 rejects oversized uploads at the edge — zero cost for abuse attempts |

---

## Clean Up Order

```bash
terraform/aws-frontend destroy   # CloudFront + S3 + frontend files
terraform/aws-app destroy        # SQS event source mapping + SQS queue + DLQ + S3 events + DynamoDB + files bucket
sam delete                       # Lambda functions + API Gateway
terraform/aws-bootstrap destroy  # State bucket (optional)
```

Dependencies flow forward, so destroy must happen in reverse.

---

## Extending This Architecture

### Adding a New Lambda

1. Add a new handler in `sam-app/src/handlers/`
2. Add a new resource in `sam-app/template.yaml` with `Type: AWS::Serverless::Function` and an `Api` event (path under `/api/*`)
3. If a new top-level path is needed, add an `ordered_cache_behavior` in `terraform/aws-frontend/main.tf`

### Adding a New DynamoDB Table

1. Add a new `aws_dynamodb_table` resource in `terraform/aws-app/resources/modules/database/main.tf`
2. Export the table name as a Terraform output
3. Pass it to SAM via `--parameter-overrides`
4. Add IAM permissions in SAM (`DynamoDBCrudPolicy`)

### Adding Authentication

Auth is implemented as a stateful session system using DynamoDB.

**Endpoints (all under `/api`):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Create account (email + username + password) |
| POST | `/api/auth/login` | No | Sign in, returns Bearer token |
| POST | `/api/auth/logout` | Bearer | Destroy session |
| GET | `/api/auth/me` | Bearer | Get current user profile |
| GET | `/api/health` | No | Health check (DynamoDB + S3) |
| POST | `/api/upload` | Bearer | Get presigned URL for file upload |

**Flow:** Login → bcrypt verify → create session in DynamoDB → return `{ token }`. Each protected call reads `SESSION#<token>` to validate. Logout deletes both `SESSION#<token>` records.

**Dependencies:** `bcryptjs` (pure-JS bcrypt), `@aws-sdk/lib-dynamodb` (DocumentClient).

### Adding File Upload

File upload uses a **presigned URL + S3 event notification** pattern.

**Architecture:**

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| Upload Lambda | SAM | Validates auth, generates presigned PUT URL (1 GB max, 5 min TTL) |
| Registration Lambda | Terraform | Parses S3 event, writes File entity to DynamoDB |
| S3 files bucket | Terraform | Stores uploaded files, CORS, event notification → SQS |
| SQS queue + DLQ | Terraform | Buffers S3 events, provides retry/DLQ for failed registrations |
| Event source mapping | Terraform | Connects SQS queue to registration Lambda |

**Key insight:** All upload infrastructure (SQS, S3 events, registration Lambda, event source mapping) is centralized in Terraform. Only the API-triggered Upload Lambda stays in SAM for local testing.

**S3 key format:** `uploads/{user_id}/{file_id}/{sanitized_filename}`

**Registration Lambda writes the File entity:**

```javascript
{
  PK: `USER#${userId}`,
  SK: `FILE#${fileId}`,
  file_id: fileId,
  owner_user_id: userId,
  owner_username: username,        // from DynamoDB GetItem
  name: filename,
  name_lower: filename.toLowerCase(),
  size: contentLength,             // from S3 HeadObject
  content_type: contentType,       // from S3 HeadObject
  upload_date: new Date().toISOString(),
  download_count: 0,
  // GSI attributes
  gsiname_pk: `NAME#FILE#${shard}`,
  gsiname_sk: `${filename.toLowerCase()}#${fileId}`,
  gsidate_pk: 'FILE#DATE',
  gsidate_sk: `${uploadDate}#${fileId}`,
  gsidown_pk: 'FILE#DOWN',
  gsidown_sk: `${String(0).padStart(10, '0')}#${fileId}`,
}
```

**Adding a new upload endpoint:**

1. Add Upload Lambda definition in `sam-app/template.yaml`
2. Add Upload Lambda handler in `sam-app/src/handlers/upload.mjs`
3. Add Registration Lambda in `terraform/aws-app/resources/modules/upload-queue/main.tf`
4. Add SQS queue + DLQ in `terraform/aws-app/resources/modules/upload-queue/main.tf`
5. Add S3 event notification in `terraform/aws-app/resources/modules/files/main.tf`
6. Add event source mapping (SQS → Registration Lambda) in `terraform/aws-app/resources/modules/upload-queue/main.tf`
7. Update `sam-app/resources.env` with queue name documentation
