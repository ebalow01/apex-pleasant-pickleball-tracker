import { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";

const PARQUERY_URL = "https://cvsi-alpha.io.parquery.com/o/panel/apexpickleball-2.jpg";

function getEasternHour(): number {
  const now = new Date();
  const eastern = now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
  return parseInt(eastern);
}

function getEasternDate(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function getEasternTimestamp(): string {
  const now = new Date();
  // Build an ISO-ish timestamp in Eastern time
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-04:00`;
}

async function fetchCourtImage(): Promise<string> {
  const url = `${PARQUERY_URL}?ts=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function analyzeImage(b64Image: string): Promise<Record<string, string>> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: b64Image },
          },
          {
            type: "text",
            text: 'This image shows 6 pickleball courts (Court 1 through Court 6) with availability status banners. For each court, tell me if it is "Available" or "Occupied" (or whatever status text is shown). Respond ONLY with valid JSON in this exact format, no other text:\n{"court_1": "available", "court_2": "occupied", ...}\nUse lowercase status values. Include all 6 courts.',
          },
        ],
      },
    ],
  });

  let text = (response.content[0] as { type: "text"; text: string }).text.trim();
  if (text.startsWith("```")) {
    text = text.split("\n", 2)[1];
    text = text.split("```")[0].trim();
  }
  return JSON.parse(text);
}

export default async function handler() {
  const hour = getEasternHour();
  if (hour < 5 || hour >= 22) {
    console.log(`Outside polling hours (hour=${hour} ET). Skipping.`);
    return new Response("Outside polling hours", { status: 200 });
  }

  console.log("Fetching court image...");
  const b64Image = await fetchCourtImage();
  console.log(`Fetched image (${b64Image.length} base64 chars)`);

  console.log("Analyzing with Claude Vision...");
  const courts = await analyzeImage(b64Image);
  console.log("Court status:", JSON.stringify(courts));

  const availableCount = Object.values(courts).filter(s => s === "available").length;
  const occupiedCount = Object.values(courts).filter(s => s !== "available").length;

  const reading = {
    timestamp: getEasternTimestamp(),
    courts,
    available_count: availableCount,
    occupied_count: occupiedCount,
  };

  // Save to Netlify Blobs
  const store = getStore("court-data");
  const dateStr = getEasternDate();

  // Load existing day data or start fresh
  let dayData: any[] = [];
  try {
    const existing = await store.get(dateStr);
    if (existing) dayData = JSON.parse(existing);
  } catch {
    // Start fresh
  }

  dayData.push(reading);
  await store.set(dateStr, JSON.stringify(dayData));

  // Update the date index
  let index: { dates: string[] } = { dates: [] };
  try {
    const existingIndex = await store.get("index");
    if (existingIndex) index = JSON.parse(existingIndex);
  } catch {
    // Start fresh
  }

  if (!index.dates.includes(dateStr)) {
    index.dates.unshift(dateStr);
    index.dates.sort((a, b) => b.localeCompare(a));
    // Keep last 60 days
    index.dates = index.dates.slice(0, 60);
  }
  await store.set("index", JSON.stringify(index));

  console.log(`Saved: ${availableCount} available, ${occupiedCount} occupied`);
  return new Response("OK", { status: 200 });
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
