import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {scanCareerPage} from "./careerAgent.js";
import {whatsapp} from "./whatsappWeb.js";
import {createCheckout,constructWebhook,billingConfigured,PLANS,getPlan} from "./billing.js";
import multer from "multer";
import {importCareerWorkbook} from "./sourceWorkbook.js";
import {ensureJobIntelligence,buildTodayBuckets} from "./candidateEngine.js";

const app=express();
app.use(cors());
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
const pool=mysql.createPool({
 host:process.env.DB_HOST||"127.0.0.1",
 port:Number(process.env.DB_PORT||3306),
 user:process.env.DB_USER,
 password:process.env.DB_PASSWORD,
 database:process.env.DB_NAME||"talent_inspirations",
 waitForConnections:true,
 connectionLimit:10,
 queueLimit:0
});
const JWT_SECRET=process.env.JWT_SECRET||"change-me";
const PORT=Number(process.env.PORT||4000);
const COUNTRIES=["USA","UK","Canada","Australia","Germany","Netherlands","Ireland","France","Japan","Singapore","UAE","Saudi Arabia","New Zealand","Switzerland","Sweden","Norway","Denmark","Finland","Belgium","Austria"];
const COUNTRY_NAMES={USA:"United States",UK:"United Kingdom",Canada:"Canada",Australia:"Australia",Germany:"Germany",Netherlands:"Netherlands",Ireland:"Ireland",France:"France",Japan:"Japan",Singapore:"Singapore",UAE:"United Arab Emirates","Saudi Arabia":"Saudi Arabia","New Zealand":"New Zealand",Switzerland:"Switzerland",Sweden:"Sweden",Norway:"Norway",Denmark:"Denmark",Finland:"Finland",Belgium:"Belgium",Austria:"Austria"};
const INDUSTRIES=["Healthcare","University & Education","Supply Chain","Technology","Finance & Banking","Insurance","Consulting","Retail","Manufacturing","Government","Pharmaceuticals","Energy","Telecommunications","Other"];
const CATEGORIES=["Software Engineering","DevOps","Data","Cybersecurity","QA","AI/ML"];

