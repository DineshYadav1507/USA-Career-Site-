import * as cheerio from "cheerio";
import { URL } from "node:url";

const usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const usRe=new RegExp(`\\b(united states|usa|u\\.?s\\.?|remote)\\b|\\b(${usStates.join("|")})\\b`,"i");
const nonUs=/\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\b/i;
export function isUSA(location="",description=""){const s=`${location} ${description}`;if(nonUs.test(s))return false;if(/remote.{0,20}(worldwide|global|anywhere)/i.test(s))return false;return usRe.test(location)||/remote.{0,30}(united states|usa|u\.?s\.?)?/i.test(s)&&/remote/i.test(location);}
function absolute(base,href){try{return new URL(href,base).toString()}catch{return href}}
function parseExperience(t){if(/\b(intern|internship|new grad|entry[- ]level|fresher|graduate)\b|\b0\s*[-–to]?\s*1\s*years?\b/i.test(t))return"fresher";if(/\b(senior|lead|principal|manager|\d+\+?\s*years?)\b/i.test(t))return"experienced";return"other"}
function parseCategory(t){const s=t.toLowerCase();if(/devops|sre|kubernetes|terraform|cloud engineer/.test(s))return"DevOps";if(/data analyst|data scientist|analytics|business intelligence/.test(s))return"Data";if(/cyber|security engineer|infosec/.test(s))return"Cybersecurity";if(/qa|quality assurance|test engineer/.test(s))return"QA";if(/machine learning|ai engineer|ml engineer/.test(s))return"AI/ML";return"Software Engineering"}
const skillCatalog=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel"];
function skills(t){return skillCatalog.filter(s=>new RegExp(`\\b${s.replace(/[+.#]/g,"\\$&")}\\b`,"i").test(t))}
async function json(url){const r=await fetch(url,{headers:{"User-Agent":"TalentInspirations/1.0"}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function greenhouseToken(url){const h=new URL(url).hostname;const p=new URL(url).pathname.split("/").filter(Boolean);return h.includes("greenhouse.io")?p[0]||null:null}
function leverSite(url){const h=new URL(url).hostname;const p=new URL(url).pathname.split("/").filter(Boolean);return h==="jobs.lever.co"?p[0]||null:null}

export async function fetchJobs(sourceUrl){
 const gh=greenhouseToken(sourceUrl);
 if(gh){const data=await json(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh)}/jobs?content=true`);return (data.jobs||[]).map(j=>({externalJobId:String(j.id),title:j.title,description:j.content||"",location:j.location?.name||"",applyUrl:j.absolute_url,postedAt:j.updated_at,locationType:"unknown"}))}
 const lever=leverSite(sourceUrl);
 if(lever){const data=await json(`https://api.lever.co/v0/postings/${encodeURIComponent(lever)}?mode=json`);return (data||[]).map(j=>({externalJobId:String(j.id),title:j.text,description:j.descriptionPlain||j.description||"",location:j.categories?.location||j.categories?.allLocations?.join(", ")||"",applyUrl:j.hostedUrl||j.applyUrl,postedAt:j.createdAt||j.updatedAt,locationType:/remote/i.test(j.categories?.location||"")?"remote":"unknown"}))}
 const html=await (await fetch(sourceUrl,{headers:{"User-Agent":"TalentInspirations/1.0"}})).text();
 const $=cheerio.load(html),out=[]; $("a[href]").each((_,a)=>{const title=$(a).text(" ").replace(/\s+/g," ").trim();const href=absolute(sourceUrl,$(a).attr("href"));if(title.length>5&&/(engineer|developer|analyst|scientist|manager|designer|intern|devops|software|data|security)/i.test(title))out.push({externalJobId:href,title,description:"",location:"",applyUrl:href,postedAt:new Date().toISOString(),locationType:"unknown"})});return out.slice(0,200);
}
export function normalizeJob(j){const text=`${j.title} ${j.description} ${j.location}`;return {...j,experienceLevel:parseExperience(text),category:parseCategory(text),skills:skills(text)}}
export function isUSAJob(j){return isUSA(j.location,j.description)}
