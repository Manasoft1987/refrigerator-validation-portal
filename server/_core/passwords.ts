import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt:v1";
const KEY_LENGTH = 32;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}:${salt}:${key}`;
}

export function verifyPasswordHash(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [scheme, version, saltHex, keyHex] = storedHash.split(":");
  if (`${scheme}:${version}` !== HASH_PREFIX || !saltHex || !keyHex) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }

  if (expected.length === 0) return false;

  const actual = scryptSync(password, saltHex, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