function tokenFor(payload){return jwt.sign(payload,JWT_SECRET,{expiresIn:"7d"})}
function userAuth(req,res,next){
 try{const p=jwt.verify((req.headers.authorization||"").replace(/^Bearer\s+/i,""),JWT_SECRET);if(p.type!=="user")throw new Error();req.user=p;next()}catch{res.status(401).json({error:"Login required"})}
}
function adminAuth(req,res,next){
 try{const p=jwt.verify((req.headers.authorization||"").replace(/^Bearer\s+/i,""),JWT_SECRET);if(p.type!=="admin")throw new Error();req.admin=p;next()}catch{res.status(401).json({error:"Admin login required"})}
}
function parseSkills(v){if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean).slice(0,30);try{return JSON.parse(v||"[]")}catch{return String(v||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,30)}}
function entitled(user){
 if(user.plan==="pro")return true;
 if(user.plan==="admin_granted"&&(!user.grant_until||new Date(user.grant_until)>new Date()))return true;
 return false;
}
function normalizeCountry(country){const c=String(country||"USA").trim();return COUNTRIES.includes(c)?c:"USA"}
function normalizePhone(phone){return String(phone||"").replace(/[^\d+]/g,"").replace(/^00/,"+")}
async function upsertCompany(name,careerUrl,industry,country="USA"){
 const [rows]=await pool.query("SELECT id FROM companies WHERE name=? LIMIT 1",[name]);
 if(rows[0]){await pool.query("UPDATE companies SET career_url=?,industry=?,country=? WHERE id=?",[careerUrl,industry||"Other",normalizeCountry(country),rows[0].id]);return rows[0].id}
 const [r]=await pool.query("INSERT INTO companies(name,career_url,industry,country) VALUES(?,?,?,?)",[name,careerUrl,industry||"Other",normalizeCountry(country)]);return r.insertId;
}
async function upsertSource(name,url,industry,country="USA"){
 const companyId=await upsertCompany(name,url,industry,country);
 const [rows]=await pool.query("SELECT id FROM career_sources WHERE source_url=? LIMIT 1",[url]);
 if(rows[0])return rows[0].id;
 const [r]=await pool.query("INSERT INTO career_sources(company_id,source_url,country,source_type,auto_sync,status) VALUES(?,?,?, ?,1,'active')",[companyId,url,normalizeCountry(country),"generic"]);
 return r.insertId;
}
async function notifyMatchingUsers(job){
 const [alerts]=await pool.query(`SELECT a.*,u.name,u.whatsapp_number,u.whatsapp_opt_in,u.plan,u.grant_until
 FROM job_alerts a JOIN users u ON u.id=a.user_id
 WHERE a.active=1 AND u.status='active' AND u.whatsapp_opt_in=1 AND u.whatsapp_number IS NOT NULL`);
 const text=(job.title+" "+job.description+" "+job.location+" "+(job.skills||[]).join(" ")).toLowerCase();
 for(const a of alerts){
  const terms=String(a.keyword||"").toLowerCase().split(/[,|]+/).map(x=>x.trim()).filter(Boolean);
  const skillList=parseSkills(a.skills_json);
  const keywordHit=!terms.length||terms.some(t=>text.includes(t));
  const categoryHit=!a.category||a.category===job.category;
  const industryHit=!a.industry||a.industry===job.industry;
  const locationHit=!a.location||String(job.location||"").toLowerCase().includes(String(a.location).toLowerCase());
  const skillHit=!skillList.length||skillList.some(s=>text.includes(String(s).toLowerCase()));
  if(!keywordHit||!categoryHit||!industryHit||!locationHit||!skillHit)continue;
  if(!entitled(a))continue;
  const msg=`🌍 New Job Alert · ${job.country||"Selected market"}\n\n${job.title}\n${job.company}\n${job.location||"USA"}\nCategory: ${job.category}\nSkills: ${(job.skills||[]).slice(0,8).join(", ")||"See job details"}\n\nApply: ${job.apply_url}\n\nTalent Inspirations`;
  try{
   await whatsapp.send(normalizePhone(a.whatsapp_number),msg,{type:"job_alert",jobId:job.id,alertId:a.id});
   const status="queued";
   await pool.query("INSERT INTO whatsapp_messages(user_id,job_id,phone,message_text,provider_message_id,status,error_text,sent_at) VALUES(?,?,?,?,?,?,?,?)",[a.user_id,job.id,a.whatsapp_number,msg,null,status,null,null]);
   await pool.query("UPDATE job_alerts SET last_sent_at=NOW() WHERE id=?",[a.id]);
  }catch(e){
   await pool.query("INSERT INTO whatsapp_messages(user_id,job_id,phone,message_text,status,error_text) VALUES(?,?,?,?,?,?)",[a.user_id,job.id,a.whatsapp_number,msg,"failed",e.message]);
  }
 }
}
async function saveJobs(source,jobs){
 let imported=0,newJobs=0;const seen=new Set();
 for(const j of jobs){
  if(!j.title||!j.applyUrl)continue;
  const external=String(j.externalJobId||j.applyUrl);
  seen.add(external);
  const posted=new Date(j.postedAt||Date.now());
  if(Number.isNaN(posted.getTime()))continue;
  const expires=new Date(posted.getTime()+30*86400000);
  if(expires<=new Date())continue;
  const skills=Array.isArray(j.skills)?j.skills:[];
  const [existing]=await pool.query("SELECT id FROM jobs WHERE source_id=? AND external_job_id=? LIMIT 1",[source.id,external]);
  const sql=`INSERT INTO jobs(company_id,source_id,external_job_id,title,description,location,country,location_type,experience_level,category,employment_type,skills_json,apply_url,source_job_url,posted_at,date_source,first_seen_at,last_seen_at,expires_at,is_active)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),?,1)
  ON DUPLICATE KEY UPDATE company_id=VALUES(company_id),title=VALUES(title),description=VALUES(description),location=VALUES(location),location_type=VALUES(location_type),experience_level=VALUES(experience_level),category=VALUES(category),employment_type=VALUES(employment_type),skills_json=VALUES(skills_json),apply_url=VALUES(apply_url),source_job_url=VALUES(source_job_url),posted_at=VALUES(posted_at),date_source=VALUES(date_source),last_seen_at=NOW(),expires_at=VALUES(expires_at),is_active=1,updated_at=NOW()`;
  const params=[source.company_id,source.id,external,j.title,j.description||"",j.location||"",source.country||"USA",j.locationType||"unknown",j.experienceLevel||"other",j.category||"Software Engineering",j.employmentType||null,JSON.stringify(skills),j.applyUrl,j.applyUrl,posted,j.dateSource||"published",expires];
  await pool.query(sql,params);
  const [row]=await pool.query("SELECT id FROM jobs WHERE source_id=? AND external_job_id=? LIMIT 1",[source.id,external]);
  const jobId=row[0]?.id;
  if(!jobId)continue;
  imported++;
  if(!existing[0])newJobs++;
  if(!existing[0]){
   const [company]=await pool.query("SELECT name,industry FROM companies WHERE id=?",[source.company_id]);
   await notifyMatchingUsers({id:jobId,...j,company:company[0]?.name||"",industry:company[0]?.industry||"Other",apply_url:j.applyUrl});
  }
 }
 if(seen.size){
  const ids=[...seen];const ph=ids.map(()=>"?").join(",");
  await pool.query(`UPDATE jobs SET is_active=0 WHERE source_id=? AND external_job_id NOT IN (${ph}) AND last_seen_at<DATE_SUB(NOW(),INTERVAL 4 MINUTE)`,[source.id,...ids]);
 }
 await pool.query(`UPDATE jobs SET is_active=0 WHERE expires_at<=NOW() OR country NOT IN ("USA","UK","Canada","Australia","Germany","Netherlands","Ireland","France","Japan","Singapore","UAE","Saudi Arabia","New Zealand","Switzerland","Sweden","Norway","Denmark","Finland","Belgium","Austria")`);
 return {imported,newJobs,seen:seen.size};
}
async function scanSource(sourceId){
 const [rows]=await pool.query("SELECT s.*,c.name company,c.industry FROM career_sources s JOIN companies c ON c.id=s.company_id WHERE s.id=? LIMIT 1",[sourceId]);
 if(!rows[0])throw new Error("Source not found");
 const source=rows[0];const run=(await pool.query("INSERT INTO agent_runs(source_id,started_at,status) VALUES(?,NOW(),'running')",[sourceId]))[0];
 const runId=run.insertId;
 try{
  const result=await scanCareerPage(source.source_url,source.country);
  const saved=await saveJobs(source,result);
  await pool.query("UPDATE career_sources SET status='active',last_checked_at=NOW(),last_success_at=NOW(),last_sync_found=?,last_sync_imported=?,last_error=NULL,discovered_ats=? WHERE id=?",[result.length,saved.imported,result.ats||"generic",sourceId]);
  await pool.query("UPDATE agent_runs SET finished_at=NOW(),status='success',found_count=?,imported_count=?,message=? WHERE id=?",[result.length,saved.imported,`ATS ${result.ats||"generic"}; new ${saved.newJobs}`,runId]);
  return {sourceId,company:source.company,found:result.length,imported:saved.imported,newJobs:saved.newJobs,ats:result.ats||"generic"};
 }catch(e){
  await pool.query("UPDATE career_sources SET status='error',last_checked_at=NOW(),last_error=? WHERE id=?",[e.message,sourceId]);
  await pool.query("UPDATE agent_runs SET finished_at=NOW(),status='error',message=? WHERE id=?",[e.message,runId]);
  throw e;
 }
}
let scanning=false;
async function scanAll(){
 if(scanning)return;
 scanning=true;const started=Date.now();
 try{
  const [sources]=await pool.query("SELECT id FROM career_sources WHERE auto_sync=1 AND status<>'paused' ORDER BY id");
  for(let i=0;i<sources.length;i+=5){
   await Promise.all(sources.slice(i,i+5).map(s=>scanSource(s.id).then(x=>console.log("Career Agent",JSON.stringify(x))).catch(e=>console.error("Career Agent source",s.id,e.message))));
  }
  console.log("Career Agent complete",sources.length,"sources",Math.round((Date.now()-started)/1000),"sec");
 }finally{scanning=false}
}

