# DynamoDB Schema - Single-Table Design

**Table:** `0shared_data`
**Billing:** PAY_PER_REQUEST

---

## Keys

| Key | Type | Description |
|-----|------|-------------|
| `PK` | HASH | `{ENTITY}#{entity_id}` - partition |
| `SK` | RANGE | Item identifier within the partition |

---

## Entities

### User

Each user gets a **stable internal ID** (UUID v7, generated at signup). The username can change without affecting file ownership.

| Attribute | Type | Source |
|-----------|------|--------|
| user_id | string (UUID v7) | Generated at signup |
| sub | string | Cognito |
| email | string | Cognito |
| username | string | Defined at signup, mutable |
| username_lower | string | Lowercase of `username`, for GSI lookup |
| display_name | string | Optional, PUT /auth/me |
| avatar_url | string | PUT /auth/me |
| bio | string | PUT /auth/me |
| created_at | string (ISO) | auto |
| updated_at | string (ISO) | auto |

#### Keys

| PK | SK |
|----|----|
| `USER#{user_id}` | `USER#PROFILE` |

### File

Owned by a user's stable ID - survives username changes.

| Attribute | Type |
|-----------|------|
| file_id | string (UUID v7) |
| owner_user_id | string (UUID v7) - stable owner reference |
| owner_username | string - denormalized for display (stale on rename; refresh on list) |
| name | string |
| name_lower | string - lowercase, for name search |
| size | number (bytes) |
| content_type | string |
| upload_date | string (ISO) |
| download_count | number |

#### Keys

| PK | SK |
|----|----|
| `USER#{owner_user_id}` | `FILE#{file_id}` |

---

## Indexes

### SubIndex - Lookup user by Cognito sub

| Key | Type | Value | Projection |
|-----|------|-------|------------|
| `sub` | HASH | Cognito `sub` value | `INCLUDE` (user_id, username) |

Returns enough data to identify the user without a second fetch.

| sub | SK | user_id | username |
|-----|-----|---------|----------|
| abc123 | USER#PROFILE | uuid-1 | joaosilva |

### UsernameIndex - Lookup user by username

| Key | Type | Value | Projection |
|-----|------|-------|------------|
| `username_lower` | HASH | Lowercase username | `KEYS_ONLY` |

One extra `GetItem` after the lookup, but keeps the PK decoupled from the username.

| username_lower | SK |
|----------------|-----|
| joaosilva | USER#uuid-1 |
| mariacosta | USER#uuid-2 |

### NameSearch - Search users and files by name

| Key | Type | Value | Projection |
|-----|------|-------|------------|
| `gsiname_pk` | HASH | `NAME#USER` or `NAME#FILE#{shard}` | `KEYS_ONLY` |
| `gsiname_sk` | RANGE | `{name_lower}#{entity_id}` |

File names are sharded by first character hex (`NAME#FILE#6a`, `NAME#FILE#72`) to avoid a single hot partition.

| gsiname_pk | gsiname_sk |
|------------|------------|
| NAME#USER | joaosilva#uuid-1 |
| NAME#USER | mariacosta#uuid-2 |
| NAME#FILE#72 | relatorio.pdf#file-uuid |
| NAME#FILE#66 | foto.png#file-uuid |

### UploadDateIndex - Files by upload date

| Key | Type | Value | Projection |
|-----|------|-------|------------|
| `gsidate_pk` | HASH | `FILE#DATE` | `KEYS_ONLY` |
| `gsidate_sk` | RANGE | `{upload_date}#{file_id}` |

| gsidate_pk | gsidate_sk |
|------------|------------|
| FILE#DATE | 2026-06-18T10:30:00Z#file-uuid |
| FILE#DATE | 2026-06-18T14:20:00Z#file-uuid |

### DownloadCountIndex - Files by popularity

| Key | Type | Value | Projection |
|-----|------|-------|------------|
| `gsidown_pk` | HASH | `FILE#DOWN` | `KEYS_ONLY` |
| `gsidown_sk` | RANGE | `{download_count_padded}#{file_id}` |

| gsidown_pk | gsidown_sk |
|------------|------------|
| FILE#DOWN | 0000000042#file-uuid |
| FILE#DOWN | 0000000128#file-uuid |

