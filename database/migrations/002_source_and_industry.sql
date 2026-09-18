USE talent_inspirations;
ALTER TABLE companies ADD COLUMN industry VARCHAR(100) DEFAULT 'Other';
ALTER TABLE job_sources ADD COLUMN ats_type VARCHAR(50) DEFAULT 'generic';
ALTER TABLE job_sources ADD COLUMN auto_sync BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE job_sources ADD COLUMN last_sync_found INT DEFAULT 0;
ALTER TABLE job_sources ADD COLUMN last_sync_imported INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN source_job_url TEXT NULL;
ALTER TABLE jobs ADD COLUMN employment_type VARCHAR(80) NULL;
ALTER TABLE jobs ADD INDEX idx_industry(company_id);