app.post("/api/billing/webhook",express.raw({type:"application/json"}),async(req,res)=>{
 try{
  const event=constructWebhook(req.body,req.headers["stripe-signature"]);
  const obj=event.data.object;
  if(["checkout.session.completed","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
   const userId=Number(obj.metadata?.user_id||obj.client_reference_id||0);
   if(userId){
    const active=event.type!=="customer.subscription.deleted"&&(obj.status==="active"||obj.status==="trialing"||event.type==="checkout.session.completed");
    const planCode=obj.metadata?.plan_code||"pro_31";
    const plan=getPlan(planCode);
    const end=event.type==="checkout.session.completed"?new Date(Date.now()+Number(obj.metadata?.duration_days||plan.durationDays)*86400000):(obj.current_period_end?new Date(obj.current_period_end*1000):null);
    await pool.query("UPDATE users SET plan=?,grant_until=?,updated_at=NOW() WHERE id=?",[active?"pro":"free",active?end:null,userId]);
    await pool.query("INSERT INTO subscriptions(user_id,provider,provider_customer_id,provider_subscription_id,status,plan_name,current_period_end) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),current_period_end=VALUES(current_period_end),provider_subscription_id=VALUES(provider_subscription_id),provider_customer_id=VALUES(provider_customer_id)",[userId,"stripe",obj.customer||null,obj.subscription||obj.id,event.type==="customer.subscription.deleted"?"canceled":(obj.status||"active"),plan.name,end]);
   }
  }
  res.json({received:true});
 }catch(e){res.status(400).send("Webhook error")}
});
app.use(express.json({limit:"2mb"}));

app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"talent-inspirations",database:"connected",agent:"5-minute-career-agent",whatsapp:whatsapp.status()})}catch(e){res.status(503).json({ok:false,error:e.message})}});
app.get("/api/meta",(req,res)=>res.json({countries:COUNTRIES.map(code=>({code,name:COUNTRY_NAMES[code]})),industries:INDUSTRIES,categories:CATEGORIES,dateWindows:[3,7,15,30],plans:PLANS,features:["Career Agent","WhatsApp Web JS Alerts","Website Q&A Bot","Subscriptions","Admin Grants","Today Job Buckets","JD Intelligence","Tailored Resume","Cover Letter","Chrome Autofill"]}));

