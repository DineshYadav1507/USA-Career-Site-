import { fetchJobs, normalizeJob, isUSAJob } from "./jobSources.js";

export async function syncSource(pool,sourceId){
 const [rows]=await pool.query("SELECT s.*,c.name company FROM job_sources s JOIN companies c ON c.id=s.company_id WHERE s.id=? LIMIT 1",[sourceId]);
 if(!rows[0])throw Error("Source not found");
 const s=rows[0],raw=await fetchJobs(s.source_url,s.ats_type);let imported=0,skipped=0;const seen=new Set();
 for(const rawJob of raw){
  const j=normalizeJob(rawJob);
  if(!j.title||!j.applyUrl||!j.postedAt||!isUSAJob(j)){skipped++;continue}
  const posted=new Date(j.postedAt);if(Number.isNaN(posted.getTime())){skipped++;continue}
  const expires=new Date(posted.getTime()+30*86400000);if(expires<=new Date()){skipped++;continue}
  const externalId=j.externalJobId||j.applyUrl;seen.add(externalId);
  const [r]=await pool.query(`INSERT INTO jobs(company_id,source_url,external_job_id,title,description,location,country,location_type,experience_level,category,apply_url,source_job_url,employment_type,posted_at,expires_at,is_active)
   VALUES(?,?,?,?,?,?, 'United States', ?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),location=VALUES(location),location_type=VALUES(location_type),experience_level=VALUES(experience_level),category=VALUES(category),apply_url=VALUES(apply_url),source_job_url=VALUES(source_job_url),employment_type=VALUES(employment_type),posted_at=VALUES(posted_at),expires_at=VALUES(expires_at),is_active=IF(VALUES(expires_at)>NOW() AND VALUES(posted_at)>=DATE_SUB(NOW(),INTERVAL 30 DAY),1,0),updated_at=CURRENT_TIMESTAMP`,
   [s.company_id,s.source_url,externalId,j.title,j.description||"",j.location||"",j.locationType||"unknown",j.experienceLevel,j.category,j.applyUrl,j.applyUrl,j.employmentType||null,posted,expires]);
  const jobId=r.insertId||(await pool.query("SELECT id FROM jobs WHERE company_id=? AND external_job_id=? LIMIT 1",[s.company_id,externalId]))[0][0]?.id;
  if(jobId){await pool.query("DELETE FROM job_skills WHERE job_id=?",[jobId]);for(const skill of j.skills)await pool.query("INSERT IGNORE INTO job_skills(job_id,skill_name) VALUES(?,?)",[jobId,skill])}
  imported++;
 }
 if(seen.size){const ids=[...seen],ph=ids.map(()=>"?").join(",");await pool.query(`UPDATE jobs SET is_active=0 WHERE company_id=? AND external_job_id IS NOT NULL AND external_job_id NOT IN (${ph}) AND posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)`,[s.company_id,...ids])}
 await pool.query("UPDATE job_sources SET last_checked_at=NOW(),status='active',last_sync_found=?,last_sync_imported=? WHERE id=?",[raw.length,imported,sourceId]);
 return {sourceId,found:raw.length,imported,skipped,policy:"Public index contains only currently published/open jobs with a valid published date, USA location, and age <=30 days"};
}
