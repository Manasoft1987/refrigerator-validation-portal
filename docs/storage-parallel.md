# Parallel Storage Mode

This portal can now keep Manus storage working while the standalone portal is
introduced.

## Current shared mode

Use this when Manus and this portal must operate against the same existing
files:

```env
STORAGE_PROVIDER=manus
BUILT_IN_FORGE_API_URL=...
BUILT_IN_FORGE_API_KEY=...
```

New files are saved through Manus Forge and URLs stay in the legacy format:

```text
/manus-storage/<key>
```

## Mirror mode

Use this during migration to keep writing to Manus while also copying every new
file into the future storage backend:

```env
STORAGE_PROVIDER=manus
STORAGE_MIRROR_PROVIDER=s3

S3_BUCKET=...
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

For local migration tests:

```env
STORAGE_PROVIDER=manus
STORAGE_MIRROR_PROVIDER=local
STORAGE_LOCAL_ROOT=.storage
```

Mirror failures are logged but do not block the user flow. Manus remains the
source of truth until you deliberately switch the primary provider.

## Standalone mode

Use this once the standalone portal should write to its own storage:

```env
STORAGE_PROVIDER=s3
```

or:

```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=.storage
```

New files use:

```text
/storage/<key>
```

The legacy route remains available:

```text
/manus-storage/<key>
```

When Forge credentials are configured, the server can still read legacy Manus
objects as a fallback while generating PDFs.
