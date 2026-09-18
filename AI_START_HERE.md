# AI_START_HERE.md — Talent Inspirations Master Context

This file is the durable project context for future AI coding sessions.

If you are a new AI assistant, Claude, Codex, or developer joining this project, read this file before editing anything. Then inspect the real repository source. This document describes the intended product and the current architecture; source code is the final implementation authority.

## 1. Product identity

**Project:** Talent Inspirations  
**Repository:** USA-Career-Site-  
**Primary goal:** A 20-country job aggregation, search, personalization, subscription, and alert platform.

The product is not a generic global job board. The 20-country invariant is important.

## 2. Original product idea

The owner wants an admin-controlled career intelligence platform:

1. Admin enters a public employer career-page URL.
2. Career Agent visits that public source.
3. Agent discovers public job listings.
4. Agent extracts useful job information.
5. Agent keeps only USA-relevant jobs.
6. Agent stores the employer's original Apply URL.
7. Agent repeats scanning automatically every 5 minutes.
8. If an employer removes a job, the platform should eventually mark it inactive.
9. Users search/filter jobs.
10. Users create personalized alerts.
11. Eligible users can receive matching jobs individually through WhatsApp.
12. Users can ask a website assistant or WhatsApp assistant questions about the product.
13. Admin manages sources, users, free-access grants, and agent commands.
14. Pro subscriptions are backed by Stripe.

## 3. Core user-facing features

### Job search

Public job search supports:

- USA only
- Software Engineering
- Software Developer-style searches through search/category
- Data
- DevOps
- Cybersecurity
- AI/ML
- QA
- Industry
- Location
- Experience level
- Skills
- Last 3 Days
- Last 1 Week
- Last 15 Days
- Last 30 Days

Every job should retain the employer's original application URL.

### User accounts

Users can have:

- name
- email
- password
- WhatsApp number
- WhatsApp opt-in
- profile skills
- plan
- admin-granted access and optional expiry

### Alerts

Alerts can use:

- keyword
- category
- industry
- location
- skills
- recency window
- WhatsApp enabled/disabled

Matching is intended to happen when new jobs enter the system.

### Plans

The database currently models:

- free
- pro
- admin_granted

Admin grants can be temporary or indefinite.

### Website assistant

The website has a Career Assistant/chat widget.

It should answer product questions such as:

- What is the plan?
- What does Pro provide?
- What are the benefits?
- What date filters exist?
- Is the platform 20-country?
- How do alerts work?
- How does WhatsApp delivery work?
- How does the Career Agent work?

The current assistant is deterministic website knowledge, not a general autonomous AI agent.

## 4. WhatsApp product requirement

The selected implementation is **whatsapp-web.js**, not WhatsApp Cloud API.

### Required behavior

- Explicit user opt-in.
- Individual messages only.
- No broadcast automation.
- No group-message automation.
- Ignore status/broadcast/group inbound messages.
- Randomized queue delay.
- Per-recipient cooldown.
- Daily application-level limit.
- Incoming individual WhatsApp questions can receive product answers.

### Current defaults

- `WA_MIN_DELAY_MS=45000` → 45 seconds
- `WA_MAX_DELAY_MS=180000` → 180 seconds
- `WA_DAILY_LIMIT=80`
- `WA_RECIPIENT_COOLDOWN_MS=600000` → 10 minutes

These are operational safeguards and user-experience controls. Do not describe them as a guarantee against WhatsApp enforcement.

### Session

WhatsApp Web uses LocalAuth.

Runtime session directory:

`server/.wwebjs_auth/`

This must never be committed.

## 5. Career Agent

### Scheduler

The backend runs:

- initial scan on startup
- recurring scan every 5 minutes
- active/non-paused sources
- batches of 5 concurrent sources
- overlap protection using an in-memory `scanning` flag

### Source discovery

Current adapter order:

1. Greenhouse
2. Lever
3. Workday
4. JSON-LD JobPosting
5. Discovered ATS links
6. Generic career-page links

### Current public source support

The agent can recognize:

- Greenhouse public board APIs
- Lever public postings APIs
- Workday public CXS jobs endpoint
- JSON-LD JobPosting
- common public career-page links

### Important limitation

Current crawler is primarily HTTP/HTML based.

Some career sites render jobs only after browser JavaScript executes. Those sources may need a future Playwright/headless-browser adapter.

Do not claim universal career-site support.

## 6. 20-country rule

The agent uses USA state names/codes and USA indicators.

It rejects known non-USA country text and worldwide/global/anywhere remote listings.

A future crawler change must preserve this invariant.

Do not silently turn this into a global job board.

## 7. Job lifecycle

A job contains:

