# Architecture — 0shared

## Overview

0shared is a serverless file-sharing platform deployed on AWS. It uses a split tooling strategy: **Terraform** for stateful infrastructure and **AWS SAM** for stateless API-triggered Lambda functions.

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
  Client ◄── presigned URL ────────────────────────────────┘
      │
      ▼ (direct PUT to S3)
  ┌──────────┐
  │ S3       │
  │ (files)  │──► S3 Event ──► SQS Queue ──► Registration Lambda ──► DynamoDB
  └──────────┘                                                     (File entity)

Download flow (presigned URL + Lambda interface):

  Client ──► GET /api/download/{fileId} ──► Download Lambda ──► presigned GET URL
                                                                     │
  Client ◄── presigned URL ─────────────────────────────────────────┘
      │
      ▼ (direct GET from S3)
  ┌──────────┐
  │ S3       │
  │ (files)  │
  └──────────┘

  Meanwhile: Download Lambda ──(async invoke)──► Interface Lambda ──► SQS ──► Counter Lambda ──► DynamoDB
```

---

## Project Structure

```
├── terraform/
│   ├── aws-bootstrap/     # S3 bucket for Terraform state (one-time)
│   ├── aws-app/           # DynamoDB table + S3 files bucket + SQS queues + Lambdas
│   │   └── src/           # Lambda source: register-upload.mjs, register-download.mjs, invoke-download-counter.mjs
│   └── aws-frontend/      # S3 static bucket + CloudFront + OAC + deploy
├── frontend/              # React + Vite SPA (src/App.tsx, vite.config.ts)
├── agents.md
├── docs/
│   ├── architecture.md    # This file
│   ├── backend.md         # API structure, endpoints, health check
│   ├── auth.md            # Authentication system
│   ├── file-upload.md     # File upload flow
│   ├── file-download.md   # File download flow
│   └── dynamodb-schema.md # Single-table design, entities, indexes
└── sam-app/               # API Gateway + API-triggered Lambda (stateless compute)
    ├── template.yaml      # SAM template (health, auth, upload, download functions + API)
    ├── samconfig.toml     # SAM config (stack name, parameter overrides)
    ├── resources.env      # Central resource names (source of truth)
    ├── Makefile           # Convenience targets (deploy, test, clean)
    ├── env.json           # Local environment variables
    ├── scripts/clean.sh   # Clean DynamoDB + S3
    ├── tests/integration/ # HTTP integration tests (mocha + chai)
    └── src/handlers/      # Lambda code (Node.js ESM)
        ├── health.mjs     # Health check endpoint (SAM)
        ├── auth.mjs       # Signup, login, logout, me (SAM)
        ├── upload.mjs     # Generate presigned upload URL (SAM)
        ├── download.mjs   # Generate presigned download URL (SAM, invokes interface Lambda)
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
| `terraform/aws-app/` | DynamoDB table, S3 files bucket (CORS + event notification), SQS upload queue + DLQ, SQS download queue + DLQ, registration Lambda, download interface Lambda, download counter Lambda, event source mappings |
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
| `template.yaml` | Lambda functions (health, auth, upload, download), API Gateway (REST API) |
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
  InterfaceLambdaName:
    Type: String
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
 2. terraform/aws-app/        (DynamoDB + S3 + SQS queues + registration/download-counter Lambdas + event source mappings)
 3. sam-app/                  (API-triggered Lambdas + API Gateway, exports ApiEndpoint)
 4. terraform/aws-frontend/   (S3 + CloudFront + frontend build & upload)
```

Dependencies between steps:

```
Step 2 → all stateful infra: DynamoDB table, S3 files bucket, SQS queues, DLQs,
         registration/download-counter Lambdas (SQS-triggered), S3 event notification,
         event source mappings, FileIdIndex GSI
Step 3 → reads table/bucket names from samconfig.toml, deploys API-triggered Lambdas,
         fetches download interface Lambda name from Terraform output
Step 3 → exports API URL (sam-app-ApiEndpoint) → consumed by Step 4
Step 4 → reads the export, builds the SPA, uploads to S3, invalidates CloudFront
```

### Deploy Commands

```bash
# Full deployment (orchestrated via Makefile)
make deploy

# Or step by step:
cd terraform/aws-bootstrap && terraform init && terraform apply    # Step 1
cd terraform/aws-app && terraform init && terraform apply          # Step 2
cd sam-app && make deploy                                          # Step 3
cd terraform/aws-frontend && terraform init && terraform apply     # Step 4
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

### SQS (download queue)

- Dead-letter queue (DLQ) catches failed counter updates (14-day retention)
- Main queue visibility timeout: 4 minutes
- Only the Counter Lambda has `sqs:ReceiveMessage` permissions

### CloudFront

- OAC (Origin Access Control) is used instead of legacy OAI
- Viewer protocol policy: `redirect-to-https`
- API requests (`/api/*`) use the `CachingDisabled` cache policy (no caching of dynamic data)

### API Gateway

- REST API is deployed with a public endpoint
- Auth routes (`/api/auth/*`) are publicly accessible
- Protected routes validate the session via a Bearer token lookup in DynamoDB

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
| **Download counter via Lambda interface** | SAM = storefront only; Terraform = all async processing. Clean separation of concerns |
| **FileIdIndex GSI** | Enables public download URLs by fileId without knowing the owner |
| **No auth on download** | Files are shared publicly via fileId; owner controls access via file deletion |
| **Async Lambda invoke** | Fire-and-forget pattern keeps download response fast; SQS handles retry/DLQ |

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

1. Add a new handler in `sam-app/src/handlers/` (for API-triggered) or `terraform/aws-app/src/` (for async processing)
2. Add a new resource in `sam-app/template.yaml` with `Type: AWS::Serverless::Function` and an `Api` event (path under `/api/*`)
3. If a new top-level path is needed, add an `ordered_cache_behavior` in `terraform/aws-frontend/main.tf`
4. For async processing, create an interface Lambda in Terraform that SAM can invoke with `InvocationType: Event`

### Adding a New DynamoDB Table

1. Add a new `aws_dynamodb_table` resource in `terraform/aws-app/resources/modules/database/main.tf`
2. Export the table name as a Terraform output
3. Pass it to SAM via `--parameter-overrides`
4. Add IAM permissions in SAM (`DynamoDBCrudPolicy`)
