import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const client = new S3Client({
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

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  if (typeof body.arrayBuffer === "function") {
    return Buffer.from(await body.arrayBuffer());
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const key = `storage-healthcheck/${crypto.randomUUID()}.txt`;
const body = Buffer.from(`storage-ok ${new Date().toISOString()}`, "utf8");

try {
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    }),
  );

  const result = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }),
  );
  const downloaded = await streamToBuffer(result.Body);

  if (!downloaded.equals(body)) {
    throw new Error("Downloaded object content does not match uploaded content");
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }),
  );

  console.log(`S3 storage OK: ${process.env.S3_BUCKET}/${key}`);
} catch (error) {
  console.error("S3 storage check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
