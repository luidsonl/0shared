# Architecture Manual — Serverless CRUD with Terraform + SAM

## Overview

This document describes the architecture, tooling decisions, and integration patterns used in this project. It serves as a reference for building similar serverless applications with a clear separation between infrastructure (Terraform) and application (AWS SAM) layers.

---

## Architecture Diagram

```
                         CloudFront
                        ┌──────────┐
                        │  CDN     │
                        └────┬─────┘
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              ┌──────────┐    ┌──────────────┐
              │ S3       │    │ API Gateway  │
              │ (static) │    │ (REST API)   │
              └──────────┘    └──────┬───────┘
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

## Resource Name Centralization

### Problem

Resource names (DynamoDB table, S3 bucket, SAM stack) are scattered across `samconfig.toml`, `env.json`, `clean.sh`, and Terraform. A typo or mismatch between them causes runtime failures.

### Derivation Chain

```
terraform.tfvars                          sam-app/resources.env (final values)
────────────────────                     ─────────────────────────────
namespace=luidsonl                        │
project_name=0shared                      │
environment=""                            │
table_suffix=""                           ├── DYNAMODB_TABLE = 0shared
files_bucket_suffix="-files"              ├── FILES_BUCKET   = luidsonl-0shared-files
front_bucket_suffix="-front"              │
oac_name_suffix="-s3-oac"                 │
                                          │
  ┌─ locals.tf ──────────────────┐        │
  │  env_dash  = ""              │        │
  │  env_under = ""              │        │
  │  name_prefix = "0shared"     │        │
  │  full_prefix = "luidsonl-0shared"│     │
  └──────────────────────────────┘        │
                                          │
  ┌─ resources/main.tf ───────────┐       │
  │  table  = 0shared + "" + ""   │───────┘
  │  files  = luidsonl-0shared + -files   │
  │  front  = luidsonl-0shared + -front   │
  └──────────────────────────────┘        │
```

**Naming formula:**

| Resource | Formula | Example |
|----------|---------|---------|
| DynamoDB table | `{project_name}{env_under}{table_suffix}` | `0shared` |
| Files S3 bucket | `{namespace}-{project_name}{env_dash}{files_bucket_suffix}` | `luidsonl-0shared-files` |
| Frontend S3 bucket | `{namespace}-{project_name}{env_dash}{front_bucket_suffix}` | `luidsonl-0shared-front` |
| CloudFront OAC | `{project_name}{env_dash}{oac_name_suffix}` | `0shared-s3-oac` |
| SAM stack | `{project_name}-backend` (hardcoded in `samconfig.toml`) | `app-0shared-backend` |

### How each file consumes the names

| File | Consumption |
|------|-----------|
| `terraform/aws-app/terraform.tfvars` | Defines `namespace`, `project_name`, `environment`, and the four `*_suffix` variables |
| `terraform/aws-app/resources/main.tf` | Constructs full names from `locals` + `var.*_suffix` |
| `sam-app/resources.env` | Documents the final derived names (must match Terraform output) |
| `sam-app/samconfig.toml` | Hardcoded values with `# Must match resources.env` comments |
| `sam-app/env.json` | Hardcoded values (keep in sync manually — JSON has no variables) |
| `sam-app/scripts/clean.sh` | `source resources.env` for defaults; CLI flags override |
| `sam-app/Makefile` | `include resources.env` — targets inherit names as env vars |

### Changing resource names (new environment)

1. Edit `terraform/aws-app/terraform.tfvars` with new prefix/suffix values
2. Run `terraform apply` to create the new infrastructure
3. Copy the resulting names to `sam-app/resources.env`
4. Update `sam-app/samconfig.toml` parameter_overrides to match
5. Update `sam-app/env.json` to match
6. Run `make deploy`

---

## Tooling Strategy

### Terraform — Infrastructure as Code

Terraform manages all **stateful, long-lived infrastructure**:

| Resource | Responsibility |
|---|---|---|
| `terraform/aws-bootstrap/` | S3 bucket for Terraform state |
| `terraform/aws-app/` | DynamoDB tables, S3 buckets (files + frontend), CloudFront distribution, OAC |

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

## Integration Between Terraform and SAM

### The Problem

Terraform and SAM deploy independently. Terraform doesn't know about SAM resources and vice versa. But they need to share information — for example, Lambda functions need to know the DynamoDB table name.

### Solution: CloudFormation Exports + Data Sources

SAM exports resource values as CloudFormation exports:

```yaml
# sam-app/template.yaml
Outputs:
  ApiEndpoint:
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod"
    Export:
      Name: sam-app-ApiEndpoint
```

