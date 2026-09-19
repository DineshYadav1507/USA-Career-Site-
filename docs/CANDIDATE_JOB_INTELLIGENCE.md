# Candidate Job Intelligence v2

## Purpose
Talent Inspirations now has a candidate-side Career Agent workspace in addition to the employer source scanner.

### Excel employer onboarding
Admin CRM -> Career Sources -> Bulk Excel Import accepts .xlsx, .xls, or .csv.
Expected columns:
- Company / Company Name
- Career URL / Careers URL / URL
- Industry (optional)
- Country (optional, defaults to USA)

Every valid row is upserted as a Career Source and the newly imported source IDs are scanned immediately. The normal 5-minute scheduler continues afterward.

### Today Job Buckets
GET /api/account/today-buckets groups active jobs discovered since midnight for the signed-in user's country. Buckets are role-oriented, such as Software Engineering, DevOps, Data, Cybersecurity, QA, and AI/ML.

### JD Intelligence
GET /api/account/job/:id/intelligence generates/refreshes deterministic JD intelligence from the job description and the user's master CV:
- ATS score
- ATS skills
- matched skills
- missing skills
- two-point JD summary
- experience requirement summary
- tailored resume
- cover letter

This engine is intentionally deterministic and does not claim to be an external LLM. It can later be replaced or augmented by an LLM provider without changing the candidate API.

### Master CV
Users save a verified master CV in users.master_cv_text. The candidate workspace uses it as the source document for job-specific application packages.

### Application history
The applications table stores the prepared resume/cover-letter snapshot and status: saved, prepared, applied, or failed. Admin can review this through /api/admin/applications.

### Chrome extension foundation
GET /api/extension/job/:id/package returns a job-specific application package for a signed-in extension. The current API is an autofill foundation; the extension should fill candidate fields and attach generated documents, while final submission remains user-controlled unless a future version explicitly adds a site-specific submission workflow.

### Commercial plans
The platform plan catalog is:
- $49 / 15 days
- $99 / 31 days
- $199 / 3 months
- $399 / 6 months

Stripe price IDs:
- STRIPE_PRICE_49_15D
- STRIPE_PRICE_99_31D
- STRIPE_PRICE_199_3M
- STRIPE_PRICE_399_6M

These are fixed-duration access purchases; webhook processing writes users.grant_until.

### Career Agent job-description fixes
The agent now preserves ATS metadata, captures richer Workday job descriptions, and uses the configured source country for generic/Workday location filtering. Empty locations can be accepted for a country-scoped source unless the listing explicitly says worldwide/global/anywhere.

## Required database migration
Run database/migrations/003_candidate_job_intelligence.sql after pulling this version.

## Important limitation
A master CV is user-provided source material. The tailored resume/cover letter generator must not invent employment, education, certifications, dates, or achievements. It should only reorganize and emphasize verified candidate data.
