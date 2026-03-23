import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Access-Control-Allow-Origin": "*",
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const date = url.searchParams.get("date");

  const store = getStore("court-data");

  if (type === "index") {
    try {
      const data = await store.get("index");
      return new Response(data || '{"dates":[]}', { headers: HEADERS });
    } catch {
      return new Response('{"dates":[]}', { headers: HEADERS });
    }
  }

  if (type === "day" && date) {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("[]", { headers: HEADERS });
    }
    try {
      const data = await store.get(date);
      return new Response(data || "[]", { headers: HEADERS });
    } catch {
      return new Response("[]", { headers: HEADERS });
    }
  }

  return new Response('{"error":"Invalid request. Use ?type=index or ?type=day&date=YYYY-MM-DD"}', {
    status: 400,
    headers: HEADERS,
  });
}

export const config: Config = {
  path: "/api/court-data",
};