Terraform reads the export using a data source in the frontend module:

```hcl
# terraform/aws-app/resources/modules/frontend/main.tf
data "aws_cloudformation_export" "api_url" {
  name = "sam-app-ApiEndpoint"
}
```

**Flow:**

```
SAM deploy ──► CloudFormation Export ──► Terraform data source ──► CloudFront origin
```

### Passing Parameters Down

For values flowing the other direction (Terraform → SAM), use SAM parameters:

```yaml
# sam-app/template.yaml
Parameters:
  DynamoDBTableName:
    Type: String
```

```bash
# Deploy command (dev)
sam build && sam deploy
```

**Flow:**

```
samconfig.toml ──► SAM --parameter-overrides ──► Lambda env vars
```

Os valores de `DynamoDBTableName` e `FilesBucketName` ficam no `sam-app/samconfig.toml`. Para outro ambiente, sobrescreva na linha de comando:

```bash
sam deploy --parameter-overrides \
  DynamoDBTableName=staging_table \
  FilesBucketName=staging-bucket
```

---

## Deployment Order

```
 1. terraform/aws-bootstrap/     (one-time S3 state bucket)
 2. terraform/aws-app/           (DynamoDB, S3 buckets, CloudFront, frontend dist)
 3. sam-app/                 (Lambda + API Gateway)
```

Dependencies between steps:

```
Step 2 → DynamoDB table + S3 buckets created (names defined in Terraform)
Step 3 → reads table/bucket names from samconfig.toml, deploys Lambda + API Gateway
Step 3 → exports API URL → consumed by frontend at runtime
```

### Deploy Commands

```bash
# Step 1 — one-time (S3 state bucket)
cd terraform/aws-bootstrap && terraform init && terraform apply

# Step 2 — DynamoDB, S3, CloudFront
cd terraform/aws-app && terraform init && terraform apply

# Step 3 — Lambda + API Gateway
cd sam-app && make deploy
```

> `make deploy` runs `sam build && sam deploy`, reading resource names from `resources.env` (via `samconfig.toml`, which references the env file in comments).

---

## Data Flow (Production)

```
User ──► https://cloudfront.net/
                │
                ├── /api/items/* ──► CloudFront origin "api-gateway"
                │                       │
                │                       └── /Prod/api/items ──► API Gateway ──► Lambda ──► DynamoDB
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
// vite.config.ts
server: { proxy: { '/api': 'http://localhost:3000' } }
```

SAM local API runs at `http://localhost:3000` and invokes Lambda functions locally:

```bash
sam local start-api --env-vars env.json --host 0.0.0.0
```

### Production

The frontend is built with `npm run build` and uploaded to S3. CloudFront serves:
- Static files (`/*`) from the S3 origin
- API requests (`/api/*`) from the API Gateway origin

The frontend always uses **relative paths** (`/api/items`). In dev, Vite proxies them. In production, CloudFront routes them. No environment-specific configuration is needed in the frontend code.

---

## Local Development Workflow

```
Terminal 1:     sam local start-api        (Lambda + API Gateway on :3000)
Terminal 2:     npm run dev                (Vite on :5173, proxies /api → :3000)
Terminal 3:     (optional) aws dynamodb    (interact directly with DynamoDB)
                put-item / scan / etc.
```

### Integration Tests

Tests rodam contra a API real (local ou AWS) via HTTP, sem mocks.

```bash
# Terminal 1 — inicia a API local
cd sam-app && make start-api

# Terminal 2 — roda os 12 testes (health + auth)
cd sam-app && make test

# Opcional — limpa os dados gerados pelos testes
cd sam-app && make clean
```

Contra a AWS (após deploy):

```bash
make test-aws
# ou manualmente:
API_ENDPOINT=https://d2u9723h1u8hu2.cloudfront.net/api npm test
```

A variável `API_ENDPOINT` (default `http://127.0.0.1:3000`) é lida em `tests/integration/helpers.mjs`. O `Makefile` injeta via env var.

### Clean Script

Limpa DynamoDB + S3. Útil entre execuções de teste. Lê defaults do `resources.env`.

```bash
cd sam-app && make clean                  # limpa tudo (usa resources.env)
cd sam-app && ./scripts/clean.sh --dry-run # só mostra o que seria apagado
```

---

## Security Considerations

### S3 Bucket

- Public access blocked (`block_public_acls`, `block_public_policy`, etc.)
- Only CloudFront can read objects (via Origin Access Control + bucket policy)
- Bucket policy restricts `s3:GetObject` to the specific CloudFront distribution

### CloudFront

