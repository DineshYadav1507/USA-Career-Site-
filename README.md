# Talent Inspirations

**Talent Inspirations** is a USA-only job discovery, filtering, alert, and subscription platform.

The project is designed so that an administrator can add public employer career pages and a **Career Agent** can continuously discover and maintain public job listings. Users can search jobs by role, category, industry, location, skills, and recency, then create personalized alerts. WhatsApp delivery is implemented with **whatsapp-web.js** and is opt-in, one-to-one, queued, delayed, and rate-limited.

> **Important for future AI/Claude/Codex sessions:** read [AI_START_HERE.md](AI_START_HERE.md) first, then inspect the actual source files before changing architecture.

## Product goals

- USA jobs only.
- Admin-managed public employer career sources.
- Career Agent scans active sources every **5 minutes**.
- Discover public Greenhouse, Lever, Workday, JSON-LD JobPosting, and generic career-page data where exposed.
- Keep the original employer Apply URL for every job.
- Deactivate jobs that disappear from a source or expire.
- Public recency filters: **Last 3 Days, Last 1 Week, Last 15 Days, Last 30 Days**.
- Categories currently include Software Engineering, DevOps, Data, Cybersecurity, QA, and AI/ML.
- Skill-based search and alerts.
- User accounts and personalized job alerts.
- Pro subscription foundation with Stripe.
- Admin-granted free access for a selected user for a chosen period or indefinitely.
- Website Career Assistant for product/help questions.
- WhatsApp Web JS inbound Q&A based on the website's documented features.
- WhatsApp job alerts sent individually, never as broadcast/group messages.

## Current WhatsApp design

The application uses **whatsapp-web.js + LocalAuth**, not the WhatsApp Cloud API.

Default safety/UX controls:

- Random queue delay: **45–180 seconds** between sends.
- Per-recipient cooldown: **10 minutes**.
- Daily application-level send limit: **80 messages/day**.
- User must explicitly opt in.
- Group chats and broadcast/status messages are ignored.
- Each job alert is sent to the matching user individually.
- Incoming individual WhatsApp messages can receive website-specific answers about plans, benefits, filters, alerts, and the Career Agent.
- The WhatsApp session is stored locally under `server/.wwebjs_auth`; this directory must never be committed.

These delays and limits are operational safeguards and user-experience controls; they are not a guarantee against WhatsApp account restrictions.

## First five healthcare sources

When the source table is empty, the backend seeds:

1. CVS Health
2. The Cigna Group
3. UnitedHealth Group
4. Elevance Health
5. HCA Healthcare

After that, admins can add additional public career sources.

## Repository structure

```text
USA-Career-Site-/
├── AI_START_HERE.md          # Master context for future AI/Claude/Codex sessions
├── AGENTS.md                 # Engineering rules for AI coding agents
├── CLAUDE.md                 # Claude-oriented entry point
├── README.md                 # Human-facing project overview
├── database/
│   └── schema.sql            # Fresh/destructive database schema
├── server/
│   ├── .env.example          # Environment variable template (no secrets)
│   ├── package.json
│   └── src/
│       ├── server.js         # Express API, auth, jobs, admin, alerts, scheduler
│       ├── careerAgent.js    # Public career-page/ATS discovery and job mapping
│       ├── whatsappWeb.js    # WhatsApp Web JS engine and queue
│       ├── billing.js        # Stripe Checkout/webhook foundation
│       └── createAdmin.js    # Admin account bootstrap
├── client/
│   ├── package.json
│   └── src/
│       ├── App.jsx           # Main React UI, routes, account/admin/bot screens
│       └── styles.css        # Main visual system
└── .github/
    └── workflows/
        └── ci.yml            # Client build + server syntax checks
```

## Local development

### Backend

```bash
cd server
cp .env.example .env
npm install
npm run create-admin -- admin@example.com StrongPassword
npm start
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Set `VITE_API_URL` to the backend API base when required.

### Database

The schema is intentionally destructive because this repository is the clean rebuild.

```bash
mysql -u root -p < database/schema.sql
```

Do not run the destructive schema against a production database containing data that must be preserved.

## VPS deployment shape

The current deployment convention is:

- Ubuntu VPS
- Backend project checkout: `/root/USA-Career-Site-`
- Backend PM2 app: `talent-api`
- Built frontend: `/var/www/talent-inspirations`
- Backend listens on port `4000`
- Nginx serves the frontend and proxies `/api/` to port `4000`
- Do **not** modify unrelated PM2 applications such as `gym-whatsapp` or `karmabhoomi`.

Example rebuild/deploy flow:

```bash
cd /root/USA-Career-Site-
git pull --ff-only origin main

