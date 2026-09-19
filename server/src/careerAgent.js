import * as cheerio from "cheerio";
import {URL} from "node:url";

const STATES=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const STATE_CODES=["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","DC"];
const COUNTRY_TERMS={USA:["united states","usa","u.s.","u.s.a."],UK:["united kingdom","uk","england","scotland","wales"],Canada:["canada"],Australia:["australia"],Germany:["germany","deutschland"],Netherlands:["netherlands","holland"],Ireland:["ireland"],France:["france"],Japan:["japan"],Singapore:["singapore"],UAE:["united arab emirates","uae","dubai","abu dhabi"],"Saudi Arabia":["saudi arabia"],"New Zealand":["new zealand"],Switzerland:["switzerland"],Sweden:["sweden"],Norway:["norway"],Denmark:["denmark"],Finland:["finland"],Belgium:["belgium"],Austria:["austria"]};
const COUNTRY_NAMES={USA:"United States",UK:"United Kingdom",Canada:"Canada",Australia:"Australia",Germany:"Germany",Netherlands:"Netherlands",Ireland:"Ireland",France:"France",Japan:"Japan",Singapore:"Singapore",UAE:"United Arab Emirates","Saudi Arabia":"Saudi Arabia","New Zealand":"New Zealand",Switzerland:"Switzerland",Sweden:"Sweden",Norway:"Norway",Denmark:"Denmark",Finland:"Finland",Belgium:"Belgium",Austria:"Austria"};
const SKILLS=["Java","Spring Boot","JavaScript","TypeScript","React","Angular","Python","SQL","MySQL","PostgreSQL","MongoDB","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","GitHub Actions","Linux","Node.js","C#","C++","Go","Kafka","Power BI","Tableau","Excel","Selenium","Git","REST","GraphQL","PHP","Laravel","Snowflake","Databricks","Spark","Airflow","TensorFlow","PyTorch","R","Scala","Ruby","Rust","Swift","Oracle","SAP","Salesforce","ServiceNow"];
const JOB_WORDS=/engineer|developer|analyst|scientist|designer|devops|software|data|security|intern|manager|architect|administrator|consultant|technician|product|qa|quality|cloud|platform/i;