- OAC (Origin Access Control) is used instead of legacy OAI
- Viewer protocol policy: `redirect-to-https`
- API requests are forwarded with `CachingDisabled` policy (no caching of dynamic data)

### API Gateway

- REST API is deployed with public endpoint
- Auth routes (`/auth/*`) are publicly accessible
- Protected routes validate session via Bearer token lookup in DynamoDB

---

## Project Structure

```
├── terraform/
│   ├── aws-bootstrap/        # S3 bucket for Terraform state
│   └── aws-app/              # DynamoDB, S3, CloudFront
├── frontend/                 # React + Vite
├── docs/                     # Schema + architecture docs
└── sam-app/                  # Lambda + API Gateway
    ├── template.yaml         # SAM template (functions, API, policies)
    ├── samconfig.toml        # SAM config (stack name, parameter overrides)
    ├── resources.env         # Central resource names (source of truth)
    ├── Makefile              # Convenience targets (deploy, test, clean)
    ├── package.json          # Test runner (mocha + chai)
    ├── env.json               # Local environment variables
    ├── scripts/
    │   └── clean.sh           # Clean DynamoDB + S3
    ├── tests/
    │   └── integration/
    │       ├── helpers.mjs    # Fetch wrapper (Bearer token, JSON parse)
    │       ├── health.test.mjs
    │       └── auth.test.mjs  # 11 tests covering full auth flow
    └── src/
        └── handlers/          # Lambda code (deployed to AWS)
            ├── package.json   # Lambda dependencies
            ├── .npmignore     # Excludes tests from deployment
            ├── health.mjs     # GET /health
            ├── auth.mjs       # POST /auth/*, GET /auth/me
            ├── lib/
            │   └── dynamo-client.mjs  # DocumentClient helpers
            └── middleware/
                └── auth.mjs   # Session validation (Bearer → DynamoDB lookup)
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **REST API over HTTP API** | `sam local start-api` has better support for REST API (`Type: Api`) |
| **CloudFront over direct API** | Single domain for frontend + API, no CORS needed |
| **Relative API paths** (`/api/items`) | Same code works in dev (Vite proxy) and prod (CloudFront) |
| **Single Terraform config** | Bootstrap (one-time) lives in `terraform/aws-bootstrap/`; all app infra lives together in `terraform/aws-app/` |
| **CloudFormation Export** | Cleanest way to pass values from SAM to Terraform without SSM costs |
| **`aws_s3_object` for deploy** | Frontend dist uploads + CloudFront invalidation in a single `terraform apply` |

---

## Clean Up Order

```bash
cd terraform/aws-app && terraform destroy   # CloudFront + S3 + DynamoDB + frontend files
sam delete                              # Lambda + API Gateway
cd terraform/aws-bootstrap && terraform destroy  # State bucket (optional)
```

Dependencies flow forward, so destroy must happen in reverse.

---

## Extending This Architecture

### Adding a New Lambda

1. Add a new handler in `sam-app/src/handlers/`
2. Add a new resource in `sam-app/template.yaml` with `Type: AWS::Serverless::Function` and an `Api` event
3. Add a new cache behavior in `terraform/aws-app/resources/modules/frontend/main.tf` → `ordered_cache_behavior` if needed

### Adding a New DynamoDB Table

1. Add a new `aws_dynamodb_table` resource in `terraform/aws-app/resources/modules/database/main.tf`
2. Export the table name as a Terraform output
3. Pass it to SAM via `--parameter-overrides`
4. Add IAM permissions in SAM (`DynamoDBCrudPolicy`)

### Adding Authentication

Auth is implemented as a stateful session system using DynamoDB.

**Data model (single-table):**

| PK | SK | Purpose |
|----|----|---------|
| `USER#<id>` | `PROFILE` | User data (email, username, passwordHash) |
| `EMAIL#<email>` | `METADATA` | Reverse lookup: email → userId |
| `SESSION#<token>` | `SESSION#<token>` | Session with expiry (7 days) |
| `USER#<id>` | `SESSION#<token>` | User's active sessions list |

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | No | Create account (email + username + password) |
| POST | `/auth/login` | No | Sign in, returns Bearer token |
| POST | `/auth/logout` | Bearer | Destroy session |
| GET | `/auth/me` | Bearer | Get current user profile |

**Flow:** Login → bcrypt verify → create session in DynamoDB → return `{ token }`. Each protected call reads `SESSION#<token>` to validate. Logout deletes both `SESSION#<token>` records.

**Dependencies:** `bcryptjs` (pure-JS bcrypt), `@aws-sdk/lib-dynamodb` (DocumentClient).
