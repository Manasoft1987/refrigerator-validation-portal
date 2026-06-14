import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const storageRoot = process.env.STORAGE_LOCAL_ROOT
  ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
  : path.join(root, ".storage");
const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

if (!existsSync(storageRoot)) {
  throw new Error(`Local storage root not found: ${storageRoot}`);
}

let client;

function getClient() {
  if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is required");
  if (!process.env.S3_ACCESS_KEY_ID) throw new Error("S3_ACCESS_KEY_ID is required");
  if (!process.env.S3_SECRET_ACCESS_KEY) throw new Error("S3_SECRET_ACCESS_KEY is required");

  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === "true" ||
        process.env.S3_FORCE_PATH_STYLE === "1" ||
        Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  return client;
}

function contentTypeForKey(key) {
  const ext = path.extname(key).toLowerCase();
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

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function keyForFile(filePath) {
  return path.relative(storageRoot, filePath).replace(/\\/g, "/");
}

const allFiles = (await listFiles(storageRoot))
  .filter(filePath => keyForFile(filePath) !== "dev-db.json")
  .sort((a, b) => keyForFile(a).localeCompare(keyForFile(b)));

console.log(`Storage source: ${storageRoot}`);
console.log(`Target bucket: ${process.env.S3_BUCKET || "(not set)"}`);
console.log(`Files to upload: ${allFiles.length}`);

let uploaded = 0;
let totalBytes = 0;

for (const filePath of allFiles) {
  const key = keyForFile(filePath);
  const info = await stat(filePath);
  totalBytes += info.size;

  if (dryRun) {
    if (verbose) console.log(`[dry-run] ${key} (${info.size} bytes)`);
    continue;
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: await readFile(filePath),
      ContentType: contentTypeForKey(key),
    }),
  );

  uploaded += 1;
  if (uploaded % 25 === 0 || uploaded === allFiles.length) {
    console.log(`Uploaded ${uploaded}/${allFiles.length}`);
  }
}

console.log(
  dryRun
    ? `Dry run complete. Total planned size: ${totalBytes} bytes.`
    : `Upload complete. Total uploaded size: ${totalBytes} bytes.`,
);
