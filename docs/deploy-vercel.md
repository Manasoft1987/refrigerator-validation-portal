# Deployment to Vercel

This project is a Vite + Express + tRPC application. Vercel serves the built
Vite frontend from `dist/public` and routes API/storage requests to
`api/index.ts`.

## Required production services

1. GitHub repository connected to Vercel.
2. MySQL-compatible database for `DATABASE_URL`.
3. S3-compatible object storage for generated PDFs and uploaded logger files.
4. OAuth settings for login.

Local `.storage/dev-db.json` is development-only and must not be used as
production storage on Vercel.

## Vercel environment variables

Set these in the Vercel project:

```text
JWT_SECRET
VITE_APP_ID
OAUTH_SERVER_URL
VITE_OAUTH_PORTAL_URL
DATABASE_URL
STORAGE_PROVIDER=s3
S3_REGION
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE
```

Optional migration compatibility:

```text
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
STORAGE_MIRROR_PROVIDER
```

## Build

Vercel uses:

```text
npm run build:vercel
```

The normal local production build remains:

```text
npm run build
```

## Database migration

Run migrations once against the production database after setting
`DATABASE_URL` locally or in CI:

```powershell
$env:DATABASE_URL="mysql://user:password@host:3306/database"
npm run db:push
```

## Runtime routing

`vercel.json` rewrites these paths to the serverless Express handler:

- `/api/*`
- `/storage/*`
- `/manus-storage/*`

All other paths fall back to `/index.html` for the SPA.