mysql -u root -p < database/schema.sql

cd server
npm install
node --check src/server.js
node --check src/careerAgent.js
node --check src/whatsappWeb.js
node --check src/billing.js
pm2 restart talent-api --update-env

cd ../client
npm install
npm run build

rm -rf /var/www/talent-inspirations/*
cp -r dist/* /var/www/talent-inspirations/
chown -R www-data:www-data /var/www/talent-inspirations

nginx -t
systemctl reload nginx

curl http://127.0.0.1:4000/api/health
pm2 logs talent-api --lines 200
```

For a truly clean VPS rebuild, stop/remove only the old `talent-api` and old Talent Inspirations web files. Do not wipe the whole VPS or unrelated applications.

## Environment

Never commit `.env`.

Important variables:

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `PUBLIC_WEB_URL`
- `VITE_API_URL` for the client
- `WA_MIN_DELAY_MS`
- `WA_MAX_DELAY_MS`
- `WA_DAILY_LIMIT`
- `WA_RECIPIENT_COOLDOWN_MS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

Never put VPS passwords, database passwords, JWT secrets, WhatsApp session files, Stripe secrets, or API tokens in Git.

## Career Agent behavior

The agent accepts an admin-added public career URL. It tries, in order, to find usable public job data from:

1. Greenhouse public board API
2. Lever public postings API
3. Workday public CXS endpoint
4. JSON-LD `JobPosting`
5. Links to supported ATS pages discovered from the career page
6. Generic career-page job links

The agent maps title, description, location, Apply URL, date, employment type, location type, experience level, category, and common skills.

Current implementation is primarily HTTP/HTML/ATS based. JavaScript-only career pages may require a future Playwright/headless-browser adapter.

## Job lifecycle

- New jobs are inserted as active.
- Existing jobs are updated when seen again.
- Original employer Apply URL is retained.
- Jobs not seen in a source are deactivated after the source's scan comparison.
- Jobs older than their expiry window are deactivated.
- Non-USA jobs are excluded/deactivated.
- New matching jobs can create WhatsApp alert queue entries for eligible opted-in users.

## User entitlement

A user is entitled to Pro-style alert delivery when:

- `plan = pro`, or
- `plan = admin_granted` with no expiry, or
- `plan = admin_granted` with a future `grant_until`.

Admin can revoke a grant.

## Admin command examples

The admin command endpoint currently understands concepts such as:

```text
add all healthcare career links
agent status
agent report
stats
```

The command catalog is intentionally deterministic. Future commands should be implemented as explicit server-side operations rather than arbitrary shell execution.

## Security and engineering rules

- Never execute arbitrary shell commands from a user-facing chatbot.
- Never expose secrets to the client.
- Validate admin/user authorization on protected API routes.
- Keep employer Apply URLs intact.
- Keep the USA-only filtering invariant.
- Do not reintroduce the deleted legacy scanner architecture.
- Do not reintroduce WhatsApp Cloud API sender code unless the product requirements explicitly change.
- Keep WhatsApp delivery one-to-one; no broadcast/group automation.
- Keep credentials/session data out of Git.
- Preserve unrelated VPS services during deployment.
- Run CI and syntax/build checks before deployment.

## What is intentionally not finished yet

The current clean rebuild is a foundation, not the final production-scale crawler. Known future work:

- Playwright/browser-rendered career pages.
- More ATS adapters.
- Better pagination and anti-duplication across complex career portals.
- More robust posted-date extraction.
- Semantic/AI skill matching.
- Resume parsing and profile matching.
- Durable WhatsApp queue persisted across restarts.
- Persist actual WhatsApp sent/failed status back to `whatsapp_messages`.
- Better WhatsApp QR/session administration UI.
- Stripe production webhook hardening and billing reconciliation.
- Monitoring, metrics, retries, dead-letter handling, and source health dashboards.
- More healthcare sources and then broader industries.
- Automated tests for each ATS adapter and job lifecycle.

## Git workflow for future AI agents

Before changing code:

1. Read `AI_START_HERE.md`.
2. Read `AGENTS.md`.
3. Inspect the actual relevant source files.
4. Preserve the current architecture unless the user explicitly asks for a redesign.
5. Make the smallest coherent change.
6. Run relevant checks.
7. Update documentation when behavior changes.
8. Commit/push only when explicitly requested.

The source of truth is the code in this repository plus `AI_START_HERE.md`; do not rely on an old chat transcript when the repository says otherwise.
