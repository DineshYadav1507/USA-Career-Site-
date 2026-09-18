import * as cheerio from "cheerio";
import { URL } from "node:url";
const usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const usStateAbbr=["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","DC"];
const nonUs=/\b(india|canada|united kingdom|uk|germany|australia|singapore|ireland|france|spain|netherlands|brazil)\b/i;
export function isUSA(location="",description=""){const s=`${location} ${description}`;if(nonUs.test(s))return false;if(/remote\\s*[-–—:]?\\s*(worldwide|global|anywhere)/i.test(s))return false;const stateName=usStates.some(x=>new RegExp(`\\\\b${x}\\\\b`,"i").test(location));const stateAbbr=usStateAbbr.some(x=>new RegExp(`(?:^|[,\\s])${x}(?:$|[,\\s])`,"i").test(location));return /\\b(united states|usa|u\\.?s\\.?)\\b/i.test(location)||stateName||stateAbbr||(/remote/i.test(location)&&/\\b(united states|usa|u\\.?s\\.?)\\b/i.test(s));}

function absolute(base,href){try{return new URL(href,base).toString()}catch{return href}}
function parseExperience(t){if(/\b(intern|internship|new grad|entry[- ]level|fresher|graduate)\b|\b0\s*[-–to]?\s*1\s*years?\b/i.test(t))return"fresher";if(/\b(senior|lead|principal|manager|\d+\+?\s*years?)\b/i.test(t))return"experienced";return"other"}
function parseCategory(t){const s=t.toLowerCase();if(/devops|sre|kubernetes|terraform|cloud engineer/.test(s))return"DevOps";if(/data analyst|data scientist|analytics|business intelligence/.test(s))return"Data";if(/cyber|security engineer|infosec/.test(s))return"Cybersecurity";if(/qa|quality assurance|test engineer/.test(s))return"QA";if(/machine learning|ai engineer|ml engineer/.test(s))return"AI/ML";return"Software Engineering"}
const skillCatalog=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel"];
function skills(t){return skillCatalog.filter(s=>new RegExp(`\\b${s.replace(/[+.#]/g,"\\$&")}\\b`,"i").test(t))}
async function fetchWithTimeout(url,options={},timeoutMs=20000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
async function request(url){let last;for(let i=0;i<2;i++){try{const r=await fetchWithTimeout(url,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Accept":"application/json"}},20000);if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json()}catch(e){last=e;if(i===0)await new Promise(r=>setTimeout(r,800))}}throw last}
async function requestPost(url,body){let last;for(let i=0;i<2;i++){try{const r=await fetchWithTimeout(url,{method:"POST",headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Content-Type":"application/json","Accept":"application/json","Accept-Language":"en-US,en;q=0.9"},body:JSON.stringify(body)},25000);if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json()}catch(e){last=e;if(i===0)await new Promise(r=>setTimeout(r,800))}}throw last}
function workdayInfo(url){
 const u=new URL(url);
 const m=u.hostname.match(/^(.+?)\.wd(\d+)\.myworkdayjobs\.com$/i);
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
 const m=s.match(/(\d+)\+?\s+days?\s+ago/i);
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
 const m=s.match(/(\d+)\+?\s+days?\s+ago/i);
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
    if(!isUSA(listLocation,`${p.title||""} ${p.bulletFields?.join?.(" ")||""}`))continue;
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
function greenhouseToken(url){const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);return u.hostname.includes("greenhouse.io")?p[0]||null:null}
function leverSite(url){const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);return u.hostname==="jobs.lever.co"?p[0]||null:null}
function jsonLdJobs(html){const $=cheerio.load(html),out=[];$('script[type="application/ld+json"]').each((_,el)=>{try{const data=JSON.parse($(el).text()),list=Array.isArray(data)?data:[data];for(const x of list){for(const j of x["@graph"]||[x]){if(j["@type"]==="JobPosting"&&j.url&&j.title&&j.datePosted)out.push({externalJobId:j.identifier?.value||j.identifier||j.url,title:j.title,description:j.description||"",location:[j.jobLocation?.address?.addressLocality,j.jobLocation?.address?.addressRegion,j.jobLocation?.address?.addressCountry].filter(Boolean).join(", ")||j.jobLocationType||"",applyUrl:j.url,postedAt:j.datePosted,employmentType:j.employmentType,locationType:/TELECOMMUTE|remote/i.test(JSON.stringify(j.jobLocationType||""))?"remote":"unknown"})}}}catch{}});return out}
export async function fetchJobs(sourceUrl,atsType){
 if(atsType==="workday"){return fetchWorkdayJobs(sourceUrl)}
 const gh=greenhouseToken(sourceUrl);if(gh){const data=await request(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh)}/jobs?content=true`);return(data.jobs||[]).map(j=>({externalJobId:String(j.id),title:j.title,description:j.content||"",location:j.location?.name||"",applyUrl:j.absolute_url,postedAt:j.updated_at,locationType:/remote/i.test(j.location?.name||"")?"remote":"unknown"}))}
 const lever=leverSite(sourceUrl);if(lever){const data=await request(`https://api.lever.co/v0/postings/${encodeURIComponent(lever)}?mode=json`);return(data||[]).map(j=>({externalJobId:String(j.id),title:j.text,description:j.descriptionPlain||j.description||"",location:j.categories?.location||j.categories?.allLocations?.join(", ")||"",applyUrl:j.hostedUrl||j.applyUrl,postedAt:j.createdAt||j.updatedAt,employmentType:j.categories?.commitment,locationType:/remote/i.test(j.categories?.location||"")?"remote":"unknown"}))}
 const html=await(await fetchWithTimeout(sourceUrl,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Accept":"text/html,application/xhtml+xml"}},20000)).text();let jsonLd=jsonLdJobs(html);if(jsonLd.length)return jsonLd;
 const $=cheerio.load(html),links=[],atsLinks=[];$("a[href]").each((_,a)=>{const title=$(a).text().replace(/\s+/g," ").trim(),href=absolute(sourceUrl,$(a).attr("href"));if(!href)return;const host=new URL(href).hostname.toLowerCase();if(/boards\.greenhouse\.io$/.test(host)||/jobs\.lever\.co$/.test(host)||/myworkdayjobs\.com$/.test(host))atsLinks.push({title,href});if(/(careers?|jobs?|openings?|opportunities?)/i.test(title+" "+href))links.push({title,href})});
 const candidates=[...new Map(links.map(x=>[x.href,x])).values()].slice(0,12);const atsCandidates=[...new Map(atsLinks.map(x=>[x.href,x])).values()].slice(0,50);const out=[];
 for(const link of atsCandidates){try{const u=new URL(link.href);let type=null;if(u.hostname.endsWith("greenhouse.io"))type="greenhouse";else if(u.hostname==="jobs.lever.co")type="lever";else if(u.hostname.endsWith("myworkdayjobs.com"))type="workday";if(type){const found=await fetchJobs(link.href,type);if(found.length)out.push(...found)}}catch{}}
 for(const link of candidates){try{const page=await(await fetchWithTimeout(link.href,{headers:{"User-Agent":"TalentInspirations/1.0 (+public-career-indexer)","Accept":"text/html,application/xhtml+xml"}},15000)).text();const found=jsonLdJobs(page);if(found.length)out.push(...found)}catch{}}
 if(out.length)return out;
 $("a[href]").each((_,a)=>{const title=$(a).text().replace(/\s+/g," ").trim(),href=absolute(sourceUrl,$(a).attr("href"));if(title.length>5&&/(engineer|developer|analyst|scientist|manager|designer|intern|devops|software|data|security)/i.test(title))out.push({externalJobId:href,title,description:"",location:"",applyUrl:href,postedAt:null,locationType:"unknown"})});return out.slice(0,200)
}
export function normalizeJob(j){const text=`${j.title||""} ${j.description||""} ${j.location||""}`;return{...j,experienceLevel:parseExperience(text),category:parseCategory(text),skills:skills(text)}}
export function isUSAJob(j){return isUSA(j.location,j.description)}
