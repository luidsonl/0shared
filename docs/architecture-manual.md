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
|---|---|
| `terraform/bootstrap/` | S3 bucket for state files, DynamoDB table for state locking |
| `terraform/app/` | DynamoDB tables, SSM parameters |
| `terraform/frontend/` | S3 bucket for static files, CloudFront distribution, OAC |

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

Terraform reads the export using a data source:

```hcl
# terraform/frontend/main.tf
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
  DynamoDBTableName=$(terraform -chdir=../terraform/app output -raw dynamodb_table_name)
```

**Flow:**

```
Terraform apply ──► terraform output ──► SAM --parameter-overrides ──► Lambda env vars
```

---

## Deployment Order

```
 1. terraform/bootstrap/     (one-time)
 2. terraform/app/           (DynamoDB)
 3. sam-app/                 (Lambda + API Gateway)
 4. terraform/frontend/      (S3 + CloudFront + frontend build)
```

Dependencies between steps:

```
Step 2 → exports table name → consumed by Step 3
Step 3 → exports API URL    → consumed by Step 4
Step 4 → builds frontend     → uploads to S3 → invalidates CloudFront
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
- No additional auth is configured (for demo purposes)
- In production, add Lambda authorizer, Cognito, or API key

---

## Project Structure

```
├── terraform/
│   ├── bootstrap/
│   │   ├── main.tf         # S3 bucket + DynamoDB lock table
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── app/
│   │   ├── main.tf         # Provider + backend config
│   │   ├── dynamodb.tf     # DynamoDB table + SSM parameters
│   │   ├── variables.tf    # billing_mode, PITR, environment
│   │   └── outputs.tf      # table name, ARN, SSM paths
│   └── frontend/
│       ├── main.tf         # S3 + CloudFront + OAC + deploy
│       ├── variables.tf
│       └── outputs.tf
├── frontend/
│   ├── src/App.tsx         # React SPA (list + create items)
│   ├── vite.config.ts      # Dev proxy /api → :3000
│   └── package.json
├── docs/
│   ├── data-model.md       # DynamoDB schema documentation
│   └── architecture-manual.md
└── sam-app/
    ├── template.yaml       # Lambda functions + REST API
    ├── src/handlers/       # Business logic (Node.js ESM)
    ├── events/             # Sample invocation events
    ├── __tests__/          # Unit tests (Jest)
    └── env.json            # Local environment variables
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **REST API over HTTP API** | `sam local start-api` has better support for REST API (`Type: Api`) |
| **CloudFront over direct API** | Single domain for frontend + API, no CORS needed |
| **Relative API paths** (`/api/items`) | Same code works in dev (Vite proxy) and prod (CloudFront) |
| **Two Terraform directories** | Avoids coupling bootstrap (one-time) with app (iterative) |
| **CloudFormation Export** | Cleanest way to pass values from SAM to Terraform without SSM costs |
| **`null_resource` for deploy** | Frontend build + upload + invalidation in a single `terraform apply` |

---

## Clean Up Order

```bash
terraform/frontend/ destroy    # CloudFront + S3 + frontend files
sam delete                     # Lambda + API Gateway
terraform/app/ destroy         # DynamoDB table
terraform/bootstrap/ destroy   # State bucket + lock table (optional)
```

Dependencies flow forward, so destroy must happen in reverse.

---

## Extending This Architecture

### Adding a New Lambda

1. Add a new handler in `sam-app/src/handlers/`
2. Add a new resource in `sam-app/template.yaml` with `Type: AWS::Serverless::Function` and an `Api` event
3. Add a new path in `terraform/frontend/main.tf` → `ordered_cache_behavior` if needed

### Adding a New DynamoDB Table

1. Add a new `aws_dynamodb_table` resource in `terraform/app/dynamodb.tf`
2. Export the table name as a Terraform output
3. Pass it to SAM via `--parameter-overrides`
4. Add IAM permissions in SAM (`DynamoDBCrudPolicy`)

### Adding Authentication

1. Create a Cognito User Pool in Terraform (`terraform/app/`)
2. Export the User Pool ID and App Client ID
3. Add a Cognito authorizer in SAM (`template.yaml`)
4. Configure CloudFront to forward auth headers to API Gateway
