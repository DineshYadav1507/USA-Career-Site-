import "dotenv/config";
import mysql from "mysql2/promise";
import {syncSource} from "./sync.js";
const pool=mysql.createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"talent",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"talent_inspirations",connectionLimit:5});
export async function runSync(){const [sources]=await pool.query("SELECT id FROM job_sources WHERE status='active'");const results=[];for(const s of sources){try{results.push(await syncSource(pool,s.id))}catch(e){await pool.query("UPDATE job_sources SET status='error',last_checked_at=NOW() WHERE id=?",[s.id]);results.push({sourceId:s.id,error:e.message})}}await pool.query("UPDATE jobs SET is_active=0 WHERE expires_at<NOW() OR country<>'United States'");return results}
if(process.argv[1]?.endsWith("worker.js")){runSync().then(r=>{console.log(JSON.stringify(r));process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})}
