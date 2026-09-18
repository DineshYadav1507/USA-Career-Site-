CREATE DATABASE IF NOT EXISTS talent_inspirations CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE talent_inspirations;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS whatsapp_messages;
DROP TABLE IF EXISTS job_alerts;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS career_sources;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS agent_runs;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE admin_users(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(255) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin') NOT NULL DEFAULT 'admin',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(150) NULL,
 email VARCHAR(255) NULL UNIQUE,
 password_hash VARCHAR(255) NULL,
 whatsapp_number VARCHAR(30) NULL,
 whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
 profile_skills_json JSON NULL,
 status ENUM('active','blocked') NOT NULL DEFAULT 'active',
 plan ENUM('free','pro','admin_granted') NOT NULL DEFAULT 'free',
 grant_until DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_user_phone(whatsapp_number),
 INDEX idx_user_plan(plan,grant_until)
);

CREATE TABLE companies(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 career_url TEXT NOT NULL,
 industry VARCHAR(100) NOT NULL DEFAULT 'Other',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_company_name(name),
 INDEX idx_company_industry(industry)
);

CREATE TABLE career_sources(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 source_url TEXT NOT NULL,
 source_type VARCHAR(50) NOT NULL DEFAULT 'generic',
 auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
 status ENUM('active','paused','error') NOT NULL DEFAULT 'active',
 last_checked_at DATETIME NULL,
 last_success_at DATETIME NULL,
 last_sync_found INT NOT NULL DEFAULT 0,
 last_sync_imported INT NOT NULL DEFAULT 0,
 last_error TEXT NULL,
 discovered_ats VARCHAR(80) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 UNIQUE KEY uq_source_url(source_url(500)),
 INDEX idx_source_scan(auto_sync,status,last_checked_at)
);

CREATE TABLE jobs(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 source_id BIGINT UNSIGNED NOT NULL,
 external_job_id VARCHAR(500) NOT NULL,
 title VARCHAR(500) NOT NULL,
 description LONGTEXT NOT NULL,
 location VARCHAR(500) NULL,
 country VARCHAR(100) NOT NULL DEFAULT 'United States',
 location_type ENUM('remote','hybrid','onsite','unknown') NOT NULL DEFAULT 'unknown',
 experience_level ENUM('fresher','experienced','other') NOT NULL DEFAULT 'other',
 category VARCHAR(100) NOT NULL DEFAULT 'Software Engineering',
 employment_type VARCHAR(100) NULL,
 skills_json JSON NULL,
 apply_url TEXT NOT NULL,
 source_job_url TEXT NULL,
 posted_at DATETIME NULL,
 date_source ENUM('published','detected') NOT NULL DEFAULT 'published',
 first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at DATETIME NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(source_id) REFERENCES career_sources(id) ON DELETE CASCADE,
 UNIQUE KEY uq_source_job(source_id,external_job_id(450)),
 INDEX idx_public(is_active,country,posted_at,expires_at),
 INDEX idx_job_category(category),
 INDEX idx_job_experience(experience_level),
 FULLTEXT KEY ft_jobs(title,description,location)
);

CREATE TABLE job_alerts(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 keyword VARCHAR(255) NOT NULL,
 category VARCHAR(100) NULL,
 industry VARCHAR(100) NULL,
 location VARCHAR(255) NULL,
 skills_json JSON NULL,
 days_window TINYINT NOT NULL DEFAULT 30,
 whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 last_sent_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX idx_alert_active(active,category,industry)
);

CREATE TABLE subscriptions(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 provider VARCHAR(30) NOT NULL DEFAULT 'stripe',
 provider_customer_id VARCHAR(255) NULL,
 provider_subscription_id VARCHAR(255) NULL UNIQUE,
 status VARCHAR(50) NOT NULL DEFAULT 'inactive',
 plan_name VARCHAR(100) NOT NULL DEFAULT 'Pro',
 current_period_end DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE whatsapp_messages(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NULL,
 job_id BIGINT UNSIGNED NULL,
 phone VARCHAR(30) NOT NULL,
 message_text TEXT NOT NULL,
 provider_message_id VARCHAR(255) NULL,
 status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
 error_text TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 sent_at DATETIME NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE SET NULL,
 INDEX idx_whatsapp_status(status,created_at)
);

CREATE TABLE agent_runs(
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 source_id BIGINT UNSIGNED NULL,
 started_at DATETIME NOT NULL,
 finished_at DATETIME NULL,
 status ENUM('running','success','error') NOT NULL DEFAULT 'running',
 found_count INT NOT NULL DEFAULT 0,
 imported_count INT NOT NULL DEFAULT 0,
 message TEXT NULL,
 FOREIGN KEY(source_id) REFERENCES career_sources(id) ON DELETE SET NULL,
 INDEX idx_agent_runs(source_id,started_at)
);
