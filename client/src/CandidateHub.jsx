import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {FileText,Briefcase,ChevronDown,ChevronUp,Sparkles,ExternalLink,History,CreditCard,Save} from "lucide-react";
const API=import.meta.env.VITE_API_URL||"/api";
async function api(path,options={},token){const r=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed");return d}
export default function CandidateHub(){
 const token=localStorage.getItem("ti_token")||"";const user=JSON.parse(localStorage.getItem("ti_user")||"null");
 const [buckets,setBuckets]=useState([]),[apps,setApps]=useState([]),[plans,setPlans]=useState([]),[open,setOpen]=useState(null),[intel,setIntel]=useState({}),[cv,setCv]=useState(""),[cvName,setCvName]=useState("Master CV"),[msg,setMsg]=useState("");
 const load=()=>Promise.all([api("/account/today-buckets",{},token),api("/account/applications",{},token),api("/billing/plans")]).then(([b,a,p])=>{setBuckets(b.buckets||[]);setApps(a.applications||[]);setPlans(p.plans||[])}).catch(e=>setMsg(e.message));
 useEffect(()=>{if(token)load()},[token]);
 const prepare=async id=>{try{const d=await api("/account/job/"+id+"/prepare",{method:"POST"},token);setIntel(x=>({...x,[id]:d.package}));setMsg("Tailored resume and cover letter prepared.");load()}catch(e){setMsg(e.message)}};
 const analyze=async id=>{try{const d=await api("/account/job/"+id+"/intelligence",{},token);setIntel(x=>({...x,[id]:d.intelligence}))}catch(e){setMsg(e.message)}};
 const saveCv=async()=>{try{await api("/account/master-cv",{method:"POST",body:JSON.stringify({text:cv,name:cvName})},token);setMsg("Master CV saved. New job packages will use it.");}catch(e){setMsg(e.message)}};
 const checkout=async planCode=>{try{const d=await api("/billing/checkout",{method:"POST",body:JSON.stringify({planCode})},token);window.location.href=d.url}catch(e){setMsg(e.message)}};
 if(!token)return <main className="candidatehub"><section className="panel"><h1>Career Agent Workspace</h1><p>Please sign in to access today's personalized job buckets.</p><Link className="primary" to="/account">Sign in</Link></section></main>;
 return <main className="candidatehub">
  <header className="candidatehero"><div><div className="eyebrow">MY CAREER AGENT · {user?.country||"USA"}</div><h1>Today's Job Buckets</h1><p>Jobs discovered today are grouped by role and prepared against your master CV.</p></div><Link className="secondary" to="/account">Account</Link></header>
  <section className="candidategrid">
   <div>
    {buckets.map(b=><section className="panel bucket" key={b.slug}><button className="buckethead" onClick={()=>setOpen(open===b.slug?null:b.slug)}><div><b>{b.name}</b><small>{b.count} jobs discovered today</small></div>{open===b.slug?<ChevronUp/>:<ChevronDown/>}</button>{open===b.slug&&<div className="bucketjobs">{b.jobs.map(j=><article className="candidatejob" key={j.id}><div><div className="jobtop"><div className="companymark">{j.company.slice(0,2).toUpperCase()}</div><div className="jobtitle"><h2>{j.title}</h2><small>{j.company} · {j.location||j.country}</small></div></div><div className="skills">{j.skills.slice(0,8).map(s=><span key={s}>{s}</span>)}</div></div><div className="candidateactions"><button className="secondary small" onClick={()=>analyze(j.id)}>Analyze JD</button><button className="primary small" onClick={()=>prepare(j.id)}>Prepare Apply Pack</button><a className="secondary small" href={j.apply_url} target="_blank" rel="noreferrer">Employer <ExternalLink size={13}/></a></div>{intel[j.id]&&<div className="intelbox"><div className="intelstats"><strong>ATS {intel[j.id].atsScore}%</strong><span>{intel[j.id].experienceSummary}</span></div><h4>ATS skills</h4><div className="skills">{intel[j.id].atsSkills?.map(s=><span key={s}>{s}</span>)}</div><h4>2-point summary</h4><ol>{(intel[j.id].summaryPoints||[]).map(x=><li key={x}>{x}</li>)}</ol><h4>JD description</h4><div className="description compact">{String(j.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}</div><details><summary>Tailored resume</summary><pre>{intel[j.id].tailoredResume}</pre></details><details><summary>Cover letter</summary><pre>{intel[j.id].coverLetter}</pre></details></div>}</article>)}</div>}</section>)}
    {!buckets.length&&<section className="panel empty"><Sparkles/><h2>No jobs discovered today</h2><p>The Career Agent may not have found new jobs for your country yet.</p></section>}
   </div>
   <aside>
    <section className="panel"><h2><FileText/> Master CV</h2><p>Store your verified master CV once. The Job Intelligence engine uses it to build role-specific application packages.</p><input value={cvName} onChange={e=>setCvName(e.target.value)} placeholder="CV name"/><textarea className="cvtextarea" value={cv} onChange={e=>setCv(e.target.value)} placeholder="Paste your master resume/CV text here..."/><button className="primary wide" onClick={saveCv}><Save size={15}/> Save Master CV</button></section>
    <section className="panel"><h2><History/> Application History</h2>{apps.slice(0,12).map(a=><div className="historyrow" key={a.id}><b>{a.title}</b><small>{a.company} · {a.status} · {a.country}</small></div>)}{!apps.length&&<p>No prepared applications yet.</p>}</section>
    <section className="panel"><h2><CreditCard/> Plans</h2>{plans.map(p=><div className="planrow" key={p.code}><div><b>$ {p.price}</b><span>{p.name}</span></div><button className="secondary small" onClick={()=>checkout(p.code)}>Choose</button></div>)}</section>
   </aside>
  </section><p className="notice">{msg}</p>
 </main>
}