function timeoutFetch(url,timeout=20000,options={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 return fetch(url,{...options,signal:controller.signal,headers:{"User-Agent":"TalentInspirations-Career-Agent/3.0","Accept":"text/html,application/xhtml+xml,application/xml,application/json","Accept-Language":"en-US,en;q=0.9",...(options.headers||{})}}).finally(()=>clearTimeout(timer));
}
async function jsonFetch(url,options={}){const r=await timeoutFetch(url,25000,options);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function absolute(base,href){try{return new URL(href,base).toString()}catch{return ""}}
function cleanHtml(value=""){return String(value).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()}
function parseDate(value){
 if(!value)return null;
 const s=String(value).trim();const now=new Date();
 if(/today/i.test(s))return now;
 if(/yesterday/i.test(s))return new Date(now.getTime()-86400000);
 const rel=s.match(/(\d+)\+?\s+days?\s+ago/i);if(rel)return new Date(now.getTime()-Number(rel[1])*86400000);
 const d=new Date(s);return Number.isNaN(d.getTime())?null:d;
}
function experience(text){
 if(/\b(intern|internship|new grad|entry[- ]level|fresher|graduate|junior)\b|\b0\s*(?:-|to)\s*1\s*years?/i.test(text))return "fresher";
 if(/\b(senior|sr\.?|lead|principal|staff|manager|director|\d+\+?\s*years?)\b/i.test(text))return "experienced";
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
function skills(text){
 return SKILLS.filter(skill=>new RegExp("(^|[^A-Za-z0-9+#.])"+skill.replace(/[.*+?^$()|[\]\\]/g,"\\$&")+"([^A-Za-z0-9+#.]|$)","i").test(text));
}
function countryPattern(term){return new RegExp("\\b"+term.replace(/[.*+?^$()|[\]\\]/g,"\\$&")+"\\b","i")}
function countryHints(text=""){
 const hits=[];
 for(const [country,terms] of Object.entries(COUNTRY_TERMS))if(terms.some(t=>countryPattern(t).test(text)))hits.push(country);
 if(STATES.some(x=>countryPattern(x).test(text))||STATE_CODES.some(x=>new RegExp("(?:^|[,\\s])"+x+"(?:$|[,\\s])","i").test(text)))hits.push("USA");
 return [...new Set(hits)];
}
function isSupportedLocation(location="",description="",country="USA"){
 const loc=String(location||"").trim();
 const text=loc+" "+String(description||"");
 if(/\b(worldwide|global|anywhere)\b/i.test(text))return false;
 const hints=countryHints(loc);
 if(hints.length)return hints.includes(country);
 if(/remote/i.test(loc))return true;
 return true;
}
function jsonLdJobs(html,base=""){
 const $=cheerio.load(html);const out=[];
 $('script[type="application/ld+json"]').each((_,el)=>{
  try{
   const parsed=JSON.parse($(el).text());const roots=Array.isArray(parsed)?parsed:[parsed];
   for(const root of roots){
    const nodes=root?.["@graph"]||[root];
    for(const j of nodes){
     const type=j?.["@type"];
     if(!(type==="JobPosting"||(Array.isArray(type)&&type.includes("JobPosting")))||!j.title)continue;
     const addresses=Array.isArray(j.jobLocation)?j.jobLocation:[j.jobLocation];
     const locations=addresses.map(x=>{const a=x?.address||{};return [a.addressLocality,a.addressRegion,a.addressCountry].filter(Boolean).join(", ")}).filter(Boolean);
     const addr=j.jobLocation?.address||{};
     const location=locations.join(" | ")||[addr.addressLocality,addr.addressRegion,addr.addressCountry].filter(Boolean).join(", ")||j.jobLocationType||j.applicantLocationRequirements?.map?.(x=>x.name).join(", ")||"";
     const applyUrl=absolute(base,String(j.url||j.sameAs||""));if(!applyUrl)continue;
     out.push({externalJobId:String(j.identifier?.value||j.identifier||applyUrl),title:String(j.title),description:cleanHtml(j.description||""),location,applyUrl,postedAt:parseDate(j.datePosted||j.dateCreated||j.dateModified),employmentType:Array.isArray(j.employmentType)?j.employmentType.join(", "):j.employmentType||"",locationType:/telecommute|remote/i.test(String(j.jobLocationType||""))?"remote":"unknown"});
    }
   }
  }catch{}
 });
 return out;
}
function greenhouseToken(url){
 const u=new URL(url);const p=u.pathname.split("/").filter(Boolean);
 if(!u.hostname.includes("greenhouse.io"))return null;
 return (p[0]&&p[0]!=="embed"&&p[0]!=="embed/job_app")?p[0]:(u.searchParams.get("for")||u.searchParams.get("board"));
}
function leverSite(url){const u=new URL(url);return u.hostname==="jobs.lever.co"?u.pathname.split("/").filter(Boolean)[0]||null:null}
async function greenhouse(url){
 const board=greenhouseToken(url);if(!board)return [];
 const data=await jsonFetch("https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(board)+"/jobs?content=true");
 return (data.jobs||[]).map(j=>({externalJobId:String(j.id),title:j.title,description:cleanHtml(j.content||""),location:j.location?.name||"",applyUrl:j.absolute_url,postedAt:parseDate(j.created_at||j.updated_at),employmentType:j.metadata?.find?.(x=>/employment/i.test(x?.name||""))?.value||"",locationType:/remote/i.test(j.location?.name||"")?"remote":"unknown"}));
}
async function lever(url){
 const site=leverSite(url);if(!site)return [];
 const data=await jsonFetch("https://api.lever.co/v0/postings/"+encodeURIComponent(site)+"?mode=json");
 return (data||[]).map(j=>({externalJobId:String(j.id),title:j.text,description:cleanHtml(j.descriptionPlain||j.description||j.content?.description||""),location:j.categories?.location||j.categories?.allLocations?.join(", ")||"",applyUrl:j.hostedUrl||j.applyUrl,postedAt:parseDate(j.createdAt||j.updatedAt),employmentType:j.categories?.commitment||"",locationType:/remote/i.test(j.categories?.location||"")?"remote":"unknown"}));
}
function atsLinks(html,base){
 const matches=new Set();const $=cheerio.load(html);
 $("a[href]").each((_,a)=>{const h=absolute(base,$(a).attr("href")||"");if(/greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com/i.test(h))matches.add(h)});
 for(const m of html.match(/https?:\/\/[^"'<>\\s]+/gi)||[])if(/greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com/i.test(m))matches.add(m.replace(/&amp;/g,"&"));
 return [...matches].slice(0,50);
}
async function workday(url,country="USA"){
 const u=new URL(url);const match=u.hostname.match(/^(.+?)\.wd\d+\.myworkdayjobs\.com$/i);if(!match)return [];
 const parts=u.pathname.split("/").filter(Boolean);
 const locale=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[0]:"en-US";
 const site=/^[a-z]{2}-[A-Z]{2}$/i.test(parts[0]||"")?parts[1]:parts[0];if(!site)return [];
 const endpoint=u.origin+"/wday/cxs/"+encodeURIComponent(match[1])+"/"+encodeURIComponent(site)+"/jobs";
 const out=[];const seen=new Set();const queries=[COUNTRY_NAMES[country]||country,country,""];
 for(const searchText of queries)for(let offset=0;offset<1000;offset+=20){
  let data;try{data=await jsonFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText})})}catch{break}
  const posts=Array.isArray(data.jobPostings)?data.jobPostings:[];if(!posts.length)break;
  for(const p of posts){
   const path=String(p.externalPath||"");if(!path||seen.has(path))continue;
   const loc=String(p.locationsText||"");const desc=cleanHtml(p.jobPostingInfo?.jobDescription||p.jobDescription||p.description||((p.bulletFields||[]).join(" ")));
   if(!isSupportedLocation(loc,desc,country))continue;
   seen.add(path);out.push({externalJobId:path,title:p.title||"",description:desc,location:loc,applyUrl:new URL("/"+locale+"/"+site+(path.startsWith("/")?path:"/"+path),u.origin).toString(),postedAt:parseDate(p.postedOn||p.postedDate||p.updatedOn),locationType:/remote/i.test(loc)?"remote":"unknown"});
  }
  if(posts.length<20)break;
 }
 return out;
}
function sameSite(a,b){try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"")}catch{return false}}
function looksLikeJobUrl(url){return /\/(job|jobs|career|careers|position|positions|opening|openings|vacanc|requisition|apply)\b/i.test(url)||/[?&](job|jobid|requisition|req)[=_-]/i.test(url)}
async function sitemapUrls(url,base,depth=0){
 if(depth>1)return [];
 try{
  const r=await timeoutFetch(url,15000);if(!r.ok)return [];
  const xml=await r.text();
  const locs=(xml.match(/<loc>[^<]+<\/loc>/gi)||[]).map(x=>x.replace(/<\/?loc>/gi,"").trim()).filter(x=>sameSite(x,base));
  if(/<sitemapindex/i.test(xml)&&depth<1){let out=[];for(const x of locs.slice(0,30))out.push(...await sitemapUrls(x,base,depth+1));return out}
  return locs;
 }catch{return []}
}
async function discoverSiteJobUrls(base){
 const root=new URL(base);const urls=new Set();
 const pages=["/","/careers","/career","/jobs","/search-jobs","/careers/search"];
 for(const path of pages){
  try{
   const page=new URL(path,root).toString();const r=await timeoutFetch(page,15000);if(!r.ok)continue;const html=await r.text();
   for(const j of jsonLdJobs(html,page))urls.add(j.applyUrl);
   const $=cheerio.load(html);
   $("a[href]").each((_,a)=>{const h=absolute(page,$(a).attr("href")||"");const t=$(a).text().replace(/\s+/g," ").trim();if(sameSite(h,root)&&((JOB_WORDS.test(t)&&t.length>5)||looksLikeJobUrl(h)))urls.add(h)});
  }catch{}
 }
 try{
  const r=await timeoutFetch(new URL("/robots.txt",root),10000);
  if(r.ok){const txt=await r.text();for(const line of txt.split(/\r?\n/)){const m=line.match(/^sitemap:\s*(\S+)/i);if(m)for(const x of await sitemapUrls(m[1].trim(),root))if(looksLikeJobUrl(x))urls.add(x)}}
 }catch{}
 for(const path of ["/sitemap.xml","/sitemap_index.xml"])for(const x of await sitemapUrls(new URL(path,root).toString(),root))if(looksLikeJobUrl(x))urls.add(x);
 return [...urls].slice(0,250);
}
async function siteWideJobs(url,country){
 const urls=await discoverSiteJobUrls(url);const out=[];let index=0;
 const worker=async()=>{while(true){const n=index++;if(n>=urls.length)return;const h=urls[n];try{const r=await timeoutFetch(h,15000);if(!r.ok)continue;const html=await r.text();const jobs=jsonLdJobs(html,h);if(jobs.length){out.push(...jobs);continue}const $=cheerio.load(html);const title=($("h1").first().text()||$("title").text()).replace(/\s+/g," ").trim();const description=cleanHtml($("main").first().text()||$("article").first().text()||$("[role=main]").first().text()||"");if(title&&description.length>120&&JOB_WORDS.test(title))out.push({externalJobId:h,title,description,location:$("meta[name=location]").attr("content")||"",applyUrl:h,postedAt:null,locationType:/remote/i.test(description)?"remote":"unknown"})}catch{}}};
 await Promise.all(Array.from({length:6},worker));return out;
}
async function fetchOne(url,country="USA"){
 const u=new URL(url);
 if(/greenhouse\.io/i.test(u.hostname)){const x=await greenhouse(url);if(x.length)return {jobs:x,ats:"greenhouse",complete:true,mode:"greenhouse"}}
 if(u.hostname==="jobs.lever.co"){const x=await lever(url);if(x.length)return {jobs:x,ats:"lever",complete:true,mode:"lever"}}
 if(/myworkdayjobs\.com$/i.test(u.hostname)){const x=await workday(url,country);if(x.length)return {jobs:x,ats:"workday",complete:true,mode:"workday"}}
 const response=await timeoutFetch(url,25000);if(!response.ok)throw new Error("Career page HTTP "+response.status);
 const html=await response.text();
 const structured=jsonLdJobs(html,url);
 const atsUrls=atsLinks(html,url);
 const all=[...structured];let atsName=structured.length?"generic-jsonld":"generic-site-crawl";
 for(const atsUrl of atsUrls){
  try{const x=await fetchOne(atsUrl,country);if(x.jobs.length){all.push(...x.jobs);atsName=x.ats||atsName}}catch{}
 }
 const crawled=await siteWideJobs(url,country);
 all.push(...(crawled.jobs||[]));
 const unique=[...new Map(all.filter(j=>j.applyUrl).map(j=>[j.externalJobId||j.applyUrl,j])).values()];
 return {jobs:unique,ats:atsName,complete:true,mode:crawled.jobs?.length?"site-crawl":atsName};
}
export async function scanCareerPage(url,country="USA"){
 const result=await fetchOne(url,country);const now=new Date();
 const output=result.jobs.map(j=>{const published=j.postedAt instanceof Date?j.postedAt:parseDate(j.postedAt);const date=published||now;const text=[j.title,j.description,j.location].join(" ");return {externalJobId:String(j.externalJobId||j.applyUrl),title:String(j.title||"").trim(),description:String(j.description||"").trim(),location:String(j.location||"").trim(),applyUrl:String(j.applyUrl||"").trim(),postedAt:date,dateSource:published?"published":"detected",employmentType:j.employmentType||"",locationType:j.locationType||"unknown",experienceLevel:experience(text),category:category(text),skills:skills(text)}}).filter(j=>j.title&&j.applyUrl&&isSupportedLocation(j.location,j.description,country));
 output.ats=result.ats||"generic";output.scanMeta={complete:result.complete!==false,mode:result.mode||result.ats||"generic",count:output.length};return output;
}
export {isSupportedLocation};
