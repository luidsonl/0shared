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
# Deploy command
sam deploy --parameter-overrides \
  DynamoDBTableName=$(terraform -chdir=../terraform/aws-app output -raw dynamodb_table_name)
```

**Flow:**

```
Terraform apply ──► terraform -chdir=../terraform/aws-app output ──► SAM --parameter-overrides ──► Lambda env vars
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
Step 2 → exports table name + bucket name → consumed by Step 3 via --parameter-overrides
Step 3 → exports API URL                  → consumed by frontend at runtime
```

### Deploy Commands

```bash
# Step 1 — one-time
cd terraform/aws-bootstrap && terraform init && terraform apply

# Step 2 — DynamoDB, S3, CloudFront
cd terraform/aws-app && terraform init && terraform apply

# Step 3 — Lambda + API Gateway
cd sam-app
sam build
sam deploy --guided \
  --parameter-overrides \
    DynamoDBTableName=$(terraform -chdir=../terraform/aws-app output -raw table_name) \
    FilesBucketName=$(terraform -chdir=../terraform/aws-app output -raw files_bucket_name)
```

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

### Testing Auth Locally

```bash
# Signup
sam local invoke AuthFunction -e events/event-signup.json --env-vars env.json

# Login (copy the returned token)
sam local invoke AuthFunction -e events/event-login.json --env-vars env.json

# /auth/me with the token
# Edit events/event-me.json with the actual token, then:
sam local invoke AuthFunction -e events/event-me.json --env-vars env.json

# Logout
sam local invoke AuthFunction -e events/event-logout.json --env-vars env.json
```

Or run via local API Gateway:
```bash
sam local start-api --env-vars env.json --host 0.0.0.0

# In another terminal:
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"user","password":"secret123"}'
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
├── infra/
│   ├── aws-bootstrap/      # S3 bucket for Terraform state
│   │   ├── main.tf
│   │   ├── outputs.tf
│   │   └── providers.tf
│   └── aws-dev/            # Main infrastructure
│       ├── resources/
│       │   ├── main.tf         # Module wiring + frontend dist upload
│       │   ├── outputs.tf
│       │   ├── locals.tf
│       │   ├── variables.tf
│       │   └── modules/
│       │       ├── database/   # DynamoDB table
│       │       ├── files/      # S3 bucket for user files
│       │       └── frontend/   # S3 bucket + CloudFront + OAC
│       ├── backend.tf
│       ├── providers.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars
├── frontend/
│   ├── src/                  # React SPA
│   ├── vite.config.ts        # Dev proxy /api → :3000
│   └── package.json
├── docs/
│   ├── data-model.md         # DynamoDB schema documentation
│   └── architecture-manual.md
└── sam-app/                  # Lambda + API Gateway
    ├── template.yaml         # SAM template (functions, API, policies)
    ├── package.json
    ├── env.json               # Local environment variables
    ├── events/
    │   └── health-event.json  # Sample invocation event
    └── src/
        ├── lib/               # Shared clients (DynamoDB, S3)
        ├── middleware/        # Auth middleware (session validation)
        └── handlers/          # Lambda handlers
            ├── package.json   # "type": "module" for ESM
            ├── health.mjs     # GET /health handler
            └── auth.mjs       # POST /auth/*, GET /auth/me
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
