import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Access-Control-Allow-Origin": "*",
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  // Extract date from path: /api/court-data/day/2026-03-23
  const segments = url.pathname.split("/");
  const date = segments[segments.length - 1];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("[]", { headers: HEADERS });
  }

  const store = getStore("court-data");
  try {
    const data = await store.get(date);
    return new Response(data || "[]", { headers: HEADERS });
  } catch {
    return new Response("[]", { headers: HEADERS });
  }
}

export const config: Config = {
  path: "/api/court-data/day/:date",
};
