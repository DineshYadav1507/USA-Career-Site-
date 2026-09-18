# API Contract — Talent Inspirations

This is a high-level contract. Before changing or documenting an exact response shape, inspect `server/src/server.js`.

## Public

### GET /api/health
Returns service/database/agent/WhatsApp status.

### GET /api/meta
Returns categories, industries, date windows, and feature flags.

### GET /api/jobs
Filters:
- q
- days: 3, 7, 15, 30
- category
- industry
- level
- location

Only active, unexpired USA jobs are returned.

### GET /api/jobs/:id
Returns an active USA job.

### GET /api/companies/:id
Returns company information and current hiring count.

### GET /api/companies/:id/jobs
Returns current USA jobs for a company.

### GET /api/industries
Returns industry-level current job counts.

### GET /api/bot/answer?q=...
Product-help answer.

### POST /api/bot/answer
Body:
```json
{"question":"How does the Career Agent work?"}
```

## User authentication

### POST /api/auth/register
Body:
```json
{"name":"User","email":"user@example.com","password":"...","whatsappNumber":"+919876543210"}
```

### POST /api/auth/login
Returns a user JWT.

### GET /api/account
Requires:
`Authorization: Bearer <user-token>`

### POST /api/account/skills
Stores the user's skill map.

### POST /api/account/whatsapp
Stores WhatsApp number and opt-in state.

### POST /api/alerts
Creates a personalized alert.

### DELETE /api/alerts/:id
Soft-disables an alert owned by the current user.

### POST /api/billing/checkout
Creates the configured Stripe Checkout session.

## Admin

All admin routes require:
`Authorization: Bearer <admin-token>`

### POST /api/admin/login
Admin authentication.

### GET /api/admin/dashboard
Operational counts and recent Career Agent runs.

### GET /api/admin/sources
List sources.

### POST /api/admin/sources
Add a public career source.

### POST /api/admin/sources/:id/scan
Run one source immediately.

### DELETE /api/admin/sources/:id
Remove a source and its dependent jobs.

### GET /api/admin/whatsapp
WhatsApp transport status.

### POST /api/admin/agent-command
Allow-listed natural-language admin commands.

### GET /api/admin/users
List users.

### POST /api/admin/users/:id/grant
Grant free access.

### POST /api/admin/users/:id/revoke
Revoke admin-granted access.

### GET /api/admin/alerts
Inspect alert configuration.

## Billing webhook

### POST /api/billing/webhook
Stripe webhook endpoint. Signature verification is performed by the billing module when configured.

## Authentication rules

Never trust client-provided user IDs for ownership. Protected user endpoints use the ID from the verified JWT.

Never expose admin JWTs or secrets to frontend code.

## Error handling

Current API returns JSON errors for most protected operations. Future work should standardize:
- error codes
- validation errors
- request IDs
- rate-limit responses
- structured logging
