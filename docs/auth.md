# Authentication — 0shared

## Overview

Authentication uses email + password with Bearer token sessions. Tokens are UUIDs stored in DynamoDB with a 7-day expiration. No third-party identity provider is used.

**Handler:** `sam-app/src/handlers/auth.mjs`
**Middleware:** `sam-app/src/handlers/middleware/auth.mjs`

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/signup` | No | Create new account |
| `POST` | `/api/auth/login` | No | Login, returns Bearer token |
| `POST` | `/api/auth/logout` | Yes | Invalidate current session |
| `GET` | `/api/auth/me` | Yes | Return current user info |

---

## Signup

**Request:**

```json
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "john",
  "password": "mypassword123"
}
```

**Response (201):**

```json
{
  "userId": "user_abc123",
  "email": "user@example.com",
  "username": "john"
}
```

**Validation rules:**
- `email`, `username`, `password` are all required
- Password must be at least 8 characters
- Email is stored lowercase

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing required fields or password < 8 characters |
| 409 | Email already registered |

**DynamoDB writes (atomic via transaction):**

| Entity | Key | Fields |
|--------|-----|--------|
| Profile | `PK=USER#{userId}, SK=PROFILE` | userId, email, username, passwordHash, createdAt |
| Email lookup | `PK=EMAIL#{email}, SK=METADATA` | userId |

---

## Login

**Request:**

```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response (200):**

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_abc123",
  "email": "user@example.com",
  "username": "john",
  "expiresAt": "2026-07-22T14:30:00.000Z"
}
```

**Flow:**
1. Look up user by email
2. Verify password with bcrypt
3. Create session (UUID token, 7-day TTL)
4. Return token + user info

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing email or password |
| 401 | Invalid email or password |

---

## Logout

**Request:**

```
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "Logged out"
}
```

**Flow:**
1. Validate Bearer token via middleware
2. Delete session from DynamoDB (both session entries)

**Errors:**

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid token |

---

## Get Current User (`/me`)

**Request:**

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "userId": "user_abc123",
  "email": "user@example.com",
  "username": "john",
  "createdAt": "2026-07-15T14:30:00.000Z"
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid token |
| 404 | User not found |

---

## Session Management

### Token Format

UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### Expiration

7 days from creation. Stored as ISO timestamp in DynamoDB (`expiresAt` field). The client should treat the token as expired after this time.

### DynamoDB Storage

Sessions are stored in two places (atomic write via transaction):

| Entity | Key | Purpose |
|--------|-----|---------|
| Session (lookup) | `PK=SESSION#{token}, SK=SESSION#{token}` | Look up session by token, get userId + expiresAt |
| User session | `PK=USER#{userId}, SK=SESSION#{token}` | Enable "list all sessions for a user" (future feature) |

### Bearer Token Validation

The `requireAuth` middleware (`sam-app/src/handlers/middleware/auth.mjs`):

1. Extracts token from `Authorization: Bearer <token>` header
2. Looks up session in DynamoDB by token
3. Checks `expiresAt` against current time
4. Returns session object or `null`

**Used by:** logout, me, upload endpoints.

---

## Password Hashing

- Algorithm: bcrypt
- Salt rounds: 10
- Library: `bcryptjs`

---

## DynamoDB Entities

| Entity | PK | SK | Description |
|--------|----|----|-------------|
| Profile | `USER#{userId}` | `PROFILE` | User profile (email, username, passwordHash, createdAt) |
| Email lookup | `EMAIL#{email}` | `METADATA` | Maps email → userId (enforces unique email) |
| Session | `SESSION#{token}` | `SESSION#{token}` | Session token (userId, expiresAt) |
| User session | `USER#{userId}` | `SESSION#{token}` | Links user to session (for future session listing) |

---

## See Also

- [Backend](./backend.md) — API structure, error handling conventions
- [Architecture](./architecture.md) — deployment, tooling
- [DynamoDB Schema](./dynamodb-schema.md) — full single-table design
