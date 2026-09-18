# Architecture — Talent Inspirations

## Runtime

```
Browser
  │
  ▼
Nginx
  ├── static React build
  └── /api/* → Express :4000
                 │
                 ├── MySQL
                 ├── Career Agent
                 ├── WhatsApp Web JS
                 └── Stripe
```

## Core data flow

```
Admin adds public career URL
        │
        ▼
career_sources
        │
        ▼
Career Agent (startup + every 5 min)
        │
        ├── Greenhouse
        ├── Lever
        ├── Workday
        ├── JSON-LD
        └── generic links
        │
        ▼
USA validation + normalization
        │
        ▼
jobs
        │
        ├── public search/filter
        └── new-job matcher
                 │
                 ▼
            job_alerts
                 │
                 ▼
        WhatsApp Web JS queue
                 │
                 ▼
       individual opt-in message
```

## Backend modules

### server.js
Application composition and API boundary.

Responsibilities:
- Express middleware
- database pool
- JWT authentication
- public job APIs
- user APIs
- admin APIs
- billing webhook/checkout wiring
- alert matching
- Career Agent scheduler
- website/WhatsApp product assistant

### careerAgent.js
Public career-source discovery.

Responsibilities:
- fetch public pages
- detect supported ATS
- parse jobs
- normalize fields
- infer category/experience/skills
- enforce USA filtering

Do not put database writes in this module. Keep crawling/parsing separate from persistence.

### whatsappWeb.js
WhatsApp transport.

Responsibilities:
- WhatsApp Web authentication
- LocalAuth session
- QR display
- inbound message events
- one-to-one queue
- randomized delay
- recipient cooldown
- daily limit

Do not put product/business rules in the transport module.

### billing.js
Stripe integration boundary.

Keep Stripe-specific logic isolated from the rest of the API.

## Database relationships

```
companies
   │
   └── career_sources
          │
          └── jobs

users
 ├── job_alerts
 ├── subscriptions
 └── whatsapp_messages ── jobs

career_sources
 └── agent_runs
```

## Invariants

1. Job country must be United States.
2. Public jobs must be active and unexpired.
3. Apply URL must point to the employer/source listing.
4. WhatsApp delivery requires opt-in and entitlement.
5. WhatsApp transport sends individual messages only.
6. Admin command input is allow-listed.
7. Secrets stay outside Git.
8. Unrelated VPS processes are not touched by Talent Inspirations deployment.

## Concurrency

Career Agent scans at most five sources concurrently. A process-local lock prevents overlapping full scans in the same Node process.

If horizontal scaling is introduced later, replace the process-local lock with a distributed lock/queue.

## Future production architecture

At scale, separate:
- API process
- crawler workers
- notification worker
- scheduler
- durable queue
- Redis/cache
- metrics/logging

The current repository intentionally keeps the first production foundation simple.
