# 0shared

**0shared** is a serverless file-sharing platform deployed directly to AWS.

---

## Architecture Overview

The system uses a serverless architecture for storage, routing, and backend processing.

### 1. Frontend Hosting (S3 & CloudFront)
The frontend is a React + Vite single-page application served as static files.
* **Frontend S3 Bucket** (`luidsonl-0shared-front`): Hosts static assets. Direct public access is blocked.
* **CloudFront Distribution**: Acts as a CDN to cache and serve the frontend application, and to route `/api/*` to API Gateway.
* **Security (OAC)**: Communication between CloudFront and the S3 bucket is secured using **Origin Access Control (OAC)**.

### 2. User File Storage (S3)
* **Files S3 Bucket** (`luidsonl-0shared-files`): Main storage for user files. Direct public access is blocked.
* **Direct Uploads via Pre-signed URLs**: The bucket supports direct browser-to-S3 uploads via CORS policies (`PUT`, `POST`, `GET`, `HEAD`). The backend generates Pre-signed URLs to authorize client uploads.

### 3. Database (DynamoDB)
The application uses Amazon DynamoDB with a **Single-Table Design** provisioned as `PAY_PER_REQUEST`.
* **Table**: `0shared`
* **Attributes**: `PK` (Partition Key), `SK` (Sort Key)
* **Global Secondary Indexes**: `FileIdIndex`, `NameSearch`, `UserFileDateIndex`, `UserFileNameIndex`, `UserFileDownloadIndex`, `UsernameIndex`, `SubIndex` (unused), `UploadDateIndex`, `DownloadCountIndex`

### 4. Backend & API (AWS SAM)
The backend is managed separately from Terraform using **AWS SAM**.
All API routes are served under the `/api` path prefix (e.g. `/api/auth/login`,
`/api/health`) so CloudFront can route them to API Gateway from one domain.

---

## Environments

### AWS

The Terraform infrastructure provisions all resources directly in AWS.

### Deploy

```bash
# Full deployment (first time — includes state bucket creation)
make deploy-full

# Regular deployment (skips state bucket)
make deploy
```

Or step by step:

```bash
# 1. Bootstrap — one-time S3 state bucket
cd terraform/aws-bootstrap && terraform init && terraform apply

# 2. Stateful infrastructure — DynamoDB + S3 + SQS + async Lambdas
cd terraform/aws-app && terraform init && terraform apply

# 3. Backend — API-triggered Lambdas + API Gateway
cd sam-app && make deploy

# 4. Frontend — S3 + CloudFront + build & upload
cd terraform/aws-frontend && terraform init && terraform apply
```

Or target just the backend (no manual parameters — `InterfaceLambdaName` is auto-derived from Terraform output, and the API Gateway redeploy workaround runs automatically):

```bash
# Backend only — API Lambdas + API Gateway
make backend

# After a backend destroy/recreate the API URL changes: repoint CloudFront
make frontend

# Teardown the backend stack only
make destroy-backend
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Core architecture, tooling, deployment, integration patterns |
| [Backend](docs/backend.md) | API endpoints, error handling |
| [Authentication](docs/auth.md) | Sessions, Bearer tokens, signup/login/logout |
| [File Upload](docs/file-upload.md) | Presigned URLs, multipart, S3 event → SQS → registration |
| [File Download](docs/file-download.md) | Presigned URLs, async counter, Lambda interface pattern |
| [Frontend](docs/frontend.md) | React SPA, CloudFront, build & deploy |
| [DynamoDB Schema](docs/dynamodb-schema.md) | Single-table design, entities, indexes, access patterns |
| [Architecture Manual](docs/architecture-manual.md) | Detailed architecture, design decisions, extension guide |


