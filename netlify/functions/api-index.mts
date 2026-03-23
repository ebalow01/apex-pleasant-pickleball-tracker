import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Access-Control-Allow-Origin": "*",
};

export default async function handler() {
  const store = getStore("court-data");
  try {
    const data = await store.get("index");
    return new Response(data || '{"dates":[]}', { headers: HEADERS });
  } catch {
    return new Response('{"dates":[]}', { headers: HEADERS });
  }
}

export const config: Config = {
  path: "/api/court-data/index",
};
