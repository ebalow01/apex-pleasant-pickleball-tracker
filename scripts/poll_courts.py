#!/usr/bin/env python3
"""
Poll Pleasant Park pickleball court availability via ParQuery camera image.
Uses Claude Vision to parse the court status panel image.
Saves results to data/<YYYY-MM-DD>.json
"""

import base64
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import anthropic
import httpx

PARQUERY_URL = "https://cvsi-alpha.io.parquery.com/o/panel/apexpickleball-2.jpg"
EASTERN = timezone(timedelta(hours=-4))  # EDT (Mar-Nov)
# Adjust to -5 for EST (Nov-Mar) — handled dynamically below
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SITE_DIR = Path(__file__).resolve().parent.parent / "site" / "data"


def get_eastern_now():
    """Get current time in US Eastern, handling EDT/EST."""
    utc_now = datetime.now(timezone.utc)
    # Approximate EDT/EST: EDT is UTC-4 (Mar second Sun - Nov first Sun)
    # For simplicity, use Python's approach with fixed offset
    # March-November: EDT (UTC-4), November-March: EST (UTC-5)
    month = utc_now.month
    if 3 <= month <= 10:
        eastern_offset = timedelta(hours=-4)
    else:
        eastern_offset = timedelta(hours=-5)
    return utc_now.astimezone(timezone(eastern_offset))


def is_polling_hours(eastern_time):
    """Check if current Eastern time is between 5am and 10pm."""
    hour = eastern_time.hour
    return 5 <= hour < 22


def fetch_court_image():
    """Fetch the ParQuery court status panel image."""
    timestamp = int(datetime.now().timestamp())
    url = f"{PARQUERY_URL}?ts={timestamp}"
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.content


def analyze_image(image_data):
    """Use Claude Vision to parse court availability from the image."""
    client = anthropic.Anthropic()
    b64_image = base64.b64encode(image_data).decode("utf-8")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "This image shows 6 pickleball courts (Court 1 through Court 6) "
                            "with availability status banners. For each court, tell me if it is "
                            '"Available" or "Occupied" (or whatever status text is shown). '
                            "Respond ONLY with valid JSON in this exact format, no other text:\n"
                            '{"court_1": "available", "court_2": "occupied", ...}\n'
                            "Use lowercase status values. Include all 6 courts."
                        ),
                    },
                ],
            }
        ],
    )

    text = response.content[0].text.strip()
    # Extract JSON if wrapped in markdown code block
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


def save_reading(eastern_time, courts):
    """Save a court reading to the daily JSON file."""
    date_str = eastern_time.strftime("%Y-%m-%d")
    data_file = DATA_DIR / f"{date_str}.json"

    available_count = sum(1 for s in courts.values() if s == "available")
    occupied_count = sum(1 for s in courts.values() if s != "available")

    reading = {
        "timestamp": eastern_time.isoformat(),
        "courts": courts,
        "available_count": available_count,
        "occupied_count": occupied_count,
    }

    # Load existing data or start fresh
    if data_file.exists():
        with open(data_file) as f:
            data = json.load(f)
    else:
        data = []

    data.append(reading)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(data_file, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved reading: {available_count} available, {occupied_count} occupied")
    return reading


def update_site_data(eastern_time):
    """Copy recent data files to site/data/ for the dashboard."""
    SITE_DIR.mkdir(parents=True, exist_ok=True)

    # Copy last 30 days of data files
    today = eastern_time.date()
    available_files = []

    for i in range(30):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        src = DATA_DIR / f"{date_str}.json"
        if src.exists():
            dst = SITE_DIR / f"{date_str}.json"
            with open(src) as f:
                data = json.load(f)
            with open(dst, "w") as f:
                json.dump(data, f, indent=2)
            available_files.append(date_str)

    # Write an index of available data files
    index_file = SITE_DIR / "index.json"
    with open(index_file, "w") as f:
        json.dump({"dates": sorted(available_files, reverse=True)}, f, indent=2)

    print(f"Updated site data with {len(available_files)} days of history")


def main():
    eastern_now = get_eastern_now()
    print(f"Current Eastern time: {eastern_now.strftime('%Y-%m-%d %H:%M %Z')}")

    if not is_polling_hours(eastern_now):
        print("Outside polling hours (5am-10pm ET). Skipping.")
        sys.exit(0)

    print("Fetching court image...")
    image_data = fetch_court_image()
    print(f"Fetched image ({len(image_data)} bytes)")

    print("Analyzing with Claude Vision...")
    courts = analyze_image(image_data)
    print(f"Court status: {courts}")

    reading = save_reading(eastern_now, courts)

    available = reading["available_count"]
    occupied = reading["occupied_count"]

    if occupied >= 4:
        print(f"GOOD TIME TO PLAY! {occupied}/6 courts in use.")
    elif occupied >= 2:
        print(f"Moderate activity: {occupied}/6 courts in use.")
    else:
        print(f"Low activity: {occupied}/6 courts in use.")

    update_site_data(eastern_now)


if __name__ == "__main__":
    main()
