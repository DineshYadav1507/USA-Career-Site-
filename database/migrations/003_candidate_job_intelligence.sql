USE talent_inspirations;

ALTER TABLE users
  ADD COLUMN master_cv_text LONGTEXT NULL,
  ADD COLUMN master_cv_name VARCHAR(255) NULL,
  ADD COLUMN master_cv_updated_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS job_intelligence(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 job_id BIGINT UNSIGNED NOT NULL,
 ats_score DECIMAL(5,2) NOT NULL DEFAULT 0,
 ats_skills_json JSON NULL,
 matched_skills_json JSON NULL,
 missing_skills_json JSON NULL,
 summary_points_json JSON NULL,
 experience_summary TEXT NULL,
 tailored_resume LONGTEXT NULL,
 cover_letter LONGTEXT NULL,
 generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_job_intelligence_job(job_id),
 FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applications(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 job_id BIGINT UNSIGNED NOT NULL,
 status ENUM('saved','prepared','applied','failed') NOT NULL DEFAULT 'prepared',
 apply_url TEXT NOT NULL,
 resume_snapshot LONGTEXT NULL,
 cover_letter_snapshot LONGTEXT NULL,
 extension_source VARCHAR(80) NULL,
 notes TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 applied_at DATETIME NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_application_user_job(user_id,job_id),
 INDEX idx_application_user(user_id,status,created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pricing_plans(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 plan_code VARCHAR(50) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 price_usd DECIMAL(10,2) NOT NULL,
 duration_days INT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 features_json JSON NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pricing_plans(plan_code,name,price_usd,duration_days,features_json) VALUES
('starter_15','15 Days',49,15,'["Live jobs","Today buckets","JD analysis","Tailored resume","Cover letter"]'),
('pro_31','31 Days',99,31,'["All Starter features","WhatsApp alerts","Application history","Chrome autofill package"]'),
('pro_90','3 Months',199,90,'["All Pro features","Priority job intelligence"]'),
('pro_180','6 Months',399,180,'["All Pro features","Extended career workspace"]')
ON DUPLICATE KEY UPDATE name=VALUES(name),price_usd=VALUES(price_usd),duration_days=VALUES(duration_days),features_json=VALUES(features_json),active=1;

CREATE TABLE IF NOT EXISTS source_imports(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 admin_id BIGINT UNSIGNED NULL,
 file_name VARCHAR(255) NOT NULL,
 company_count INT NOT NULL DEFAULT 0,
 source_count INT NOT NULL DEFAULT 0,
 imported_count INT NOT NULL DEFAULT 0,
 error_count INT NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