app.get("/api/jobs",async(req,res)=>{
 try{
  const days=[3,7,15,30].includes(Number(req.query.days))?Number(req.query.days):30;
  const p=[];const where=[`j.is_active=1`, `j.country IN ("USA","UK","Canada","Australia","Germany","Netherlands","Ireland","France","Japan","Singapore","UAE","Saudi Arabia","New Zealand","Switzerland","Sweden","Norway","Denmark","Finland","Belgium","Austria")`, "j.expires_at>NOW()", `COALESCE(j.posted_at,j.first_seen_at)>=DATE_SUB(NOW(),INTERVAL ${days} DAY)`];
  if(req.query.country){const c=normalizeCountry(req.query.country);where.push("j.country=?");p.push(c)}
  if(req.query.q){const t="%"+String(req.query.q).trim().toLowerCase()+"%";where.push("(LOWER(j.title) LIKE ? OR LOWER(j.description) LIKE ? OR LOWER(j.location) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(j.category) LIKE ? OR LOWER(CAST(j.skills_json AS CHAR)) LIKE ?)");p.push(t,t,t,t,t,t)}
  if(req.query.category){where.push("j.category=?");p.push(req.query.category)}
  if(req.query.industry){where.push("c.industry=?");p.push(req.query.industry)}
  if(req.query.level){where.push("j.experience_level=?");p.push(req.query.level)}
  if(req.query.location){where.push("LOWER(j.location) LIKE ?");p.push("%"+String(req.query.location).toLowerCase()+"%")}
  const [jobs]=await pool.query(`SELECT j.id,j.company_id,c.name company,c.industry,j.country,j.title,j.description,j.location,j.location_type,j.experience_level,j.category,j.employment_type,j.skills_json,j.apply_url,j.source_job_url,j.posted_at,j.date_source,j.first_seen_at FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${where.join(" AND ")} ORDER BY COALESCE(j.posted_at,j.first_seen_at) DESC,j.id DESC LIMIT 500`,p);
  jobs.forEach(j=>{try{j.skills=JSON.parse(j.skills_json||"[]")}catch{j.skills=[]}delete j.skills_json});
  res.json({jobs,days});
 }catch(e){res.status(500).json({error:e.message})}
});
app.get("/api/jobs/:id",async(req,res)=>{
 const [rows]=await pool.query("SELECT j.*,c.name company,c.industry,c.career_url FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=? AND j.is_active=1 AND j.expires_at>NOW() LIMIT 1",[req.params.id]);
 if(!rows[0])return res.status(404).json({error:"Job is no longer active"});
 const j=rows[0];try{j.skills=JSON.parse(j.skills_json||"[]")}catch{j.skills=[]}delete j.skills_json;res.json({job:j});
});
app.get("/api/companies/:id",async(req,res)=>{const [rows]=await pool.query("SELECT c.*,COUNT(j.id) current_hiring FROM companies c LEFT JOIN jobs j ON j.company_id=c.id AND j.is_active=1 AND j.expires_at>NOW() AND COALESCE(j.posted_at,j.first_seen_at)>=DATE_SUB(NOW(),INTERVAL 30 DAY) WHERE c.id=? GROUP BY c.id",[req.params.id]);if(!rows[0])return res.status(404).json({error:"Company not found"});res.json({company:rows[0]})});
app.get("/api/companies/:id/jobs",async(req,res)=>{const [jobs]=await pool.query("SELECT j.*,c.name company,c.industry FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.company_id=? AND j.is_active=1 AND j.expires_at>NOW() AND COALESCE(j.posted_at,j.first_seen_at)>=DATE_SUB(NOW(),INTERVAL 30 DAY) ORDER BY COALESCE(j.posted_at,j.first_seen_at) DESC",[req.params.id]);jobs.forEach(j=>{try{j.skills=JSON.parse(j.skills_json||"[]")}catch{j.skills=[]}delete j.skills_json});res.json({jobs})});
app.get("/api/bot/answer",async(req,res)=>{try{res.json({answer:await websiteAnswer(req.query?.q||"")})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/bot/answer",async(req,res)=>{try{res.json({answer:await websiteAnswer(req.body?.question)})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/industries",async(req,res)=>{const [rows]=await pool.query("SELECT c.industry,COUNT(j.id) current_jobs FROM companies c LEFT JOIN jobs j ON j.company_id=c.id AND j.is_active=1 AND j.country='USA' AND j.expires_at>NOW() AND COALESCE(j.posted_at,j.first_seen_at)>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY c.industry ORDER BY current_jobs DESC");res.json({industries:rows})});

app.post("/api/auth/register",async(req,res)=>{try{const{name="",email,password,whatsappNumber="",country="USA"}=req.body||{};if(!email||!password)return res.status(400).json({error:"Email and password are required"});const hash=await bcrypt.hash(password,12);const phone=normalizePhone(whatsappNumber);const [r]=await pool.query("INSERT INTO users(name,email,password_hash,whatsapp_number,country) VALUES(?,?,?,?,?)",[name,email.toLowerCase(),hash,phone||null,normalizeCountry(country)]);res.json({token:tokenFor({type:"user",id:r.insertId}),user:{id:r.insertId,name,email,country:normalizeCountry(country),whatsapp_number:phone}})}catch(e){res.status(400).json({error:e.code==="ER_DUP_ENTRY"?"Email already registered":e.message})}});
app.post("/api/auth/login",async(req,res)=>{const [rows]=await pool.query("SELECT * FROM users WHERE email=? LIMIT 1",[String(req.body?.email||"").toLowerCase()]);if(!rows[0]||!rows[0].password_hash||!(await bcrypt.compare(String(req.body?.password||""),rows[0].password_hash)))return res.status(401).json({error:"Invalid email or password"});res.json({token:tokenFor({type:"user",id:rows[0].id}),user:{id:rows[0].id,name:rows[0].name,email:rows[0].email,country:rows[0].country,whatsapp_number:rows[0].whatsapp_number,whatsapp_opt_in:rows[0].whatsapp_opt_in,plan:rows[0].plan,grant_until:rows[0].grant_until}})});
app.get("/api/account",userAuth,async(req,res)=>{const [rows]=await pool.query("SELECT id,name,email,country,whatsapp_number,whatsapp_opt_in,profile_skills_json,master_cv_text,master_cv_name,master_cv_updated_at,plan,grant_until,created_at FROM users WHERE id=?",[req.user.id]);const [alerts]=await pool.query("SELECT * FROM job_alerts WHERE user_id=? ORDER BY created_at DESC",[req.user.id]);try{rows[0].profile_skills=JSON.parse(rows[0].profile_skills_json||"[]")}catch{rows[0].profile_skills=[]}delete rows[0].profile_skills_json;res.json({user:rows[0],alerts,billingConfigured:billingConfigured()})});
app.post("/api/account/skills",userAuth,async(req,res)=>{const skills=parseSkills(req.body?.skills);await pool.query("UPDATE users SET profile_skills_json=? WHERE id=?",[JSON.stringify(skills),req.user.id]);res.json({ok:true,skills})});
app.get("/api/account/today-buckets",userAuth,async(req,res)=>{try{res.json({buckets:await buildTodayBuckets(pool,req.user.id)})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/account/job/:id/intelligence",userAuth,async(req,res)=>{try{const data=await ensureJobIntelligence(pool,Number(req.params.id),req.user.id);if(!data)return res.status(404).json({error:"Job not found"});res.json({intelligence:data})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/account/job/:id/prepare",userAuth,async(req,res)=>{try{const data=await ensureJobIntelligence(pool,Number(req.params.id),req.user.id);if(!data)return res.status(404).json({error:"Job not found"});await pool.query("INSERT INTO applications(user_id,job_id,status,apply_url,resume_snapshot,cover_letter_snapshot,extension_source) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status='prepared',apply_url=VALUES(apply_url),resume_snapshot=VALUES(resume_snapshot),cover_letter_snapshot=VALUES(cover_letter_snapshot),extension_source=VALUES(extension_source)",[req.user.id,data.job.id,"prepared",data.job.apply_url,data.tailoredResume,data.coverLetter,"web"]);res.json({ok:true,package:data})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/account/applications",userAuth,async(req,res)=>{const [rows]=await pool.query("SELECT a.*,j.title,j.company_id,c.name company,j.location,j.country FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 500",[req.user.id]);res.json({applications:rows})});
app.post("/api/account/master-cv",userAuth,async(req,res)=>{const text=String(req.body?.text||"").trim();const name=String(req.body?.name||"Master CV").slice(0,255);if(text.length<40)return res.status(400).json({error:"Master CV text should contain at least 40 characters"});await pool.query("UPDATE users SET master_cv_text=?,master_cv_name=?,master_cv_updated_at=NOW() WHERE id=?",[text,name,req.user.id]);res.json({ok:true})});
app.post("/api/account/applications/:id/status",userAuth,async(req,res)=>{const allowed=["saved","prepared","applied","failed"];const status=allowed.includes(req.body?.status)?req.body.status:"prepared";await pool.query("UPDATE applications SET status=?,applied_at=IF(?='applied',NOW(),applied_at) WHERE id=? AND user_id=?",[status,status,req.params.id,req.user.id]);res.json({ok:true,status})});
app.post("/api/account/whatsapp",userAuth,async(req,res)=>{const phone=normalizePhone(req.body?.whatsappNumber);const opt=Boolean(req.body?.optIn);if(opt&&!/^\+\d{8,15}$/.test(phone))return res.status(400).json({error:"Use WhatsApp number in international format, e.g. +919876543210"});await pool.query("UPDATE users SET whatsapp_number=?,whatsapp_opt_in=? WHERE id=?",[phone||null,opt,req.user.id]);res.json({ok:true})});
app.post("/api/alerts",userAuth,async(req,res)=>{const{keyword="",category="",industry="",location="",daysWindow=30,skills=[]}=req.body||{};if(!keyword&&!category&&!industry&&!location&&!skills.length)return res.status(400).json({error:"Add at least one alert condition"});const days=[3,7,15,30].includes(Number(daysWindow))?Number(daysWindow):30;const [r]=await pool.query("INSERT INTO job_alerts(user_id,keyword,category,industry,location,skills_json,days_window) VALUES(?,?,?,?,?,?,?)",[req.user.id,keyword,category||null,industry||null,location||null,JSON.stringify(parseSkills(skills)),days]);res.json({ok:true,id:r.insertId})});
app.delete("/api/alerts/:id",userAuth,async(req,res)=>{await pool.query("UPDATE job_alerts SET active=0 WHERE id=? AND user_id=?",[req.params.id,req.user.id]);res.json({ok:true})});
app.get("/api/billing/plans",(req,res)=>res.json({plans:PLANS}));
app.post("/api/billing/checkout",userAuth,async(req,res)=>{try{const [u]=await pool.query("SELECT email FROM users WHERE id=?",[req.user.id]);const s=await createCheckout({userId:req.user.id,email:u[0]?.email,planCode:req.body?.planCode||"pro_31"});res.json({url:s.url})}catch(e){res.status(400).json({error:e.message})}});

app.post("/api/admin/login",async(req,res)=>{const [rows]=await pool.query("SELECT * FROM admin_users WHERE email=? LIMIT 1",[String(req.body?.email||"").toLowerCase()]);if(!rows[0]||!(await bcrypt.compare(String(req.body?.password||""),rows[0].password_hash)))return res.status(401).json({error:"Invalid admin credentials"});res.json({token:tokenFor({type:"admin",id:rows[0].id,email:rows[0].email})})});
app.get("/api/admin/dashboard",adminAuth,async(req,res)=>{const [[stats]]=await pool.query("SELECT (SELECT COUNT(*) FROM jobs WHERE is_active=1) jobs,(SELECT COUNT(*) FROM companies) companies,(SELECT COUNT(*) FROM career_sources WHERE status='active') sources,(SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM job_alerts WHERE active=1) alerts");const [recent]=await pool.query("SELECT ar.id,c.name company,ar.found_count,ar.imported_count,ar.status,ar.started_at,ar.message FROM agent_runs ar LEFT JOIN career_sources s ON s.id=ar.source_id LEFT JOIN companies c ON c.id=s.company_id ORDER BY ar.id DESC LIMIT 20");res.json({stats,recent})});
app.get("/api/admin/jobs",adminAuth,async(req,res)=>{
 const [rows]=await pool.query(`SELECT j.id,j.title,j.country,j.location,j.category,j.experience_level,j.is_active,j.posted_at,j.first_seen_at,j.apply_url,c.name company,s.source_url,s.status source_status
 FROM jobs j JOIN companies c ON c.id=j.company_id LEFT JOIN career_sources s ON s.id=j.source_id
 ORDER BY j.id DESC LIMIT 500`);
 res.json({jobs:rows});
});
app.get("/api/admin/countries",adminAuth,async(req,res)=>{
 const [rows]=await pool.query(`SELECT country,COUNT(*) total_jobs,SUM(is_active=1) active_jobs,COUNT(DISTINCT company_id) companies
 FROM jobs GROUP BY country ORDER BY active_jobs DESC,country`);
 res.json({countries:rows});
});
app.get("/api/admin/companies",adminAuth,async(req,res)=>{
 const [rows]=await pool.query(`SELECT c.id,c.name,c.country,c.industry,c.career_url,COUNT(j.id) total_jobs,SUM(j.is_active=1) active_jobs,COUNT(DISTINCT s.id) sources
 FROM companies c LEFT JOIN jobs j ON j.company_id=c.id LEFT JOIN career_sources s ON s.company_id=c.id
 GROUP BY c.id ORDER BY active_jobs DESC,c.name LIMIT 500`);
 res.json({companies:rows});
});
app.get("/api/admin/runs",adminAuth,async(req,res)=>{
 const [rows]=await pool.query(`SELECT ar.id,ar.source_id,ar.started_at,ar.finished_at,ar.status,ar.found_count,ar.imported_count,ar.message,c.name company,s.country,s.source_url
 FROM agent_runs ar LEFT JOIN career_sources s ON s.id=ar.source_id LEFT JOIN companies c ON c.id=s.company_id
 ORDER BY ar.id DESC LIMIT 500`);
 res.json({runs:rows});
});
app.get("/api/admin/subscriptions",adminAuth,async(req,res)=>{
 const [rows]=await pool.query(`SELECT s.*,u.email,u.name,u.country FROM subscriptions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 500`);
 res.json({subscriptions:rows});
});
app.get("/api/admin/sources",adminAuth,async(req,res)=>{const [rows]=await pool.query("SELECT s.id,s.company_id,c.name company,c.industry,s.country,s.source_url,s.source_type,s.status,s.last_checked_at,s.last_success_at,s.last_sync_found,s.last_sync_imported,s.last_error,s.discovered_ats FROM career_sources s JOIN companies c ON c.id=s.company_id ORDER BY c.name");res.json({sources:rows})});
app.post("/api/admin/sources/import-excel",adminAuth,upload.single("file"),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:"Excel file is required"});const result=await importCareerWorkbook(req.file.buffer,{adminId:req.admin.id,pool,upsertSource,scanSource});res.json({ok:true,...result})}catch(e){res.status(400).json({error:e.message})}});
app.post("/api/admin/sources",adminAuth,async(req,res)=>{try{const{name,companyName,url,careerUrl,industry="Other",country="USA"}=req.body||{};const company=name||companyName;const sourceUrl=url||careerUrl;if(!company||!sourceUrl)return res.status(400).json({error:"Company and career URL are required"});const id=await upsertSource(company,sourceUrl,industry,normalizeCountry(country));res.json({ok:true,id,message:"Career Agent source added. It will be scanned automatically every 5 minutes."})}catch(e){res.status(400).json({error:e.message})}});
app.post("/api/admin/sources/:id/scan",adminAuth,async(req,res)=>{try{res.json(await scanSource(req.params.id))}catch(e){res.status(400).json({error:e.message})}});
app.delete("/api/admin/sources/:id",adminAuth,async(req,res)=>{await pool.query("DELETE FROM career_sources WHERE id=?",[req.params.id]);res.json({ok:true,message:"Source and its imported jobs removed"})});

const HEALTHCARE=[
 ["CVS Health","https://jobs.cvshealth.com/"],
 ["The Cigna Group","https://jobs.thecignagroup.com/"],
 ["UnitedHealth Group","https://careers.unitedhealthgroup.com/search-jobs"],
 ["Elevance Health","https://careers.elevancehealth.com/jobs"],
 ["HCA Healthcare","https://careers.hcahealthcare.com/"]
];
app.get("/api/extension/job/:id/package",userAuth,async(req,res)=>{try{const data=await ensureJobIntelligence(pool,Number(req.params.id),req.user.id);if(!data)return res.status(404).json({error:"Job not found"});res.json({job:{id:data.job.id,title:data.job.title,company:data.job.company,apply_url:data.job.apply_url},resume:data.tailoredResume,coverLetter:data.coverLetter,atsScore:data.atsScore,fields:{name:"name",email:"email",phone:"phone",resume:"resume",coverLetter:"cover letter"}})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/admin/whatsapp",adminAuth,(req,res)=>res.json(whatsapp.status()));
app.post("/api/admin/agent-command",adminAuth,async(req,res)=>{
 const command=String(req.body?.command||"").trim().toLowerCase();
 if(!command)return res.status(400).json({error:"Command is required"});
 let selected=[];
 if(/healthcare|health care|hospital|pharma/.test(command))selected=HEALTHCARE;
 if(/add|import|scan|find|career|link/.test(command)&&selected.length){
  const added=[];for(const [name,url] of selected){const id=await upsertSource(name,url,/pharma/i.test(name)?"Pharmaceuticals":"Healthcare");added.push({name,url,id})}
  return res.json({ok:true,message:`Career Agent added ${added.length} healthcare career sources. They will be scanned every 5 minutes.`,added});
 }
 if(/status|report|how many|stats/.test(command)){const [[x]]=await pool.query("SELECT COUNT(*) sources,(SELECT COUNT(*) FROM jobs WHERE is_active=1) jobs FROM career_sources");return res.json({ok:true,message:`Agent currently has ${x.sources} sources and ${x.jobs} active jobs across supported markets.`})}
 res.json({ok:true,message:"I can currently handle commands like: 'add all healthcare career links', 'agent status'. More source packs can be added to this command catalog."});
});
app.get("/api/admin/users",adminAuth,async(req,res)=>{const [rows]=await pool.query("SELECT id,name,email,country,whatsapp_number,whatsapp_opt_in,plan,grant_until,master_cv_name,master_cv_updated_at,created_at FROM users ORDER BY id DESC LIMIT 500");res.json({users:rows})});
app.post("/api/admin/users/:id/grant",adminAuth,async(req,res)=>{const until=req.body?.until?new Date(req.body.until):null;await pool.query("UPDATE users SET plan='admin_granted',grant_until=? WHERE id=?",[until,req.params.id]);res.json({ok:true,message:"User granted free access until "+(until?until.toISOString():"revoked manually")})});
app.post("/api/admin/users/:id/revoke",adminAuth,async(req,res)=>{await pool.query("UPDATE users SET plan='free',grant_until=NULL WHERE id=?",[req.params.id]);res.json({ok:true})});
app.get("/api/admin/applications",adminAuth,async(req,res)=>{const [rows]=await pool.query("SELECT a.*,u.email,j.title,c.name company,j.country FROM applications a JOIN users u ON u.id=a.user_id JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id ORDER BY a.created_at DESC LIMIT 1000");res.json({applications:rows})});
app.get("/api/admin/pricing",adminAuth,async(req,res)=>{const [rows]=await pool.query("SELECT * FROM pricing_plans WHERE active=1 ORDER BY duration_days");res.json({plans:rows})});
app.get("/api/admin/alerts",adminAuth,async(req,res)=>{const [rows]=await pool.query("SELECT a.*,u.email,u.whatsapp_number,u.plan FROM job_alerts a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 500");res.json({alerts:rows})});

const attachWhatsAppBot=()=>{whatsapp.on("message",async msg=>{try{if(!msg?.body||msg.fromMe||msg.from==="status@broadcast"||msg.isGroupMsg)return;const answer=await websiteAnswer(msg.body);await msg.reply(answer)}catch(e){console.error("WhatsApp bot reply:",e.message)}})};
const websiteAnswer=async question=>{
 const q=String(question||"").toLowerCase();
 if(/plan|pricing|price|subscription|pro/.test(q))return "Talent Inspirations has a free job-search experience and a Pro subscription for personalized job alerts and WhatsApp delivery. Admin-granted users can receive free access for a period chosen by the admin.";
 if(/benefit|feature|what.*get|why.*pro/.test(q))return "Pro is designed for personalized job alerts: role, category, industry, location and skills. Matching jobs from the user's selected country can be delivered through WhatsApp when the user opts in.";
 if(/3.*day|7.*day|15.*day|30.*day|recent|latest/.test(q))return "You can filter live jobs by country and by Last 3 Days, Last 1 Week, Last 15 Days or Last 30 Days.";
 if(/usa|united states|location/.test(q))return "Talent Inspirations supports 20 countries. The Career Agent keeps active employer listings for the selected country and filters out other locations.";
 if(/alert|notification|whatsapp/.test(q))return "Users can create alerts using role, category, industry, location and skills. WhatsApp delivery requires opt-in and is sent individually, not as a broadcast.";
 if(/career agent|agent|how.*work|scan/.test(q))return "The Career Agent scans admin-added public career pages every 5 minutes, detects supported public ATS feeds or structured job data, maps skills and maintains the active country-specific job index.";
 return "I can answer questions about Talent Inspirations plans, benefits, country filters, jobs, alerts, WhatsApp delivery and how the Career Agent works.";
};
const seed=async()=>{
 const count=(await pool.query("SELECT COUNT(*) n FROM career_sources"))[0][0].n;
 if(count===0){
  for(const [name,url] of HEALTHCARE)await upsertSource(name,url,"Healthcare");
  console.log("Seeded first 5 healthcare career sources");
 }
};
await seed();
attachWhatsAppBot();
app.listen(PORT,async()=>{console.log(`Talent Inspirations API listening on ${PORT}`);whatsapp.start().catch(e=>console.error("WhatsApp Web startup:",e.message));scanAll();setInterval(scanAll,5*60*1000)});
