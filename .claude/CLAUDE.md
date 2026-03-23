# CLAUDE.md - Apex Pleasant Park Pickleball Tracker

## Project Overview
Tracks pickleball court availability at Pleasant Park in Apex, NC by polling a ParQuery camera image every 15 minutes (5am-10pm ET). Uses Claude Vision (Haiku) to parse the court status panel image and logs history for trend analysis.

## Architecture
- **Polling**: GitHub Actions cron (every 15 min) runs `scripts/poll_courts.py`
- **Data**: Daily JSON files in `data/YYYY-MM-DD.json`, copied to `site/data/` for the dashboard
- **Dashboard**: Static HTML/JS in `site/`, deployed via Netlify
- **Image source**: `https://cvsi-alpha.io.parquery.com/o/panel/apexpickleball-2.jpg`

## Key Context
- 6 courts total, numbered 1-6
- "Good time to play" = 4+ courts occupied (pickup games need other players)
- ParQuery provides a status panel image (not JSON) — no structured API for pickleball cameras
- Uses Claude Haiku for vision analysis (cost-effective for frequent polling)

## Secrets Required
- `ANTHROPIC_API_KEY` — set in GitHub repo secrets for the Actions workflow
