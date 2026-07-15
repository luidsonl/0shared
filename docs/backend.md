# Backend — 0shared

## Overview

The backend is a set of stateless Lambda functions deployed via AWS SAM and exposed through a REST API Gateway. Each endpoint is implemented as a single Lambda handler. The API is served under the `/api` path prefix.

---

## API Endpoints

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| `GET` | `/api/health` | `health.mjs` | No | Health check — returns `{ status: "ok" }` |
| `POST` | `/api/auth/signup` | `auth.mjs` | No | Create new account |
| `POST` | `/api/auth/login` | `auth.mjs` | No | Login with email + password |
| `POST` | `/api/auth/logout` | `auth.mjs` | Yes | Invalidate session |
| `GET` | `/api/auth/me` | `auth.mjs` | Yes | Return current user info |
| `POST` | `/api/upload` | `upload.mjs` | Yes | Generate presigned S3 upload URL |
| `GET` | `/api/download/:fileId` | `download.mjs` | No | Generate presigned S3 download URL |

---

## Environment Variables

All Lambda functions receive the same environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `DYNAMODB_TABLE_NAME` | `resources.env` → `samconfig.toml` → `template.yaml` → `template.json` → `env.json` | DynamoDB table name |
| `FILES_BUCKET_NAME` | `resources.env` → `samconfig.toml` → `template.yaml` → `template.json` → `env.json` | S3 bucket for uploaded files |
| `INTERFACE_LAMBDA_NAME` | Terraform output → `samconfig.toml` → `template.yaml` → `template.json` → `env.json` | Download interface Lambda name (Terraform-managed) |

For local development, values are in `sam-app/env.json`. For production, they are injected via SAM parameters during deploy.

---

## Error Handling

Errors return a consistent JSON format:

```json
{
  "statusCode": 400,
  "body": {
    "message": "Invalid email or password"
  }
}
```

### Common Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Validation error (missing fields, invalid format) |
| 401 | Authentication required (missing/invalid/expired Bearer token) |
| 403 | Authorization failed (not the resource owner) |
| 404 | Resource not found |
| 409 | Conflict (e.g., email already registered) |
| 413 | File size exceeds 1 GB limit |
| 415 | Unsupported file type |
| 500 | Internal server error |

---

## Health Check

**Endpoint:** `GET /api/health`

**Response:**

```json
{
  "status": "ok"
}
```

**Testing:**

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

---

## Response Format Conventions

**Success responses** return the relevant data directly in the body:

```json
{
  "message": "Login successful",
  "user": { "id": "user_abc123", "email": "test@example.com" }
}
```

**Error responses** follow the `message` field pattern shown above.

**No wrapper envelope** — API responses do not use a `{ success, data, error }` wrapper.

---

## See Also

- [Authentication](./auth.md) — signup, login, logout, session management
- [File Upload](./file-upload.md) — presigned URL generation, S3 upload, registration
- [File Download](./file-download.md) — presigned URL generation, download counter
- [Architecture](./architecture.md) — deployment, tooling, infrastructure
