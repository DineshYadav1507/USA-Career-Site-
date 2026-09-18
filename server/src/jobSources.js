import * as cheerio from "cheerio";
import { URL } from "node:url";
const usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const nonUs=/\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\b/i;
export function isUSA(location="",description=""){const s=`${location} ${description}`;if(nonUs.test(s))return false;if(/remote\s*[-–—:]?\s*(worldwide|global|anywhere)/i.test(s))return false;return /\b(united states|usa|u\.?s\.?)\b/i.test(location)||usStates.some(x=>new RegExp(`\\b${x}\\b`,"i").test(location))||( /remote/i.test(location)&&/\b(united states|usa|u\.?s\.?)\b/i.test(s));}
function absolute(base,href){try{return new URL(href,base).toString()}catch{return href}}
function parseExperience(t){if(/\b(intern|internship|new grad|entry[- ]level|fresher|graduate)\b|\b0\s*[-–to]?\s*1\s*years?\b/i.test(t))return"fresher";if(/\b(senior|lead|principal|manager|\d+\+?\s*years?)\b/i.test(t))return"experienced";return"other"}
function parseCategory(t){const s=t.toLowerCase();if(/devops|sre|kubernetes|terraform|cloud engineer/.test(s))return"DevOps";if(/data analyst|data scientist|analytics|business intelligence/.test(s))return"Data";if(/cyber|security engineer|infosec/.test(s))return"Cybersecurity";if(/qa|quality assurance|test engineer/.test(s))return"QA";if(/machine learning|ai engineer|ml engineer/.test(s))return"AI/ML";return"Software Engineering"}
const skillCatalog=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel"];
function skills(t){return skillCatalog.filter(s=>new RegExp(`\\b${s.replace(/[+.#]/g,"\\$&")}\\b`,"i").test(t))}
async function request(url){const r=await fetch(url,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)"}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
async function requestPost(url,body){const r=await fetch(url,{method:"POST",headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Content-Type":"application/json","Accept":"application/json"} ,body:JSON.stringify(body)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function workdayInfo(url){
 const u=new URL(url);
 const m=u.hostname.match(/^(.+?)\\.wd\\d+\\.myworkdayjobs\\.com$/i);
 if(!m)return null;
 const parts=u.pathname.split("/").filter(Boolean);
 const locale=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[0]:"en-US";
 const site=parts[1]||parts[0];
 if(!site)return null;
 return {origin:u.origin,tenant:m[1],locale,site};
}
function workdayPostedDate(value){
 if(!value)return null;
 if(value instanceof Date)return value.toISOString();
 const s=String(value).trim();
 const direct=new Date(s);
 if(!Number.isNaN(direct.getTime()) && /\\d{4}/.test(s))return direct.toISOString();
 const m=s.match(/(?:posted\\s*)?(today|yesterday|\\d+\\+?\\s+days?\\s+ago)/i);
 if(!m)return null;
 const days=/today/i.test(m[1])?0:/yesterday/i.test(m[1])?1:Number.parseInt(m[1],10);
 if(!Number.isFinite(days))return null;
 return new Date(Date.now()-days*86400000).toISOString();
}
async function fetchWorkdayJobs(sourceUrl){
 const info=workdayInfo(sourceUrl);if(!info)return [];
 const endpoint=`${info.origin}/wday/cxs/${encodeURIComponent(info.tenant)}/${encodeURIComponent(info.site)}/jobs`;
 const out=[];
 for(let offset=0;offset<200;offset+=20){
  const data=await requestPost(endpoint,{appliedFacets:{},limit:20,offset,searchText:""});
  const postings=Array.isArray(data.jobPostings)?data.jobPostings:[];
  for(const j of postings){
   const path=j.externalPath||j.url||"";
   const applyUrl=path?new URL(path,sourceUrl).toString():sourceUrl;
   const locations=Array.isArray(j.locationsText)?j.locationsText.join(", "):(j.locationsText||j.location||"");
   const description=[j.jobDescription,j.description,Array.isArray(j.bulletFields)?j.bulletFields.join(" • "):j.bulletFields].filter(Boolean).join("\n");
   out.push({externalJobId:j.bulletFields?.find?.(x=>/^JR[-\\w]+$/i.test(String(x)))||j.externalPath||j.jobReqId||applyUrl,title:j.title||"",description,location:locations,applyUrl,postedAt:workdayPostedDate(j.postedOn||j.postedDate||j.createdOn),employmentType:j.employmentType,locationType:/remote/i.test(`${locations} ${description}`)?"remote":"unknown"});
  }
  if(postings.length<20)break;
 }
 return out;
}
function greenhouseToken(url){const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);return u.hostname.includes("greenhouse.io")?p[0]||null:null}
function leverSite(url){const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);return u.hostname==="jobs.lever.co"?p[0]||null:null}
function jsonLdJobs(html){const $=cheerio.load(html),out=[];$('script[type="application/ld+json"]').each((_,el)=>{try{const data=JSON.parse($(el).text()),list=Array.isArray(data)?data:[data];for(const x of list){for(const j of x["@graph"]||[x]){if(j["@type"]==="JobPosting"&&j.url&&j.title&&j.datePosted)out.push({externalJobId:j.identifier?.value||j.identifier||j.url,title:j.title,description:j.description||"",location:[j.jobLocation?.address?.addressLocality,j.jobLocation?.address?.addressRegion,j.jobLocation?.address?.addressCountry].filter(Boolean).join(", ")||j.jobLocationType||"",applyUrl:j.url,postedAt:j.datePosted,employmentType:j.employmentType,locationType:/TELECOMMUTE|remote/i.test(JSON.stringify(j.jobLocationType||""))?"remote":"unknown"})}}}catch{}});return out}
export async function fetchJobs(sourceUrl,atsType){
 if(atsType==="workday"){return fetchWorkdayJobs(sourceUrl)}
 const gh=greenhouseToken(sourceUrl);if(gh){const data=await request(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh)}/jobs?content=true`);return(data.jobs||[]).map(j=>({externalJobId:String(j.id),title:j.title,description:j.content||"",location:j.location?.name||"",applyUrl:j.absolute_url,postedAt:j.updated_at,locationType:/remote/i.test(j.location?.name||"")?"remote":"unknown"}))}
 const lever=leverSite(sourceUrl);if(lever){const data=await request(`https://api.lever.co/v0/postings/${encodeURIComponent(lever)}?mode=json`);return(data||[]).map(j=>({externalJobId:String(j.id),title:j.text,description:j.descriptionPlain||j.description||"",location:j.categories?.location||j.categories?.allLocations?.join(", ")||"",applyUrl:j.hostedUrl||j.applyUrl,postedAt:j.createdAt||j.updatedAt,employmentType:j.categories?.commitment,locationType:/remote/i.test(j.categories?.location||"")?"remote":"unknown"}))}
 const html=await(await fetch(sourceUrl,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)"}})).text();const jsonLd=jsonLdJobs(html);if(jsonLd.length)return jsonLd;
 const $=cheerio.load(html),out=[];$("a[href]").each((_,a)=>{const title=$(a).text(" ").replace(/\s+/g," ").trim(),href=absolute(sourceUrl,$(a).attr("href"));if(title.length>5&&/(engineer|developer|analyst|scientist|manager|designer|intern|devops|software|data|security)/i.test(title))out.push({externalJobId:href,title,description:"",location:"",applyUrl:href,postedAt:null,locationType:"unknown"})});return out.slice(0,200)
}
export function normalizeJob(j){const text=`${j.title||""} ${j.description||""} ${j.location||""}`;return{...j,experienceLevel:parseExperience(text),category:parseCategory(text),skills:skills(text)}}
export function isUSAJob(j){return isUSA(j.location,j.description)}
