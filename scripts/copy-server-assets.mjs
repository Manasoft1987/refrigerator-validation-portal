import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const copies = [
  ["server/fonts", "dist/fonts"],
  ["server/assets", "dist/assets"],
];

for (const [source, target] of copies) {
  const sourcePath = path.join(root, source);
  const targetPath = path.join(root, target);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
}
