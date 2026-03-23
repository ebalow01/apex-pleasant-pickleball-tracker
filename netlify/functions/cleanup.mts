import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async function handler() {
  const store = getStore("court-data");
  const raw = await store.get("2026-03-23");
  if (!raw) return new Response("No data found", { status: 404 });

  const data = JSON.parse(raw);
  const filtered = data.filter((r: any) => !r.timestamp.includes("07:37"));

  await store.set("2026-03-23", JSON.stringify(filtered));

  return new Response(JSON.stringify({ before: data.length, after: filtered.length }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/cleanup",
};
