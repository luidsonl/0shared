# Documentation

## Rules

- **Language**: All code comments, test descriptions, commit messages, documentation, and PR descriptions must be written in English.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Core architecture, tooling decisions, deployment order, infrastructure patterns |
| [Backend](docs/backend.md) | API structure, endpoints, health check, error handling conventions |
| [Authentication](docs/auth.md) | Authentication system, sessions, Bearer tokens, signup/login/logout |
| [File Upload](docs/file-upload.md) | Upload flow, presigned URLs, S3 event → SQS → registration |
| [File Download](docs/file-download.md) | Download flow, presigned URLs, async counter, Lambda interface pattern |
| [Frontend](docs/frontend.md) | React SPA, CloudFront, S3 static hosting, build & deploy |
| [DynamoDB Schema](docs/dynamodb-schema.md) | Single-table design, entities, indexes, access patterns |

## Quick Links

- **Architecture diagram** — [Architecture > Architecture Diagram](docs/architecture.md#architecture-diagram)
- **Deployment order** — [Architecture > Deployment Order](docs/architecture.md#deployment-order)
- **Local development** — [Architecture > Local Development Workflow](docs/architecture.md#local-development-workflow)
- **API endpoints** — [Backend > API Endpoints](docs/backend.md#api-endpoints)
- **Auth endpoints** — [Authentication > Endpoints](docs/auth.md#endpoints)
- **File upload flow** — [File Upload > Upload Flow Diagram](docs/file-upload.md#upload-flow-diagram)
- **File download flow** — [File Download > Download Flow Diagram](docs/file-download.md#download-flow-diagram)
- **Frontend deploy** — [Frontend > Build & Deploy](docs/frontend.md#build--deploy)
- **CloudFront config** — [Frontend > CloudFront Distribution](docs/frontend.md#cloudfront-distribution)
- **Access patterns** — [DynamoDB Schema > Access Patterns](docs/dynamodb-schema.md#access-patterns)
