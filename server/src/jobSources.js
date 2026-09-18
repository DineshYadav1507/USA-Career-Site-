import * as cheerio from "cheerio";
import { URL } from "node:url";
const usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const nonUs=/\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\b/i;
export function isUSA(location="",description=""){
 const loc=String(location||"");
 const desc=String(description||"");
 if(nonUs.test(loc))return false;
 if(/remote\\s*[-–—:]?\\s*(worldwide|global|anywhere)/i.test(loc))return false;
 if(/\\b(united states|usa|u\\.?s\\.?)\\b/i.test(loc))return true;
 if(usStates.some(state=>loc.toLowerCase().includes(state.toLowerCase())))return true;
 if(/remote/i.test(loc))return /\\b(united states|usa|u\\.?s\\.?)\\b/i.test(desc)&&!nonUs.test(desc);
 return false;
}\nfunction absolute(base,href){try{return new URL(href,base).toString()}catch{return href}}
function parseExperience(t){if(/\b(intern|internship|new grad|entry[- ]level|fresher|graduate)\b|\b0\s*[-–to]?\s*1\s*years?\b/i.test(t))return"fresher";if(/\b(senior|lead|principal|manager|\d+\+?\s*years?)\b/i.test(t))return"experienced";return"other"}
function parseCategory(t){const s=t.toLowerCase();if(/devops|sre|kubernetes|terraform|cloud engineer/.test(s))return"DevOps";if(/data analyst|data scientist|analytics|business intelligence/.test(s))return"Data";if(/cyber|security engineer|infosec/.test(s))return"Cybersecurity";if(/qa|quality assurance|test engineer/.test(s))return"QA";if(/machine learning|ai engineer|ml engineer/.test(s))return"AI/ML";return"Software Engineering"}
const skillCatalog=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel"];
function skills(t){return skillCatalog.filter(s=>new RegExp(`\\b${s.replace(/[+.#]/g,"\\$&")}\\b`,"i").test(t))}
async function request(url){const r=await fetch(url,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)"}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
async function requestPost(url,body){const r=await fetch(url,{method:"POST",headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Content-Type":"application/json","Accept":"application/json"} ,body:JSON.stringify(body)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function workdayInfo(url){
 const u=new URL(url);
 const m=u.hostname.match(/^(.+?)\\.wd(\\d+)\\.myworkdayjobs\\.com$/i);
 if(!m)return null;
 const parts=u.pathname.split("/").filter(Boolean);
 const locale=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[0]:"en-US";
 const site=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[1]:parts[0];
 if(!site)return null;
 return {origin:u.origin,tenant:m[1],shard:m[2],locale,site};
}
function workdayPostedDate(value){
 if(!value)return null;
 const s=String(value).trim();
 const now=new Date();
 if(/today/i.test(s))return now.toISOString();
 if(/yesterday/i.test(s))return new Date(now.getTime()-86400000).toISOString();
 const m=s.match(/(\\d+)\\+?\\s+days?\\s+ago/i);
 if(m)return new Date(now.getTime()-Number(m[1])*86400000).toISOString();
 const direct=new Date(s);
 return Number.isNaN(direct.getTime())?null:direct.toISOString();
}
function workdayJobUrl(info,externalPath){
 return new URL(`/${info.locale}/${info.site}${externalPath.startsWith("/")?externalPath:"/"+externalPath}`,info.origin).toString();
}
async function fetchWorkdayDetail(info,externalPath){
 const path=externalPath.startsWith("/")?externalPath:"/"+externalPath;
 const url=`${info.origin}/wday/cxs/${encodeURIComponent(info.tenant)}/${encodeURIComponent(info.site)}/job${path}`;
 const r=await fetch(url,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Accept":"application/json","Accept-Language":"en-US,en;q=0.9","Referer":`${info.origin}/${info.locale}/${info.site}`}});
 if(!r.ok)return null;
 try{return await r.json()}catch{return null}
}
function workdayRecent(value){
 const s=String(value||"").trim();if(!s)return false;
 if(/today|yesterday/i.test(s))return true;
 const m=s.match(/(\\d+)\\+?\\s+days?\\s+ago/i);
 if(m)return Number(m[1])<30;
 return false;
}
async function fetchWorkdayJobs(sourceUrl){
 const info=workdayInfo(sourceUrl);if(!info)throw Error("Invalid Workday career URL. Expected tenant.wdN.myworkdayjobs.com/.../site");
 const endpoint=`${info.origin}/wday/cxs/${encodeURIComponent(info.tenant)}/${encodeURIComponent(info.site)}/jobs`;
 const out=[];const seen=new Set();
 // Search the public Workday feed for USA terms. Only recent listings are
 // expanded with the detail request; this avoids thousands of unnecessary
 // detail calls for old/closed postings.
 for(const searchText of ["United States","USA"]){
  let offset=0;let total=null;
  while(offset<2000){
   const data=await requestPost(endpoint,{appliedFacets:{},limit:20,offset,searchText});
   if(total===null)total=Number(data.total)||0;
   const postings=Array.isArray(data.jobPostings)?data.jobPostings:[];
   if(!postings.length)break;
   for(const p of postings){
    const externalPath=String(p.externalPath||p.url||"").trim();
    if(!externalPath||seen.has(externalPath)||!workdayRecent(p.postedOn||p.postedDate))continue;
    const listLocation=String(p.locationsText||"").trim();
    if(!isUSA(listLocation,p.title||""))continue;
    seen.add(externalPath);
    const detail=await fetchWorkdayDetail(info,externalPath);
    const infoData=detail?.jobPostingInfo||detail?.jobPosting||detail||{};
    const extra=Array.isArray(infoData.additionalLocations)?infoData.additionalLocations.map(x=>x?.descriptor||x?.name||x).join(", "):"";
    const locationParts=[p.locationsText,infoData.location?.descriptor,infoData.jobRequisitionLocation?.descriptor,infoData.country?.descriptor,extra].filter(Boolean);
    const location=[...new Set(locationParts.map(x=>String(x).trim()).filter(Boolean))].join(", ");
    const description=infoData.jobDescription||infoData.description||"";
    out.push({
      externalJobId:infoData.jobReqId||p.bulletFields?.find?.(x=>/^(JR|R)-?\\w+$/i.test(String(x)))||externalPath,
      title:p.title||infoData.title||"",
      description,
      location,
      applyUrl:workdayJobUrl(info,externalPath),
      postedAt:workdayPostedDate(p.postedOn||p.postedDate),
      employmentType:infoData.timeType||infoData.employmentType||"",
      locationType:/remote/i.test(`${location} ${description}`)?"remote":"unknown"
    });
   }
   offset+=postings.length;
   if(postings.length<20 || (total>0&&offset>=Math.min(total,2000)))break;
  }
 }
 return out;
}
export function normalizeJob(j){const text=`${j.title||""} ${j.description||""} ${j.location||""}`;return{...j,experienceLevel:parseExperience(text),category:parseCategory(text),skills:skills(text)}}
export function isUSAJob(j){return isUSA(j.location,j.description)}
