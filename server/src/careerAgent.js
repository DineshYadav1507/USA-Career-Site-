import * as cheerio from "cheerio";
import { URL } from "node:url";

const STATES=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const STATE_CODES=["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","DC"];
const COUNTRY_TERMS={USA:["united states","usa","u.s.","u.s.a."],UK:["united kingdom","uk","england","scotland","wales"],Canada:["canada"],Australia:["australia"],Germany:["germany"],Netherlands:["netherlands","holland"],Ireland:["ireland"],France:["france"],Japan:["japan"],Singapore:["singapore"],UAE:["united arab emirates","uae","dubai","abu dhabi"],"Saudi Arabia":["saudi arabia"],"New Zealand":["new zealand"],Switzerland:["switzerland"],Sweden:["sweden"],Norway:["norway"],Denmark:["denmark"],Finland:["finland"],Belgium:["belgium"],Austria:["austria"]};
const SKILLS=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel","Snowflake","Databricks","Spark","Airflow","TensorFlow","PyTorch","R","Scala","Ruby","Rust","Swift","Oracle","SAP","Salesforce","ServiceNow"];

function timeoutFetch(url,timeout=20000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 return fetch(url,{signal:controller.signal,headers:{
   "User-Agent":"TalentInspirations-Career-Agent/2.0",
   "Accept":"text/html,application/xhtml+xml,application/json",
   "Accept-Language":"en-US,en;q=0.9"
 }}).finally(()=>clearTimeout(timer));
}
async function jsonFetch(url){
 const r=await timeoutFetch(url,25000);
 if(!r.ok)throw new Error("HTTP "+r.status);
 return r.json();
}
function absolute(base,href){try{return new URL(href,base).toString()}catch{return href}}
function isSupportedLocation(location="",description="",country="USA"){
 const loc=String(location||"");
 const text=String(loc+" "+description);
 if(/remote\s*[-–—:]?\s*(worldwide|global|anywhere)/i.test(text))return false;
 if(country==="USA"){
  if(/\b(united states|usa|u\.s\.)\b/i.test(loc))return true;
  if(STATES.some(s=>new RegExp("\\b"+s+"\\b","i").test(loc)))return true;
  if(STATE_CODES.some(s=>new RegExp("(?:^|[,\\s])"+s+"(?:$|[,\\s])","i").test(loc)))return true;
  return /remote/i.test(loc)&&/\b(united states|usa|u\.s\.)\b/i.test(text);
 }
 const terms=COUNTRY_TERMS[country]||[];
 return terms.some(term=>new RegExp("\\b"+term.replace(/[.*+?^{}()|[\\]\\\\]/g,"\\\\$&")+"\\b","i").test(loc))
   || terms.some(term=>new RegExp("\\b"+term.replace(/[.*+?^{}()|[\\]\\\\]/g,"\\\\$&")+"\\b","i").test(text));
}
function isUSA(location="",description=""){
 return isSupportedLocation(location,description,"USA");
}
function cleanHtml(value=""){return String(value).replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/\\s+/g," ").trim()}
function parseDate(value){
 if(!value)return null;
 const s=String(value).trim();
 const now=new Date();
 if(/today/i.test(s))return now;
 if(/yesterday/i.test(s))return new Date(now.getTime()-86400000);
 const rel=s.match(/(\\d+)\\+?\\s+days?\\s+ago/i);
 if(rel)return new Date(now.getTime()-Number(rel[1])*86400000);
 const d=new Date(s);
 return Number.isNaN(d.getTime())?null:d;
}
function experience(text){
 if(/\\b(intern|internship|new grad|entry[- ]level|fresher|graduate|junior)\\b|\\b0\\s*(?:-|to)\\s*1\\s*years?/i.test(text))return "fresher";
 if(/\\b(senior|sr\\.?|lead|principal|staff|manager|director|\\d+\\+?\\s*years?)\\b/i.test(text))return "experienced";
 return "other";
}
function category(text){
 const s=text.toLowerCase();
 if(/devops|site reliability|sre|kubernetes|terraform|platform engineer|cloud engineer/.test(s))return "DevOps";
 if(/data analyst|business analyst|data analytics|business intelligence|reporting analyst/.test(s))return "Data";
 if(/cyber|security engineer|information security|infosec/.test(s))return "Cybersecurity";
 if(/quality assurance|qa engineer|test engineer|sdet/.test(s))return "QA";
 if(/machine learning|artificial intelligence|ai engineer|ml engineer|data scientist/.test(s))return "AI/ML";
 return "Software Engineering";
}
function skills(text){return SKILLS.filter(skill=>new RegExp("(^|[^A-Za-z0-9+#.])"+skill.replace(/[.*+?^{}()|[\]\\]/g,"\\$&")+"([^A-Za-z0-9+#.]|$)","i").test(text))}
function jsonLdJobs(html){
 const $=cheerio.load(html);const out=[];
 $('script[type="application/ld+json"]').each((_,el)=>{
  try{
   const parsed=JSON.parse($(el).text());const roots=Array.isArray(parsed)?parsed:[parsed];
   for(const root of roots){
    const nodes=root?.["@graph"]||[root];
    for(const j of nodes){
     if(j?.["@type"]!=="JobPosting"||!j.title||!j.url)continue;
     const addr=j.jobLocation?.address||{};
     const location=[addr.addressLocality,addr.addressRegion,addr.addressCountry].filter(Boolean).join(", ")||j.jobLocationType||j.applicantLocationRequirements?.[0]?.name||"";
     out.push({externalJobId:String(j.identifier?.value||j.identifier||j.url),title:String(j.title),description:cleanHtml(j.description||""),location,applyUrl:String(j.url),postedAt:parseDate(j.datePosted),employmentType:j.employmentType||"",locationType:/telecommute|remote/i.test(String(j.jobLocationType||""))?"remote":"unknown"});
    }
   }
  }catch{}
 });
 return out;
}
function greenhouseToken(url){
 const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);
 if(!u.hostname.includes("greenhouse.io"))return null;
 if(p[0]&&p[0]!=="embed"&&p[0]!=="embed/job_app")return p[0];
 return u.searchParams.get("for")||u.searchParams.get("board");
}
function leverSite(url){
 const u=new URL(url);if(u.hostname!=="jobs.lever.co")return null;
 return u.pathname.split("/").filter(Boolean)[0]||null;
}
async function greenhouse(url){
 const board=greenhouseToken(url);if(!board)return [];
 const data=await jsonFetch("https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(board)+"/jobs?content=true");
 return (data.jobs||[]).map(j=>({externalJobId:String(j.id),title:j.title,description:cleanHtml(j.content||""),location:j.location?.name||"",applyUrl:j.absolute_url,postedAt:parseDate(j.created_at||j.updated_at),employmentType:j.metadata?.find?.(x=>/employment/i.test(x?.name||""))?.value||"",locationType:/remote/i.test(j.location?.name||"")?"remote":"unknown"}));
}
async function lever(url){
 const site=leverSite(url);if(!site)return [];
 const data=await jsonFetch("https://api.lever.co/v0/postings/"+encodeURIComponent(site)+"?mode=json");
 return (data||[]).map(j=>({externalJobId:String(j.id),title:j.text,description:cleanHtml(j.descriptionPlain||j.description||""),location:j.categories?.location||j.categories?.allLocations?.join(", ")||"",applyUrl:j.hostedUrl||j.applyUrl,postedAt:parseDate(j.createdAt||j.updatedAt),employmentType:j.categories?.commitment||"",locationType:/remote/i.test(j.categories?.location||"")?"remote":"unknown"}));
}
function atsLinks(html,base){
 const matches=new Set();
 const patterns=[
  new RegExp("https?:\\\\/\\\\/boards\\\\.greenhouse\\\\.io\\\\/[^\\\"'<>\\\\s]+","gi"),
  new RegExp("https?:\\\\/\\\\/jobs\\\\.lever\\\\.co\\\\/[^\\\"'<>\\\\s]+","gi"),
  new RegExp("https?:\\\\/\\\\/[^\\\"'<>\\\\s]+\\\\.myworkdayjobs\\\\.com\\\\/[^\\\"'<>\\\\s]+","gi")
 ];
 for(const p of patterns)(html.match(p)||[]).forEach(x=>matches.add(x.replace(/&amp;/g,"&")));
 const $=cheerio.load(html);
 $("a[href]").each((_,a)=>{const h=absolute(base,$(a).attr("href")||"");if(/greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com/i.test(h))matches.add(h)});
 return [...matches].slice(0,25);
}
async function workday(url){
 const u=new URL(url);const match=u.hostname.match(/^(.+?)\.wd(\\d+)\.myworkdayjobs\.com$/i);if(!match)return [];
 const parts=u.pathname.split("/").filter(Boolean);const locale=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[0]:"en-US";const site=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[1]:parts[0];if(!site)return [];
 const endpoint=u.origin+"/wday/cxs/"+encodeURIComponent(match[1])+"/"+encodeURIComponent(site)+"/jobs";
 const out=[];const seen=new Set();
 for(const searchText of ["United States","USA"]){
  for(let offset=0;offset<1000;offset+=20){
   const r=await fetch(endpoint,{method:"POST",headers:{"User-Agent":"TalentInspirations-Career-Agent/2.0","Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText})});
   if(!r.ok)break;
   const data=await r.json();const posts=Array.isArray(data.jobPostings)?data.jobPostings:[];if(!posts.length)break;
   for(const p of posts){
    const path=String(p.externalPath||"");if(!path||seen.has(path))continue;
    const loc=String(p.locationsText||"");if(!isUSA(loc,p.title||""))continue;
    seen.add(path);const posted=parseDate(p.postedOn||p.postedDate);if(!posted&&/days?\s+ago/i.test(String(p.postedOn||"")))continue;
    out.push({externalJobId:path,title:p.title||"",description:cleanHtml(p.jobPostingInfo?.jobDescription||p.jobDescription||p.description||((p.bulletFields||[]).join(" "))),location:loc,applyUrl:new URL("/"+locale+"/"+site+(path.startsWith("/")?path:"/"+path),u.origin).toString(),postedAt:posted,locationType:/remote/i.test(loc)?"remote":"unknown"});
   }
   if(posts.length<20)break;
  }
 }
 return out;
}
async function fetchOne(url){
 const u=new URL(url);
 if(/greenhouse\.io/.test(u.hostname)){const x=await greenhouse(url);if(x.length)return {jobs:x,ats:"greenhouse"}}
 if(u.hostname==="jobs.lever.co"){const x=await lever(url);if(x.length)return {jobs:x,ats:"lever"}}
 if(/myworkdayjobs\.com$/.test(u.hostname)){const x=await workday(url);if(x.length)return {jobs:x,ats:"workday"}}
 const response=await timeoutFetch(url);if(!response.ok)throw new Error("Career page HTTP "+response.status);
 const html=await response.text();
 const structured=jsonLdJobs(html);if(structured.length)return {jobs:structured,ats:"generic-jsonld"};
 for(const atsUrl of atsLinks(html,url)){
  try{
   const x=await fetchOne(atsUrl);
   if(x.jobs.length)return x;
  }catch{}
 }
 const $=cheerio.load(html);const out=[];const seen=new Set();
 $("a[href]").each((_,a)=>{
  const title=$(a).text().replace(/\s+/g," ").trim();const href=absolute(url,$(a).attr("href")||"");
  if(title.length<6||!/(engineer|developer|analyst|scientist|designer|devops|software|data|security|intern|manager|architect)/i.test(title))return;
  if(seen.has(href))return;seen.add(href);
  const context=$(a).parent().text().replace(/\s+/g," ").trim();
  const location=(context.match(/([A-Za-z .'-]+,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b)/i)||[])[1]||"";
  if(isUSA(location,context)||/united states|usa/i.test(context))out.push({externalJobId:href,title,description:context,location,applyUrl:href,postedAt:null,locationType:/remote/i.test(context)?"remote":"unknown"});
 });
 return {jobs:out.slice(0,250),ats:"generic"};
}
export async function scanCareerPage(url,country="USA"){
 const result=await fetchOne(url);
 const now=new Date();
 const output=result.jobs.map(j=>{
  const published=j.postedAt instanceof Date?j.postedAt:parseDate(j.postedAt);
  const date=published||now;
  const text=[j.title,j.description,j.location].join(" ");
  return {
   externalJobId:String(j.externalJobId||j.applyUrl),
   title:String(j.title||"").trim(),
   description:String(j.description||"").trim(),
   location:String(j.location||"").trim(),
   applyUrl:String(j.applyUrl||"").trim(),
   postedAt:date,
   dateSource:published?"published":"detected",
   employmentType:j.employmentType||"",
   locationType:j.locationType||"unknown",
   experienceLevel:experience(text),
   category:category(text),
   skills:skills(text)
  };
 }).filter(j=>j.title&&j.applyUrl&&isSupportedLocation(j.location,j.description,country));
 output.ats=result.ats||"generic";
 return output;
}
export {isSupportedLocation};
