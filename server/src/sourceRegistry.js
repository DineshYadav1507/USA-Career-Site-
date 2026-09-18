export const ATS={JOBVITE:"jobvite",GREENHOUSE:"greenhouse",WORKDAY:"workday",ORACLE:"oracle",ADP:"adp",ICIMS:"icims",SUCCESSFACTORS:"successfactors",LEVER:"lever",ASHBY:"ashby",SMARTRECRUITERS:"smartrecruiters",GENERIC:"generic"};
export const CATEGORIES=["Healthcare","University & Education","Supply Chain","Technology","Finance & Banking","Insurance","Consulting","Retail","Manufacturing","Government","Pharmaceuticals","Energy","Telecommunications","Other"];
export function detectSource(url=""){const u=url.toLowerCase();if(/jobvite/.test(u))return ATS.JOBVITE;if(/greenhouse\.io/.test(u))return ATS.GREENHOUSE;if(/myworkdayjobs|workdayjobs|workday\.com/.test(u))return ATS.WORKDAY;if(/oraclecloud/.test(u))return ATS.ORACLE;if(/adp\.com/.test(u))return ATS.ADP;if(/icims\.com/.test(u))return ATS.ICIMS;if(/successfactors|jobs\.sap\.com/.test(u))return ATS.SUCCESSFACTORS;if(/jobs\.lever\.co/.test(u))return ATS.LEVER;if(/ashbyhq\.com/.test(u))return ATS.ASHBY;if(/smartrecruiters\.com/.test(u))return ATS.SMARTRECRUITERS;return ATS.GENERIC}
export function classifyIndustry(company="",text=""){const s=(company+" "+text).toLowerCase();if(/hospital|healthcare|medical|clinic|health|pharma|biotech/.test(s))return"Healthcare";if(/university|college|school|education|academic/.test(s))return"University & Education";if(/supply chain|logistics|warehouse|procurement|freight|transportation/.test(s))return"Supply Chain";if(/bank|financial|fintech|credit|capital/.test(s))return"Finance & Banking";if(/insurance/.test(s))return"Insurance";if(/retail|ecommerce|store/.test(s))return"Retail";if(/manufactur|industrial/.test(s))return"Manufacturing";if(/telecom|wireless|communications/.test(s))return"Telecommunications";if(/energy|oil|gas|utility/.test(s))return"Energy";if(/consulting/.test(s))return"Consulting";return"Other"}
export const DEFAULT_RECRUITMENT_SOURCES=[
{name:"Corpshore Talent",url:"https://corpshoretalent.com/"},
{name:"Remote Employee",url:"https://remoteemployee.com/"},
{name:"Adecco",url:"https://www.adecco.com/en-us/jobs"},
{name:"Korn Ferry",url:"https://www.kornferry.com/careers"},
{name:"Randstad",url:"https://www.randstadusa.com/jobs/"},
{name:"SCM Talent Group",url:"https://scmtalent.com/"},
{name:"Kforce",url:"https://www.kforce.com/find-work/"},
{name:"Manpower",url:"https://www.manpower.com/"},
{name:"AppleOne",url:"https://www.appleone.com/Jobs/"},
{name:"Aerotek",url:"https://www.aerotek.com/en/jobs"},
{name:"Hirewell",url:"https://hirewell.com/jobs/"},
{name:"Michael Page",url:"https://www.michaelpage.com/job-search"},
{name:"Beacon Hill",url:"https://beaconhillstaffing.com/jobs/"},
{name:"TEKsystems",url:"https://www.teksystems.com/en/careers"},
{name:"A Plus Staffing",url:"https://jobs.aplus-staffing.com/jobs"},
{name:"Soshace",url:"https://soshace.com/jobs"},
{name:"Apollo Technical",url:"https://www.apollotechnical.com/careers-engineering-it/"},
{name:"Tiger Recruitment",url:"https://tiger-recruitment.com/us/finance/jobs/"},
{name:"H.I.M. Recruiters",url:"https://www.himjobs.com/"},
{name:"ISG Partners",url:"https://isgpartners.com/jobs/"}
];
