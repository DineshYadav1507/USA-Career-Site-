# AGENTS.md

## First read
Read `AI_START_HERE.md` before making changes.

## Project
Talent Inspirations is a USA-only job discovery and alert platform.

## Non-negotiable invariants
- USA-only jobs.
- Preserve employer Apply URLs.
- Career Agent scans active sources every 5 minutes.
- WhatsApp uses whatsapp-web.js, not Cloud API.
- WhatsApp alerts are opt-in and individual; never add broadcast/group automation.
- Never commit secrets or WhatsApp session data.
- Never execute arbitrary shell/SQL/JS from admin natural-language commands.
- Do not resurrect deleted legacy scanner files.
- Do not disturb unrelated VPS PM2 apps.

## Source of truth
Inspect the actual repository. Do not trust stale chat context.

## Before coding
1. Read `AI_START_HERE.md`.
2. Inspect relevant files.
3. Check database/API impact.
4. Make a focused change.

## After coding
Run:
- `node --check server/src/server.js`
- `node --check server/src/careerAgent.js`
- `node --check server/src/whatsappWeb.js`
- `node --check server/src/billing.js`
- `npm --prefix client run build`

Update docs when behavior changes.
