import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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

app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"talent-inspirations",scope:"USA-only",database:"connected"})}catch(e){res.status(503).json({ok:false,database:"unavailable"})}});
app.get("/api/jobs",async(req,res)=>{const {q="",level="",category:cat="",location=""}=req.query;const where=["j.is_active=1","j.expires_at>=NOW()","LOWER(j.country)='united states'"];const p=[];if(q){where.push("(j.title LIKE ? OR j.description LIKE ? OR j.location LIKE ?)");p.push(`%${q}%`,`%${q}%`,`%${q}%`)}if(level){where.push("j.experience_level=?");p.push(level)}if(cat){where.push("j.category=?");p.push(cat)}if(location){where.push("j.location LIKE ?");p.push(`%${location}%`)}const [rows]=await pool.query(`SELECT j.id,c.name company,j.title,j.description,j.location,j.location_type,j.experience_level,j.category,j.apply_url,j.posted_at,j.expires_at,(SELECT JSON_ARRAYAGG(js.skill_name) FROM job_skills js WHERE js.job_id=j.id) skills FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${where.join(" AND ")} ORDER BY COALESCE(j.posted_at,j.first_seen_at) DESC`,p);res.json({jobs:rows})});

app.post("/api/admin/login",async(req,res)=>{const {email,password}=req.body||{};if(!email||!password)return res.status(400).json({error:"Email and password required"});const [rows]=await pool.query("SELECT * FROM admin_users WHERE email=? LIMIT 1",[email]);if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"Invalid credentials"});res.json({token:jwt.sign({id:rows[0].id,email:rows[0].email,role:rows[0].role},JWT_SECRET,{expiresIn:"12h"})})});

app.get("/api/admin/sources",auth,async(req,res)=>{const [rows]=await pool.query("SELECT s.*,c.name company FROM job_sources s JOIN companies c ON c.id=s.company_id ORDER BY s.id DESC");res.json({sources:rows})});

app.post("/api/admin/sources",auth,async(req,res)=>{try{const {companyName,careerUrl}=req.body||{};const url=normalizeCareerUrl(careerUrl);if(!companyName)return res.status(400).json({error:"Company name required"});const [c]=await pool.query("INSERT INTO companies(name,career_url) VALUES(?,?)",[companyName,url]);await pool.query("INSERT INTO job_sources(company_id,source_url) VALUES(?,?)",[c.insertId,url]);res.status(201).json({message:"USA career source added",companyId:c.insertId})}catch(e){res.status(400).json({error:e.message})}});

app.post("/api/admin/jobs",auth,async(req,res)=>{const {companyId,title,description,location,applyUrl,postedAt,locationType="unknown"}=req.body||{};if(!companyId||!title||!description||!location||!applyUrl)return res.status(400).json({error:"companyId, title, description, location and applyUrl are required"});if(!isUSJob(location,description))return res.status(422).json({error:"Only USA jobs can be published"});const posted=parseDate(postedAt);const expires=new Date(posted.getTime()+30*24*60*60*1000);if(expires<=new Date())return res.status(422).json({error:"Job is older than 30 days"});const exp=classifyExperience(description);const cat=category(`${title} ${description}`);const skills=extractSkills(description);const [r]=await pool.query("INSERT INTO jobs(company_id,source_url,title,description,location,country,location_type,experience_level,category,apply_url,posted_at,expires_at) VALUES(?,?,?,?,?,'United States',?,?,?,?,?,?)",[companyId,applyUrl,title,description,location,locationType,exp,cat,applyUrl,posted,expires]);for(const skill of skills)await pool.query("INSERT IGNORE INTO job_skills(job_id,skill_name) VALUES(?,?)",[r.insertId,skill]);res.status(201).json({id:r.insertId,experienceLevel:exp,category:cat,skills})});

app.delete("/api/admin/sources/:id",auth,async(req,res)=>{await pool.query("DELETE FROM job_sources WHERE id=?",[req.params.id]);res.json({ok:true})});
app.post("/api/admin/cleanup",auth,async(req,res)=>{const [r]=await pool.query("UPDATE jobs SET is_active=0 WHERE expires_at<NOW() OR country<>'United States'");res.json({deactivated:r.affectedRows})});

app.listen(process.env.PORT||4000,()=>console.log(`Talent Inspirations API listening on ${process.env.PORT||4000}`));
