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
```

---

## Project Structure

```
├── terraform/
│   ├── aws-bootstrap/     # S3 bucket for Terraform state (one-time)
│   ├── aws-app/           # DynamoDB table + S3 files bucket (stateful infra)
│   └── aws-frontend/      # S3 static bucket + CloudFront + OAC + deploy
├── frontend/              # React + Vite SPA (src/App.tsx, vite.config.ts)
├── docs/
│   ├── architecture-manual.md
│   └── dynamodb-schema.md
└── sam-app/               # Lambda + API Gateway (stateless compute)
    ├── template.yaml      # SAM template (functions, API, policies, exports)
    ├── samconfig.toml     # SAM config (stack name, parameter overrides)
    ├── resources.env      # Central resource names (source of truth)
    ├── Makefile           # Convenience targets (deploy, test, clean)
    ├── env.json           # Local environment variables
    ├── scripts/clean.sh    # Clean DynamoDB + S3
    ├── tests/integration/ # HTTP integration tests (mocha + chai)
    └── src/handlers/      # Lambda code (Node.js ESM)
```

---

## Tooling Strategy

### Terraform — Infrastructure as Code

Terraform manages all **stateful, long-lived infrastructure**:

| Resource | Responsibility |
|---|---|
| `terraform/aws-bootstrap/` | S3 bucket for Terraform state |
| `terraform/aws-app/` | DynamoDB table, S3 files bucket (CORS for direct uploads) |
| `terraform/aws-frontend/` | S3 static bucket, CloudFront distribution, OAC, frontend deploy |

**Why Terraform for these?**
- DynamoDB tables are stateful — deleting and recreating them loses data.
- S3 buckets and CloudFront are foundational infrastructure.
- Terraform's `prevent_destroy` lifecycle protects critical resources.
- State can be shared across a team via the S3 backend.

### AWS SAM — Application Layer

SAM manages **stateless, ephemeral compute**:

| Resource | Responsibility |
|---|---|
| `template.yaml` | Lambda functions, API Gateway (REST API) |
| `src/handlers/` | Business logic (Node.js 22 ESM) |

**Why SAM for these?**
- Lambda functions are code that changes frequently.
- API Gateway is tightly coupled to Lambda routing.
- SAM provides a simpler syntax for Lambda + API Gateway than raw CloudFormation.
- `sam local start-api` enables local testing.

---

## Resource Name Centralization

### Derivation Chain

```
terraform/aws-app/terraform.tfvars     sam-app/resources.env (final values)
─────────────────────────────         ─────────────────────────────
namespace=luidsonl                      │
project_name=0shared                    │
environment=""                          │
table_suffix=""                         ├── DYNAMODB_TABLE = 0shared
files_bucket_suffix="-files"            ├── FILES_BUCKET   = luidsonl-0shared-files
                                        │
terraform/aws-frontend/terraform.tfvars │
front_bucket_suffix="-front"            ├── S3 frontend   = luidsonl-0shared-front
oac_name_suffix="-s3-oac"               ├── OAC           = 0shared-s3-oac
```

**Naming formula:**

| Resource | Formula | Example |
|----------|---------|---------|
| DynamoDB table | `{project_name}{env_under}{table_suffix}` | `0shared` |
| Files S3 bucket | `{namespace}-{project_name}{env_dash}{files_bucket_suffix}` | `luidsonl-0shared-files` |
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
 1. terraform/aws-bootstrap/   (one-time S3 state bucket, lock table)
 2. terraform/aws-app/        (DynamoDB table + S3 files bucket)
 3. sam-app/                  (Lambda + API Gateway, exports ApiEndpoint)
 4. terraform/aws-frontend/   (S3 + CloudFront + frontend build & upload)
```

Dependencies between steps:

```
Step 2 → table/bucket names defined in Terraform
Step 3 → reads table/bucket names from samconfig.toml, deploys Lambda + API Gateway
Step 3 → exports API URL (sam-app-ApiEndpoint) → consumed by Step 4
Step 4 → reads the export, builds the SPA, uploads to S3, invalidates CloudFront
```

### Deploy Commands

```bash
# Step 1 — one-time (S3 state bucket)
cd terraform/aws-bootstrap && terraform init && terraform apply

# Step 2 — DynamoDB table + S3 files bucket
cd terraform/aws-app && terraform init && terraform apply

# Step 3 — Lambda + API Gateway (exports sam-app-ApiEndpoint)
cd sam-app && sam build && sam deploy

# Step 4 — S3 + CloudFront + frontend build/upload
cd terraform/aws-frontend && terraform init && terraform apply
```

> `sam deploy` reads resource names from `samconfig.toml`, whose `parameter_overrides`
> must match `resources.env`. The `aws-frontend` apply blocks until the SAM export exists.

---

## Data Flow (Production)

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

---

## Clean Up Order

```bash
terraform/aws-frontend destroy   # CloudFront + S3 + frontend files
sam delete                       # Lambda + API Gateway
terraform/aws-app destroy        # DynamoDB table + files bucket
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

**Flow:** Login → bcrypt verify → create session in DynamoDB → return `{ token }`. Each protected call reads `SESSION#<token>` to validate. Logout deletes both `SESSION#<token>` records.

**Dependencies:** `bcryptjs` (pure-JS bcrypt), `@aws-sdk/lib-dynamodb` (DocumentClient).
