# DynamoDB Schema — Single-Table Design

**Table:** `0shared_data`
**Billing:** PAY_PER_REQUEST

---

## Keys

| Key | Type | Description |
|-----|------|-------------|
| `PK` | HASH | `{ENTITY}#{entity_id}` — partition |
| `SK` | RANGE | Item identifier within the partition |

---

## Entities

### User

| Attribute | Type | Source |
|-----------|------|--------|
| sub | string | Cognito |
| email | string | Cognito |
| name | string | PUT /auth/me |
| avatar_url | string | PUT /auth/me |
| bio | string | PUT /auth/me |
| created_at | string (ISO) | auto |
| updated_at | string (ISO) | auto |

#### Keys

| PK | SK |
|----|----|
| `USER#{sub}` | `USER` |

### File

| Attribute | Type |
|-----------|------|
| file_id | string (UUID) |
| owner_sub | string |
| name | string |
| size | number (bytes) |
| content_type | string |
| upload_date | string (ISO) |
| download_count | number |

#### Keys

| PK | SK |
|----|----|
| `USER#{owner_sub}` | `FILE#{file_id}` |

---

## Indexes

### EntityCollection — List all items of a type

| Key | Type | Value |
|-----|------|-------|
| `entity_type` | HASH | `USER` or `FILE` |
| `entity_sort` | RANGE | `{ENTITY}#{timestamp}#{id}` |

```
entity_type  |  entity_sort
USER         |  USER#2026-01-01T00:00:00Z#abc123
FILE         |  FILE#2026-06-18T12:00:00Z#file_xyz
```

### NameSearch — Search by name across entities

| Key | Type | Value |
|-----|------|-------|
| `name_type` | HASH | `NAME#USER` or `NAME#FILE` |
| `name_value` | RANGE | `{name_lowercase}#{entity_id}` |

```
name_type    |  name_value
NAME#USER    |  joão silva#abc123
NAME#USER    |  maria#def456
NAME#FILE    |  relatorio.pdf#file_xyz
NAME#FILE    |  foto.png#file_uvw
```

### UploadDateIndex — Files by upload date

| Key | Type | Value |
|-----|------|-------|
| `date_type` | HASH | `FILE#DATE` |
| `date_value` | RANGE | `{upload_date}#{file_id}` |

```
date_type    |  date_value
FILE#DATE    |  2026-06-18T10:30:00Z#file_xyz
FILE#DATE    |  2026-06-18T14:20:00Z#file_uvw
```

### DownloadCountIndex — Files by popularity

| Key | Type | Value |
|-----|------|-------|
| `down_type` | HASH | `FILE#DOWN` |
| `down_value` | RANGE | `{download_count_padded}#{file_id}` |

```
down_type    |  down_value
FILE#DOWN    |  0000000042#file_xyz
FILE#DOWN    |  0000000128#file_uvw
```

> `download_count` must be stored zero-padded to 10 digits (e.g., `0000000042`) for correct lexicographic ordering.

---

## Access Patterns

| # | Query | Index | Key Condition |
|---|-------|-------|---------------|
| 1 | Get user profile | — | `get_item(PK=USER#{sub}, SK=USER)` |
| 2 | List user's files | — | `query(PK=USER#{sub}, begins_with(SK, FILE#))` |
| 3 | List all users | EntityCollection | `entity_type=USER, begins_with(entity_sort, USER#)` |
| 4 | List all files | EntityCollection | `entity_type=FILE, begins_with(entity_sort, FILE#)` |
| 5 | Search users by name | NameSearch | `name_type=NAME#USER, begins_with(name_value, {name})` |
| 6 | Search files by name | NameSearch | `name_type=NAME#FILE, begins_with(name_value, {name})` |
| 7 | Filter files by date | UploadDateIndex | `date_type=FILE#DATE, between({start}, {end})` |
| 8 | Top downloaded files | DownloadCountIndex | `down_type=FILE#DOWN, scan_forward=false` |

---

## Constants

```
ENTITY_USER = "USER"
ENTITY_FILE = "FILE"
```
