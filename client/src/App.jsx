import React,{useMemo,useState} from "react";
import {Search,MapPin,BriefcaseBusiness,Share2,ExternalLink,Sparkles} from "lucide-react";

const jobs=[
 {id:1,title:"Software Engineer",company:"Talent Inspirations Demo",location:"Charlotte, NC",mode:"Hybrid",level:"Experienced",posted:"2 days ago",skills:["Java","Spring Boot","AWS","Docker"],category:"Software Engineering",url:"#"},
 {id:2,title:"Junior DevOps Engineer",company:"Talent Inspirations Demo",location:"Remote - United States",mode:"Remote",level:"Fresher",posted:"4 days ago",skills:["Linux","AWS","Docker","Kubernetes"],category:"DevOps",url:"#"},
 {id:3,title:"Data Analyst",company:"Talent Inspirations Demo",location:"New York, NY",mode:"Onsite",level:"Fresher",posted:"8 days ago",skills:["SQL","Python","Excel","Power BI"],category:"Data",url:"#"}
];

export default function App(){
 const [q,setQ]=useState(""); const [level,setLevel]=useState("All"); const [category,setCategory]=useState("All");
 const filtered=useMemo(()=>jobs.filter(j=>(level==="All"||j.level===level)&&(category==="All"||j.category===category)&&[j.title,j.company,j.location,j.category,...j.skills].join(" ").toLowerCase().includes(q.toLowerCase())),[q,level,category]);
 const share=async j=>{const text=`${j.title} at ${j.company} — ${location.origin}/jobs/${j.id}`; if(navigator.share) await navigator.share({title:j.title,text}); else await navigator.clipboard.writeText(text)};
 return <div className="app">
  <nav><div className="brand"><span>TI</span><b>Talent Inspirations</b></div><a href="/admin">Admin</a></nav>
  <header><div className="eyebrow">🇺🇸 USA CAREERS ONLY</div><h1>Find your next <em>opportunity.</em></h1><p>Fresh USA jobs for freshers and experienced professionals, curated from employer career pages.</p>
   <div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search job title, skill, company..."/></div>
  </header>
  <main><div className="toolbar"><select value={level} onChange={e=>setLevel(e.target.value)}><option>All</option><option>Fresher</option><option>Experienced</option></select><select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option><option>Software Engineering</option><option>DevOps</option><option>Data</option></select><span>{filtered.length} jobs · last 30 days</span></div>
  <section className="grid">{filtered.map(j=><article key={j.id}><div className="top"><div className="logo">TI</div><div><h2>{j.title}</h2><strong>{j.company}</strong></div><button onClick={()=>share(j)} aria-label="Share job"><Share2 size={18}/></button></div><div className="meta"><span><MapPin size={15}/>{j.location}</span><span><BriefcaseBusiness size={15}/>{j.mode}</span><span>{j.level}</span></div><p className="posted">Posted {j.posted} · USA only</p><h3><Sparkles size={16}/> Skills mentioned in this job</h3><div className="skills">{j.skills.map(s=><span key={s}>{s}</span>)}</div><div className="actions"><a href={j.url}>View Details</a><a className="apply" href={j.url}>Apply <ExternalLink size={15}/></a></div></article>)}</section></main>
 </div>
}
