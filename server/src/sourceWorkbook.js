import * as XLSX from "xlsx";
export async function importCareerWorkbook(buffer,{adminId,pool,upsertSource,scanSource}) {
 const wb=XLSX.read(buffer,{type:"buffer"});
 const rows=[];
 for(const sheet of wb.SheetNames){for(const row of XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:""})){rows.push({...row,__sheet:sheet});}}
 const pick=(row,names)=>{for(const n of names){const key=Object.keys(row).find(k=>k.toLowerCase().replace(/[^a-z0-9]/g,"")===n);if(key&&String(row[key]).trim())return String(row[key]).trim()}return ""};
 let imported=0,errors=0,companyCount=0,sourceCount=0;const seen=new Set();
 for(const row of rows){
  const name=pick(row,["company","companyname","employer","name"]);
  const url=pick(row,["careerurl","careersurl","careerpage","careers","url","joburl","website"]);
  const industry=pick(row,["industry","sector"])||"Other";
  const country=pick(row,["country","market","region"])||"USA";
  if(!name||!/^https?:\/\//i.test(url)){errors++;continue}
  const key=name.toLowerCase()+"|"+url.toLowerCase();if(seen.has(key))continue;seen.add(key);
  try{await upsertSource(name,url,industry,country);sourceCount++;companyCount++;imported++;}catch{errors++}
 }
 const [r]=await pool.query("INSERT INTO source_imports(admin_id,file_name,company_count,source_count,imported_count,error_count) VALUES(?,?,?,?,?,?)",[adminId,"uploaded-workbook.xlsx",companyCount,sourceCount,imported,errors]);
 const [sources]=await pool.query("SELECT id FROM career_sources WHERE id IN (SELECT MAX(id) FROM career_sources GROUP BY source_url)");
 const scanResults=[];
 for(const s of sources.slice(0,100)){try{scanResults.push(await scanSource(s.id))}catch(e){scanResults.push({sourceId:s.id,error:e.message})}}
 return {importId:r.insertId,rows:rows.length,companyCount,sourceCount,imported,errors,scanned:scanResults.length,scanResults};
}
