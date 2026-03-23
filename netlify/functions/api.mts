import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Access-Control-Allow-Origin": "*",
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const store = getStore("court-data");

  // /api/court-data/index
  if (path.endsWith("/index")) {
    try {
      const data = await store.get("index");
      return new Response(data || '{"dates":[]}', { headers: HEADERS });
    } catch {
      return new Response('{"dates":[]}', { headers: HEADERS });
    }
  }

  // /api/court-data/2026-03-23
  const dateMatch = path.match(/\/(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    try {
      const data = await store.get(dateMatch[1]);
      return new Response(data || "[]", { headers: HEADERS });
    } catch {
      return new Response("[]", { headers: HEADERS });
    }
  }

  return new Response('{"error":"Use /api/court-data/index or /api/court-data/YYYY-MM-DD"}', {
    status: 400,
    headers: HEADERS,
  });
}

export const config: Config = {
  path: "/api/court-data/*",
};
