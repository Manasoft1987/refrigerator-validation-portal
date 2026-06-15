// Storage helpers with Manus compatibility.
//
// During migration we keep the legacy Manus Forge storage working while the
// standalone portal can write to local disk or any S3-compatible bucket.

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

type StorageProvider = "manus" | "local" | "s3";

type StoredObject = {
  data: Buffer;
  contentType: string;
};

const STORAGE_PROXY_PREFIX = "/storage";
const MANUS_PROXY_PREFIX = "/manus-storage";

let s3Client: S3Client | null = null;

/** Retry a fetch call up to maxRetries times on 429 with exponential backoff. */
async function fetchWithRetry(
  url: URL | string,
  init: RequestInit,
  maxRetries = 4,
): Promise<Response> {
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 || attempt === maxRetries) return resp;
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);
  }
  return fetch(url, init);
}

function normalizeKey(relKey: string): string {
  return relKey
    .replace(/^\/?(storage|manus-storage)\//, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function configuredProvider(value: string): StorageProvider | null {
  if (value === "manus" || value === "local" || value === "s3") return value;
  return null;
}

function primaryProvider(): StorageProvider {
  const explicit = configuredProvider(ENV.storageProvider);
  if (explicit) return explicit;
  return ENV.forgeApiUrl && ENV.forgeApiKey ? "manus" : "local";
}

function mirrorProvider(): StorageProvider | null {
  const mirror = configuredProvider(ENV.storageMirrorProvider);
  const primary = primaryProvider();
  return mirror && mirror !== primary ? mirror : null;
}

function publicUrl(provider: StorageProvider, key: string): string {
  return provider === "manus"
    ? `${MANUS_PROXY_PREFIX}/${key}`
    : `${STORAGE_PROXY_PREFIX}/${key}`;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function localRoot(): string {
  return path.resolve(process.cwd(), ENV.storageLocalRoot || ".storage");
}

function localPathForKey(relKey: string): string {
  const root = localRoot();
  const target = path.resolve(root, normalizeKey(relKey));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const targetLc = target.toLowerCase();
  const rootLc = root.toLowerCase();
  const rootWithSepLc = rootWithSep.toLowerCase();

  if (targetLc !== rootLc && !targetLc.startsWith(rootWithSepLc)) {
    throw new Error("Storage key resolves outside local storage root");
  }

  return target;
}

function getS3Client(): S3Client {
  if (!ENV.s3Bucket) {
    throw new Error("S3 storage config missing: set S3_BUCKET");
  }

  if (!s3Client) {
    const credentials =
      ENV.s3AccessKeyId && ENV.s3SecretAccessKey
        ? {
            accessKeyId: ENV.s3AccessKeyId,
            secretAccessKey: ENV.s3SecretAccessKey,
          }
        : undefined;

    s3Client = new S3Client({
      region: ENV.s3Region || "auto",
      endpoint: ENV.s3Endpoint || undefined,
      credentials,
      forcePathStyle:
        ENV.s3ForcePathStyle === "true" ||
        ENV.s3ForcePathStyle === "1" ||
        Boolean(ENV.s3Endpoint),
    });
  }

  return s3Client;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  const maybeWebBody = body as {
    arrayBuffer?: () => Promise<ArrayBuffer>;
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof maybeWebBody.transformToByteArray === "function") {
    return Buffer.from(await maybeWebBody.transformToByteArray());
  }

  if (typeof maybeWebBody.arrayBuffer === "function") {
    return Buffer.from(await maybeWebBody.arrayBuffer());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function putManus(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  const { forgeUrl, forgeKey } = getForgeConfig();

  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetchWithRetry(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
}

async function readManus(key: string): Promise<StoredObject> {
  const signed = await getManusSignedUrl(key);
  const response = await fetch(signed);
  if (!response.ok) {
    throw new Error(`Manus storage read failed (${response.status})`);
  }
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || contentTypeForKey(key),
  };
}

async function getManusSignedUrl(key: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetchWithRetry(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}

async function putLocal(
  key: string,
  data: Buffer | Uint8Array | string,
): Promise<void> {
  const target = localPathForKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

async function readLocal(key: string): Promise<StoredObject> {
  const target = localPathForKey(key);
  return {
    data: await fs.readFile(target),
    contentType: contentTypeForKey(key),
  };
}

async function putS3(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  await (getS3Client() as any).send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
}

async function readS3(key: string): Promise<StoredObject> {
  const result = await (getS3Client() as any).send(
    new GetObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
    }),
  );

  return {
    data: await streamToBuffer(result.Body),
    contentType: result.ContentType || contentTypeForKey(key),
  };
}

async function putWithProvider(
  provider: StorageProvider,
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  if (provider === "manus") return putManus(key, data, contentType);
  if (provider === "s3") return putS3(key, data, contentType);
  return putLocal(key, data);
}

async function readWithProvider(
  provider: StorageProvider,
  key: string,
): Promise<StoredObject> {
  if (provider === "manus") return readManus(key);
  if (provider === "s3") return readS3(key);
  return readLocal(key);
}

function readProviders(): StorageProvider[] {
  const primary = primaryProvider();
  const providers: StorageProvider[] = [primary];

  const mirror = mirrorProvider();
  if (mirror) providers.push(mirror);

  if (primary !== "manus" && ENV.forgeApiUrl && ENV.forgeApiKey) {
    providers.push("manus");
  }

  return Array.from(new Set(providers));
}

export function contentTypeForKey(relKey: string): string {
  const ext = path.extname(normalizeKey(relKey)).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".csv":
      return "text/csv; charset=utf-8";
    case ".json":
      return "application/json";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const provider = primaryProvider();
  const key = appendHashSuffix(normalizeKey(relKey));

  await putWithProvider(provider, key, data, contentType);

  const mirror = mirrorProvider();
  if (mirror) {
    try {
      await putWithProvider(mirror, key, data, contentType);
    } catch (error) {
      console.warn(`[Storage] Mirror write to ${mirror} failed:`, error);
    }
  }

  return { key, url: publicUrl(provider, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicUrl(primaryProvider(), key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const provider = primaryProvider();

  if (provider === "manus") return getManusSignedUrl(key);
  if (provider === "s3") {
    return getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }),
      { expiresIn: 60 * 5 },
    );
  }

  return publicUrl("local", key);
}

export async function storageReadBuffer(relKey: string): Promise<StoredObject> {
  const key = normalizeKey(relKey);
  const failures: string[] = [];

  for (const provider of readProviders()) {
    try {
      return await readWithProvider(provider, key);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Storage object not found: ${key}. Tried ${failures.join("; ")}`);
}
