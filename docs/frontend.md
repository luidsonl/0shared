# Frontend — 0shared

## Overview

The frontend is a React single-page application (SPA) served from S3 via CloudFront. CloudFront also proxies API requests (`/api/*`) to the API Gateway origin, eliminating the need for CORS configuration.

**Stack:** React 19 + Vite 8 + TypeScript 6 + React Compiler
**Infrastructure:** Terraform module at `terraform/aws-frontend/`
**Source:** `frontend/`

---

## Architecture

```
User Browser
      │
      ▼
CloudFront Distribution
      │                          │
      │  /* (static)             │  /api/*
      ▼                          ▼
S3 Bucket                    API Gateway
(React SPA)                  (SAM Lambdas)
      │
      │  OAC (SigV4)
      ▼
Only CloudFront can read objects
```

**Key design decisions:**
- Same domain for frontend + API = no CORS needed
- CloudFront serves static files from S3 via OAC (Origin Access Control)
- CloudFront proxies `/api/*` to API Gateway with `CachingDisabled` policy
- S3 bucket has all public access blocked

---

## S3 Bucket

| Setting | Value |
|---------|-------|
| Bucket name | `luidsonl-0shared-front` |
| Public access | Blocked (all four settings) |
| Force destroy | `true` (safe to destroy even if objects exist) |
| Access control | Only CloudFront via OAC + bucket policy |

The bucket policy grants `s3:GetObject` only to the CloudFront distribution (verified by `SourceArn` condition).

---

## CloudFront Distribution

### Origins

| Origin ID | Source | Protocol |
|-----------|--------|----------|
| `s3-frontend` | S3 bucket via OAC | SigV4 signing |
| `api-gateway` | SAM API Gateway (from CloudFormation export) | HTTPS-only, TLSv1.2 |

### Cache Behaviors

| Path Pattern | Origin | Methods | Cache Policy | Purpose |
|--------------|--------|---------|--------------|---------|
| `/*` (default) | S3 | GET, HEAD, OPTIONS | Default (CachingOptimized) | Static SPA files |
| `/api/*` | API Gateway | GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE | CachingDisabled | Dynamic API requests |

### Origin Request Policy (API)

Forwards to API Gateway:
- **Cookies:** all
- **Headers:** all except `Host`
- **Query strings:** all

### Other Settings

| Setting | Value |
|---------|-------|
| Price class | `PriceClass_100` (US, Canada, Europe) |
| Viewer protocol | Redirect HTTP → HTTPS |
| Geo restriction | None |
| Default root object | `index.html` |
| Certificate | CloudFront default (no custom domain yet) |

---

## SPA Routing

Vite builds the SPA as a standard `index.html` + bundled JS/CSS. CloudFront uses `index.html` as the default root object.

For client-side routing (if added later), the SPA would need to handle all routes client-side. CloudFront serves `index.html` for all non-file paths via the default cache behavior.

---

## Build & Deploy

### Local Development

```bash
cd frontend
npm install
npm run dev
```

Vite dev server runs at `http://localhost:5173` with HMR.

**API proxy:** The Vite config does NOT include a proxy for `/api/*`. In local dev, the API runs separately (via `sam local start-api` at `:3000`). The frontend would need to be configured to hit the local API directly, or a proxy can be added to `vite.config.ts`.

### Production Build

```bash
cd frontend
npm run build
```

This runs `tsc -b && vite build`, producing `frontend/dist/`.

### Deploy via Terraform

```bash
# Via Makefile (recommended)
make frontend

# Or manually
cd frontend && npm install && npm run build
cd ../terraform/aws-frontend && terraform init && terraform apply
```

The `null_resource.frontend_deploy` in Terraform detects changes to `frontend/src/**`, `package.json`, and `vite.config.ts`, then:
1. Uploads `frontend/dist/` to S3 via `aws s3 sync --delete`
2. Creates a CloudFront invalidation for `/*`

### Full Deployment

```bash
make deploy
```

Runs all four layers: bootstrap → infra → backend → frontend. The frontend is built and uploaded last, after the API Gateway endpoint is available.

---

## Runtime Configuration

`index.html` loads `/env.js` before the app module:

```html
<script src="/env.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

This pattern enables injecting runtime environment variables (e.g., API base URL) without rebuilding. The file does not exist yet — it can be created at deploy time or via the Terraform upload step.

---

## Project Structure

```
frontend/
├── index.html            # Entry point, loads /env.js + React app
├── package.json          # React 19, Vite 8, TypeScript 6
├── vite.config.ts        # Vite config (react + babel + React Compiler)
├── tsconfig.json         # Project references (app + node)
├── tsconfig.app.json     # App TypeScript config (ES2023, JSX)
├── tsconfig.node.json    # Node TypeScript config (vite.config.ts)
├── eslint.config.js      # ESLint flat config
├── public/
│   ├── favicon.svg       # Favicon
│   └── icons.svg         # SVG icon sprite
└── src/
    ├── main.tsx          # React entry point (StrictMode)
    ├── App.tsx           # Main component (landing page with counter)
    ├── App.css           # Component styles
    ├── index.css          # Global styles (light/dark theme)
    └── assets/            # Static assets (images, SVGs)
```

---

## React Compiler

The project uses the React Compiler (via `babel-plugin-react-compiler` + `@rolldown/plugin-babel`) for automatic memoization and optimization. This is configured in `vite.config.ts`:

```ts
plugins: [
  react(),
  babel({ presets: [reactCompilerPreset()] })
]
```

---

## Teardown

```bash
# Frontend only
make destroy-frontend

# Everything (reverse order)
make destroy
```

`destroy-frontend` runs `terraform destroy` in `terraform/aws-frontend/`, which removes the S3 bucket, CloudFront distribution, OAC, and the frontend deploy trigger.

---

## See Also

- [Architecture](./architecture.md) — deployment order, tooling strategy
- [Backend](./backend.md) — API endpoints that the frontend consumes
- [DynamoDB Schema](./dynamodb-schema.md) — data model