> `download_count` must be stored zero-padded to 10 digits (e.g., `0000000042`) for correct lexicographic ordering.

---

## Access Patterns

| # | Query | Index | Key Condition |
|---|-------|-------|---------------|
| 1 | Get user by username | UsernameIndex | `username_lower = {lower(username)}` → `get_item(PK=USER#{user_id}, SK=USER#PROFILE)` |
| 2 | Get user by Cognito sub | SubIndex | `sub = {sub}` |
| 3 | List user's files | -- | `query(PK=USER#{user_id}, begins_with(SK, FILE#))` |
| 4 | List all users | NameSearch | `gsiname_pk = NAME#USER` |
| 5 | Search users by username | NameSearch | `gsiname_pk = NAME#USER, begins_with(gsiname_sk, {prefix})` |
| 6 | Search files by name | NameSearch | `gsiname_pk = NAME#FILE#{shard}, begins_with(gsiname_sk, {prefix})` |
| 7 | Filter files by date | UploadDateIndex | `gsidate_pk = FILE#DATE, between({start}, {end})` |
| 8 | Top downloaded files | DownloadCountIndex | `gsidown_pk = FILE#DOWN, scan_forward=false` |

---

## Transactions & Constraints

### Unique Username Constraint

Each username must be globally unique. Enforced via a **reservation item** + **DynamoDB TransactWriteItems** at account creation.

The username is set once during signup (after Cognito confirmation). It can be changed later, but the new value must also be globally unique.

#### Reservation Item

| PK | SK |
|----|----|
| `USERNAME#{username_lower}` | `RESERVED` |

If this item exists, the username is taken. Its existence alone enforces the reservation - no additional data needed.

#### Write Flow

**Creating account with username (after Cognito signup):**
```
TransactWriteItems([
  Put{ PK: "USERNAME#joaosilva", SK: "RESERVED" }
    → Condition: attribute_not_exists(PK)
  Put{ PK: "USER#uuid-1", SK: "USER#PROFILE",
       user_id: "uuid-1", sub: "abc123",
       username: "joaosilva", username_lower: "joaosilva", ... }
])
```

**Changing username (from "joaosilva" to "mariacosta"):**
```
TransactWriteItems([
  Delete{ PK: "USERNAME#joaosilva", SK: "RESERVED" }
  Put{ PK: "USERNAME#mariacosta", SK: "RESERVED" }
    → Condition: attribute_not_exists(PK)
  Update{ PK: "USER#uuid-1", SK: "USER#PROFILE",
          SET username = "mariacosta", username_lower = "mariacosta" }
])
```

No files need to be moved - they are keyed by `user_id`, not by username.

**Updating profile (same username):**
Single `UpdateItem` on `USER#{user_id}` - no transaction needed.

#### Transaction Rules

| Operation | Transaction | Condition |
|-----------|-------------|-----------|
| Create account | 2-item Put | Reservation: `attribute_not_exists(PK)` |
| Change username | Delete old reservation + Put new reservation + Update user profile | New reservation: `attribute_not_exists(PK)` |
| Update profile | Single UpdateItem | -- |

---

## Constants

```
ENTITY_USER = "USER"
ENTITY_FILE = "FILE"
```

## Summary of fixes vs previous design

| Problem | Fix |
|---------|-----|
| Username as PK forced file migration on rename | Stable `user_id` (UUID v7) - files live under `USER#{user_id}` |
| Reservation items (`NAME#RESERVATION#`) polluted entity key space | `USERNAME#{username_lower}` - separate prefix, no entity overlap |
| Case-unsafe PK (`USER#{username}` with possible mixed case) | Lookup via `username_lower` GSI; PK always uses stable UUID |
| GSI projections undefined | Every GSI has explicit `ProjectionType` |
| NameSearch hot partition (`NAME#FILE` for all files) | Sharded by first character hex (`NAME#FILE#{shard}`) |
| Bloated attribute names on every item | Generic `gsiname_*` / `gsidate_*` / `gsidown_*` prefix to avoid overloading domain attributes |
| File ownership coupled to mutable username | `owner_user_id` + denormalized (stale-tolerant) `owner_username` |
