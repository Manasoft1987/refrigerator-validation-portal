import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/_core/app";

const app = createApp();

function normalizeRewrittenUrl(req: IncomingMessage) {
  const rawUrl = req.url || "/";
  const parsed = new URL(rawUrl, "http://localhost");
  const proxyPath = parsed.searchParams.get("__path");

  if (!proxyPath) return;

  parsed.searchParams.delete("__path");
  const query = parsed.searchParams.toString();
  req.url = `${proxyPath}${query ? `?${query}` : ""}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeRewrittenUrl(req);
  return app(req, res);
}