- company
- source
- external job ID
- title
- description
- location
- country
- location type
- experience level
- category
- employment type
- skills
- apply URL
- source job URL
- posted date
- date source
- first seen
- last seen
- expiry
- active state

On scan:

- insert new jobs
- update jobs already known
- mark newly discovered jobs active
- keep original employer Apply URL
- deactivate jobs that disappear from the source comparison
- deactivate expired jobs
- deactivate/exclude non-USA jobs

## 8. Initial healthcare seed

When `career_sources` is empty, the backend seeds:

- CVS Health — https://jobs.cvshealth.com/
- The Cigna Group — https://jobs.thecignagroup.com/
- UnitedHealth Group — https://careers.unitedhealthgroup.com/search-jobs
- Elevance Health — https://careers.elevancehealth.com/jobs
- HCA Healthcare — https://careers.hcahealthcare.com/

Do not add credentials or secrets for these sources.

The product should later expand beyond healthcare.

## 9. Admin capabilities

Current admin concepts include:

- admin authentication
- source listing
- add source
- scan a source manually
- remove source
- view users
- grant free access
- revoke free access
- view alerts
- WhatsApp status
- agent command endpoint
- agent status/report/stat-style commands

### Command design rule

Admin commands should be an explicit allow-list.

Never build a chat endpoint that executes arbitrary shell commands, SQL, JavaScript, or OS commands from natural-language input.

Current examples:

```
add all healthcare career links
agent status
agent report
stats
```

## 10. Backend architecture

Main backend file:

`server/src/server.js`

It currently owns:

- Express setup
- CORS
- MySQL pool
- JWT auth
- user auth
- admin auth
- companies
- sources
- jobs
- alerts
- subscriptions
- admin operations
- agent scheduling
- website assistant
- WhatsApp inbound attachment

Career crawler:

`server/src/careerAgent.js`

WhatsApp engine:

`server/src/whatsappWeb.js`

Stripe:

`server/src/billing.js`

Admin bootstrap:

`server/src/createAdmin.js`

## 11. Database architecture

Database:

`talent_inspirations`

Schema file:

`database/schema.sql`

The schema is a clean rebuild and intentionally drops the old Talent Inspirations tables before creating them.

Tables:

### admin_users

Admin credentials and role.

### users

User identity, WhatsApp opt-in, profile skills, plan, and grant period.

### companies

Employer metadata and industry.

### career_sources

Admin-added public career URLs and scan status.

### jobs

Normalized public job records.

### job_alerts

User-defined matching criteria.

### subscriptions

Stripe subscription state.

### whatsapp_messages

Application-level queue/history records.

### agent_runs

Career Agent scan history.

## 12. API map

The exact source is authoritative, but these are the major API concepts currently implemented:

### Public

- `GET /api/health`
- `GET /api/meta`
- `GET /api/jobs`
- job detail endpoint
- company endpoint
- industries endpoint
- `GET/POST /api/bot/answer`

### User

- registration
- login
- account
- WhatsApp settings
- skill profile
- alerts
- billing checkout

### Admin

- admin login
- dashboard
- source CRUD
- source scan
- users
- free-access grant/revoke
- alerts
- WhatsApp status
- agent command

### Billing

- `POST /api/billing/webhook`

Before documenting an exact route, inspect `server/src/server.js`; do not invent endpoints.

## 13. Frontend architecture

Main frontend:

`client/src/App.jsx`

It currently contains the main application UI and product flows, including:

- home/search
- job details
- company pages
- industries
- account
- alerts
- WhatsApp settings
- skill map
- upgrade flow
- admin area
- admin source manager
- admin command UI
- user/free-access management
- Career Assistant widget

Main styles:

`client/src/styles.css`

The UI is intentionally modern, responsive, dark/gradient-oriented, and product-focused.

## 14. VPS deployment convention

Current expected VPS layout:

```
/root/USA-Career-Site-
/var/www/talent-inspirations
```

Backend:

- PM2 process: `talent-api`
- port: `4000`

Nginx:

- serves `/var/www/talent-inspirations`
- proxies `/api/` to `127.0.0.1:4000/api/`

Other PM2 applications exist on the VPS.

Known unrelated applications:

- `gym-whatsapp`
- `karmabhoomi`

**Never stop, delete, or modify unrelated PM2 applications during Talent Inspirations deployment.**

## 15. Deployment safety

A clean rebuild means clean Talent Inspirations data and files, not wiping the entire VPS.

Before destructive DB operations:

- confirm the user wants old Talent Inspirations data removed
- take a backup if old data may matter

Never put the following into Git:

- DB passwords
- root passwords
- JWT secrets
- Stripe secrets
- WhatsApp session files
- API tokens
- private SSH keys

