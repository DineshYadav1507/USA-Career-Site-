import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {syncSource} from "./sync.js";import {detectSource,ATS,CATEGORIES,classifyIndustry,DEFAULT_RECRUITMENT_SOURCES} from "./sourceRegistry.js";
import { URL } from "node:url";

const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN?.split(",")||"*"}));
app.use(express.json({limit:"1mb"}));

const pool=mysql.createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"talent",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"talent_inspirations",connectionLimit:10});
const JWT_SECRET=process.env.JWT_SECRET||"change-me";

function auth(req,res,next){try{const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))return res.status(401).json({error:"Authentication required"});req.admin=jwt.verify(h.slice(7),JWT_SECRET);next()}catch{return res.status(401).json({error:"Invalid token"})}}

const US_STATES=new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"]);
const NON_US=/\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\b/i;
function isUSJob(location="",description=""){const s=`${location} ${description}`;if(NON_US.test(s))return false;if(/remote\s*[-–—:]?\s*(worldwide|global|anywhere)/i.test(s))return false;return /\bunited states\b|\busa\b|\bus\b/i.test(s)||[...US_STATES].some(x=>new RegExp(`(?:^|[ ,])${x}(?:$|[ ,])`,"i").test(location));}
function classifyExperience(text=""){if(/\b(intern|internship|new grad|new graduate|entry[- ]level|fresher|graduate)\b|\b0\s*[-–to]?\s*1\s*years?\b/i.test(text))return "fresher";if(/\b(senior|lead|principal|manager|[2-9]\+?\s*years?)\b/i.test(text))return "experienced";return "other"}
function category(text=""){const s=text.toLowerCase();if(/devops|sre|kubernetes|terraform|cloud engineer/.test(s))return "DevOps";if(/data analyst|data scientist|analytics|business intelligence/.test(s))return "Data";if(/cyber|security engineer|infosec/.test(s))return "Cybersecurity";if(/qa|quality assurance|test engineer/.test(s))return "QA";if(/ai|machine learning|ml engineer/.test(s))return "AI/ML";return "Software Engineering"}
function extractSkills(text=""){const catalog=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git"];return catalog.filter(x=>new RegExp(`\\b${x.replace(/[+.#]/g,"\\$&")}\\b`,"i").test(text))}
function normalizeCareerUrl(raw){const u=new URL(raw);if(!["http:","https:"].includes(u.protocol))throw Error("Only HTTP(S) URLs are allowed");return u.toString()}
function parseDate(v){const d=v?new Date(v):new Date();return Number.isNaN(d.getTime())?new Date():d}
async function seedDefaultRecruitmentSources(){
 for(const item of DEFAULT_RECRUITMENT_SOURCES){
  try{
   const [existing]=await pool.query("SELECT id FROM companies WHERE name=? LIMIT 1",[item.name]);
   let companyId;
   if(existing[0]) companyId=existing[0].id;
   else {const [ins]=await pool.query("INSERT INTO companies(name,career_url,industry) VALUES(?,?,?)",[item.name,item.url,classifyIndustry(item.name,item.url)]);companyId=ins.insertId;} await pool.query("UPDATE companies SET career_url=?,industry=? WHERE id=?",[item.url,classifyIndustry(item.name,item.url),companyId]);
   const [source]=await pool.query("SELECT id FROM job_sources WHERE company_id=? AND source_url=? LIMIT 1",[companyId,item.url]);
   if(!source[0]) await pool.query("INSERT INTO job_sources(company_id,source_url,ats_type,auto_sync) VALUES(?,?,?,?)",[companyId,item.url,detectSource(item.url),true]);
  }catch(e){console.error("Default source seed failed:",item.name,e.message)}
 }
}

app.get("/api/meta",(req,res)=>res.json({ats:Object.values(ATS),industries:CATEGORIES,policy:{country:"United States",maxAgeDays:30}}));
app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"talent-inspirations",scope:"USA-only",database:"connected"})}catch(e){res.status(503).json({ok:false,database:"unavailable"})}});
app.get("/api/jobs",async(req,res)=>{try{const {q="",level="",category="",industry="",location="",companyId=""}=req.query;const where=["j.is_active=1","j.expires_at>NOW()","j.posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)","LOWER(j.country)='united states'"];const p=[];if(q){const term="%"+q.trim().toLowerCase()+"%";where.push("(LOWER(j.title) LIKE ? OR LOWER(j.description) LIKE ? OR LOWER(j.location) LIKE ? OR LOWER(c.name) LIKE ? OR EXISTS (SELECT 1 FROM job_skills qs WHERE qs.job_id=j.id AND LOWER(qs.skill_name) LIKE ?))");p.push(term,term,term,term,term)}if(level){where.push("LOWER(j.experience_level)=LOWER(?)");p.push(level)}if(category){where.push("LOWER(j.category)=LOWER(?)");p.push(category)}if(industry){where.push("LOWER(c.industry)=LOWER(?)");p.push(industry)}if(location){where.push("LOWER(j.location) LIKE ?");p.push("%"+location.trim().toLowerCase()+"%")}if(companyId){where.push("j.company_id=?");p.push(companyId)}const [rows]=await pool.query("SELECT j.id,j.company_id,c.name company,c.industry,j.title,j.description,j.location,j.location_type,j.experience_level,j.category,j.apply_url,j.source_job_url,j.posted_at,j.expires_at,COALESCE(JSON_ARRAYAGG(js.skill_name),JSON_ARRAY()) skills FROM jobs j JOIN companies c ON c.id=j.company_id LEFT JOIN job_skills js ON js.job_id=j.id WHERE "+where.join(" AND ")+" GROUP BY j.id ORDER BY j.posted_at DESC,j.id DESC",p);res.json({jobs:rows})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/jobs/:id",async(req,res)=>{try{const [rows]=await pool.query("SELECT j.*,c.name company,c.industry,c.career_url,s.ats_type,s.source_url,COALESCE(JSON_ARRAYAGG(js.skill_name),JSON_ARRAY()) skills FROM jobs j JOIN companies c ON c.id=j.company_id LEFT JOIN job_sources s ON s.company_id=j.company_id LEFT JOIN job_skills js ON js.job_id=j.id WHERE j.id=? AND j.is_active=1 AND j.expires_at>NOW() AND j.posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND LOWER(j.country)='united states' GROUP BY j.id LIMIT 1",[req.params.id]);if(!rows[0])return res.status(404).json({error:"Job is no longer publicly available"});res.json({job:rows[0]})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/jobs/:id/related",async(req,res)=>{try{const [rows]=await pool.query("SELECT j.id,j.company_id,c.name company,j.title,j.location,j.location_type,j.experience_level,j.category,j.apply_url,j.posted_at FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id<>? AND j.is_active=1 AND j.expires_at>NOW() AND j.posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND LOWER(j.country)='united states' ORDER BY (j.category=(SELECT category FROM jobs WHERE id=?)) DESC,j.posted_at DESC LIMIT 6",[req.params.id,req.params.id]);res.json({jobs:rows})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/companies/:id",async(req,res)=>{try{const [c]=await pool.query("SELECT id,name,career_url,logo_url,industry,created_at FROM companies WHERE id=? LIMIT 1",[req.params.id]);if(!c[0])return res.status(404).json({error:"Company not found"});const [n]=await pool.query("SELECT COUNT(*) current_hiring FROM jobs WHERE company_id=? AND is_active=1 AND expires_at>NOW() AND posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND LOWER(country)='united states'",[req.params.id]);res.json({company:{...c[0],current_hiring:n[0].current_hiring}})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/companies/:id/jobs",async(req,res)=>{try{const {q="",level="",category=""}=req.query;const where=["j.company_id=?","j.is_active=1","j.expires_at>NOW()","j.posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)","LOWER(j.country)='united states'"];const p=[req.params.id];if(q){where.push("(j.title LIKE ? OR j.description LIKE ? OR j.location LIKE ?)");p.push("%"+q+"%","%"+q+"%","%"+q+"%")}if(level){where.push("j.experience_level=?");p.push(level)}if(category){where.push("j.category=?");p.push(category)}const [jobs]=await pool.query("SELECT j.id,j.company_id,j.title,j.location,j.location_type,j.experience_level,j.category,j.apply_url,j.posted_at,COALESCE(JSON_ARRAYAGG(js.skill_name),JSON_ARRAY()) skills FROM jobs j LEFT JOIN job_skills js ON js.job_id=j.id WHERE "+where.join(" AND ")+" GROUP BY j.id ORDER BY j.posted_at DESC,j.id DESC",p);res.json({jobs})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/industries",async(req,res)=>{const [rows]=await pool.query("SELECT c.industry,COUNT(j.id) current_jobs FROM companies c LEFT JOIN jobs j ON j.company_id=c.id AND j.is_active=1 AND j.expires_at>NOW() AND j.posted_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND LOWER(j.country)='united states' GROUP BY c.industry ORDER BY current_jobs DESC,c.industry");res.json({industries:rows})});

app.post("/api/admin/login",async(req,res)=>{const {email,password}=req.body||{};if(!email||!password)return res.status(400).json({error:"Email and password required"});const [rows]=await pool.query("SELECT * FROM admin_users WHERE email=? LIMIT 1",[email]);if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"Invalid credentials"});res.json({token:jwt.sign({id:rows[0].id,email:rows[0].email,role:rows[0].role},JWT_SECRET,{expiresIn:"12h"})})});

app.get("/api/admin/sources",auth,async(req,res)=>{const [rows]=await pool.query("SELECT s.*,c.name company FROM job_sources s JOIN companies c ON c.id=s.company_id ORDER BY s.id DESC");res.json({sources:rows})});

app.post("/api/admin/sources",auth,async(req,res)=>{try{const {companyName,careerUrl,industry="Other",autoSync=true}=req.body||{};if(!companyName||!careerUrl)return res.status(400).json({error:"Company name and career URL are required"});const url=normalizeCareerUrl(careerUrl);const ats=detectSource(url);const inferred=industry==="Other"?classifyIndustry(companyName,url):industry;const [existing]=await pool.query("SELECT id FROM companies WHERE name=? LIMIT 1",[companyName]);let companyId;if(existing[0]){companyId=existing[0].id;await pool.query("UPDATE companies SET career_url=?,industry=? WHERE id=?",[url,inferred,companyId])}else{const [ins]=await pool.query("INSERT INTO companies(name,career_url,industry) VALUES(?,?,?)",[companyName,url,inferred]);companyId=ins.insertId}const [s]=await pool.query("INSERT INTO job_sources(company_id,source_url,ats_type,auto_sync) VALUES(?,?,?,?)",[companyId,url,ats,!!autoSync]);res.status(201).json({message:"Career source added",atsType:ats,industry:inferred,companyId,sourceId:s.insertId})}catch(e){res.status(400).json({error:e.message})}});

app.post("/api/admin/jobs",auth,async(req,res)=>{
 try{
  const {companyId,companyName,careerUrl="",title,description,location,locationType="unknown",experienceLevel="other",category="Software Engineering",employmentType="",skills=[],applyUrl,postedAt}=req.body||{};
  if(!title||!description||!location||!applyUrl)return res.status(400).json({error:"Title, description, location and apply link are required"});
  const usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
  const s=`${location} ${description}`;
  if(/\\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\\b/i.test(s)||(!/\\b(united states|usa|u\\.?s\\.?)\\b/i.test(location)&&!usStates.some(x=>new RegExp(`\\\\b${x}\\\\b`,"i").test(location))))return res.status(422).json({error:"Only USA jobs can be added"});
  let cid=companyId;
  if(!cid){
   if(!companyName)return res.status(400).json({error:"Select a company or enter a company name"});
   const [existing]=await pool.query("SELECT id FROM companies WHERE name=? LIMIT 1",[companyName]);
   if(existing[0])cid=existing[0].id;
   else{const [ins]=await pool.query("INSERT INTO companies(name,career_url,industry) VALUES(?,?,?)",[companyName,careerUrl||applyUrl,"Other"]);cid=ins.insertId}
  }
  const posted=postedAt?new Date(postedAt):new Date();
  if(Number.isNaN(posted.getTime()))return res.status(400).json({error:"Invalid published date"});
  const expires=new Date(posted.getTime()+30*86400000);
  if(expires<=new Date())return res.status(422).json({error:"Published date is older than 30 days"});
  const cleanSkills=Array.isArray(skills)?[...new Set(skills.map(x=>String(x).trim()).filter(Boolean))]:[];
  const externalId=`manual:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
  const [r]=await pool.query("INSERT INTO jobs(company_id,source_url,external_job_id,title,description,location,country,location_type,experience_level,category,employment_type,apply_url,source_job_url,posted_at,expires_at,is_active) VALUES(?,?,?,?,?,'United States',?,?,?,?,?,?,?,?,?,1)",[cid,careerUrl||applyUrl,externalId,title,description,location,locationType,experienceLevel,category,employmentType||null,applyUrl,applyUrl,posted,expires]);
  for(const skill of cleanSkills)await pool.query("INSERT IGNORE INTO job_skills(job_id,skill_name) VALUES(?,?)",[r.insertId,skill]);
  res.status(201).json({id:r.insertId,message:"Manual USA job added",skills:cleanSkills});
}catch(e){res.status(400).json({error:e.message})}
});

app.get("/api/admin/jobs",auth,async(req,res)=>{try{const [rows]=await pool.query("SELECT j.id,j.company_id,c.name company,c.industry,j.title,j.description,j.location,j.location_type,j.experience_level,j.category,j.employment_type,j.apply_url,j.posted_at,j.expires_at,j.is_active,j.external_job_id FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.external_job_id LIKE 'manual:%' ORDER BY j.posted_at DESC,j.id DESC");for(const row of rows){const [skills]=await pool.query("SELECT skill_name FROM job_skills WHERE job_id=? ORDER BY skill_name",[row.id]);row.skills=skills.map(x=>x.skill_name)}res.json({jobs:rows})}catch(e){res.status(500).json({error:e.message})}});

app.post("/api/admin/sources/:id/sync",auth,async(req,res)=>{try{res.json(await syncSource(pool,req.params.id))}catch(e){res.status(400).json({error:e.message})}});

app.put("/api/admin/jobs/:id",auth,async(req,res)=>{try{
 const {title,description,location,locationType="unknown",experienceLevel="other",category="Software Engineering",employmentType="",skills=[],applyUrl,postedAt}=req.body||{};
 if(!title||!description||!location||!applyUrl)return res.status(400).json({error:"Title, description, location and apply link are required"});
 if(!/\b(united states|usa|u\.?s\.?)\b/i.test(location)&&!/\b(CA|NY|TX|FL|WA|NJ|MA|IL|VA|NC|GA|AZ|CO|PA|OH|MI|MD|DC|MN|OR|UT|NV|CT|TN|MO|WI|IN|SC|AL|LA|KY|OK|IA|KS|AR|MS|NE|NM|ID|HI|ME|NH|RI|DE|MT|SD|ND|WY|WV|VT|AK)\b/i.test(location))return res.status(422).json({error:"Only USA jobs can be published"});
 const posted=new Date(postedAt||Date.now());if(Number.isNaN(posted.getTime()))return res.status(400).json({error:"Invalid published date"});const expires=new Date(posted.getTime()+30*86400000);
 if(expires<=new Date())return res.status(422).json({error:"Published date is older than 30 days"});
 const [r]=await pool.query("UPDATE jobs SET title=?,description=?,location=?,location_type=?,experience_level=?,category=?,employment_type=?,apply_url=?,source_job_url=?,posted_at=?,expires_at=?,is_active=1 WHERE id=?",[title,description,location,locationType,experienceLevel,category,employmentType||null,applyUrl,applyUrl,posted,expires,req.params.id]);
 if(!r.affectedRows)return res.status(404).json({error:"Job not found"});
 await pool.query("DELETE FROM job_skills WHERE job_id=?",[req.params.id]);for(const skill of (Array.isArray(skills)?skills:[])){const x=String(skill).trim();if(x)await pool.query("INSERT IGNORE INTO job_skills(job_id,skill_name) VALUES(?,?)",[req.params.id,x])}
 res.json({ok:true,message:"Job updated"});
}catch(e){res.status(400).json({error:e.message})}});

app.delete("/api/admin/jobs/:id",auth,async(req,res)=>{const [r]=await pool.query("UPDATE jobs SET is_active=0 WHERE id=?",[req.params.id]);if(!r.affectedRows)return res.status(404).json({error:"Job not found"});res.json({ok:true,message:"Job removed from public index"})});

app.delete("/api/admin/sources/:id",auth,async(req,res)=>{await pool.query("DELETE FROM job_sources WHERE id=?",[req.params.id]);res.json({ok:true})});
app.post("/api/admin/cleanup",auth,async(req,res)=>{const [r]=await pool.query("UPDATE jobs SET is_active=0 WHERE expires_at<NOW() OR country<>'United States'");res.json({deactivated:r.affectedRows})});

let syncRunning=false;
async function syncAllAutoSources(){
 if(syncRunning){console.log("Auto sync skipped: previous scan still running");return}
 syncRunning=true;
 try{
  const [sources]=await pool.query("SELECT id FROM job_sources WHERE auto_sync=1 AND status<>'paused' ORDER BY id");
  for(const s of sources){
   try{
    const result=await syncSource(pool,s.id);
    console.log("Auto sync",s.id,result.imported,"jobs imported");
   }catch(e){
    await pool.query("UPDATE job_sources SET last_checked_at=NOW(),status='error' WHERE id=?",[s.id]);
    console.error("Auto sync failed",s.id,e.message);
   }
  }
 }catch(e){console.error("Auto sync batch failed:",e.message)} finally {syncRunning=false}
}

const port=process.env.PORT||4000;
seedDefaultRecruitmentSources().finally(()=>{
 app.listen(port,()=>{
  console.log(`Talent Inspirations API listening on ${port}`);
  syncAllAutoSources();
  setInterval(syncAllAutoSources,5*60*1000);
 });
});