The committed `server/.env.example` is documentation only.

## 16. Old architecture that must not be resurrected

The previous implementation had legacy scanner files such as:

- `server/src/jobSources.js`
- `server/src/sync.js`
- `server/src/sourceRegistry.js`
- `server/src/worker.js`

Those were removed as part of the clean rebuild.

Do not re-create that architecture just because an old chat, commit, or cached AI context mentions it.

Current source of truth:

- `server/src/server.js`
- `server/src/careerAgent.js`
- `server/src/whatsappWeb.js`
- `server/src/billing.js`
- `database/schema.sql`
- `client/src/App.jsx`
- `client/src/styles.css`

## 17. Known implementation gaps

These are known, not accidental requirements:

1. Browser-rendered JS-only career pages need Playwright/headless-browser support.
2. WhatsApp queue is currently in memory.
3. A WhatsApp queued row does not yet have a robust durable correlation mechanism for updating the DB after the actual send.
4. WhatsApp QR setup is terminal-oriented.
5. Stripe foundation needs production webhook/reconciliation hardening.
6. More comprehensive ATS adapters are needed.
7. Job date extraction can be improved for sites with weak date metadata.
8. Semantic/AI skill matching is future work.
9. Automated crawler tests are still needed.
10. Production observability/retry/dead-letter infrastructure is future work.

Do not hide these gaps from a developer working on the project.

## 18. Suggested next phases

### Phase A — stabilize foundation

- Verify clean VPS deployment.
- Verify DB schema.
- Verify five healthcare sources.
- Verify 5-minute scheduler.
- Verify job deactivation.
- Verify USA filtering.
- Verify website assistant.
- Verify WhatsApp QR/auth/send/inbound Q&A.

### Phase B — crawler reliability

- Add Playwright adapter.
- Add source-specific parsers.
- Improve pagination.
- Improve dates.
- Add source health metrics.
- Add retry/backoff.

### Phase C — alerts

- Persist WhatsApp queue.
- Add send-status correlation.
- Add retries and failed-message handling.
- Add user-level rate limits.
- Add alert history UI.

### Phase D — intelligence

- semantic skills
- resume parsing
- profile/job matching
- saved searches
- smarter duplicate detection

### Phase E — scale

- queue worker
- Redis or durable job queue
- multiple crawler workers
- metrics/logging
- source health dashboard
- automated integration tests

## 19. Coding rules for future AI

1. Read this file first.
2. Inspect the actual code before proposing changes.
3. Do not assume old chat context is current.
4. Keep 20-country behavior.
5. Preserve employer Apply URLs.
6. Do not reintroduce deleted legacy files.
7. Keep WhatsApp one-to-one and opt-in.
8. Do not add arbitrary command execution to admin chat.
9. Never commit secrets.
10. Avoid unnecessary rewrites of working modules.
11. Update docs when architecture or behavior changes.
12. Run client build and backend syntax checks.
13. If a feature changes DB structure, update `database/schema.sql` and document migration/rebuild implications.
14. If a feature changes an API contract, update this context file and README.
15. For deployment, protect unrelated VPS services.

## 20. Verification checklist

Before calling a change complete:

```bash
node --check server/src/server.js
node --check server/src/careerAgent.js
node --check server/src/whatsappWeb.js
node --check server/src/billing.js
npm --prefix client run build
```

On VPS:

```curl http://127.0.0.1:4000/api/health```

Then inspect:

```
pm2 status
pm2 logs talent-api --lines 200
```

For WhatsApp, confirm:

- QR appears when not authenticated
- authentication succeeds
- ready state becomes true
- inbound individual message gets a website-specific response
- queued job alert is sent individually
- daily/cooldown limits work

## 21. Documentation principle

If future work changes the product idea, architecture, database, API, deployment, or operational behavior, update:

1. `AI_START_HERE.md`
2. `README.md`
3. any relevant `docs/` file

This keeps future AI sessions self-contained.


## Product expansion: country-first jobs

Current supported countries are: USA, UK, Canada, Australia, Germany, Netherlands, Ireland, France, Japan, Singapore, UAE, Saudi Arabia, New Zealand, Switzerland, Sweden, Norway, Denmark, Finland, Belgium and Austria.

User registration captures a preferred country. Public job discovery defaults to that country and can be changed with the country filter. Admin career sources have a country assignment, and the Career Agent receives the source country when classifying/filtering jobs. Keep country as a first-class domain field in future backend, frontend, alert, analytics and CRM work.

The admin UI is intended to evolve into a premium CRM/control center with dashboard metrics, country-aware source management, user management, grants, alerts and Agent commands.
