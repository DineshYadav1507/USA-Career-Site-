import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
const [,,email,password]=process.argv;
if(!email||!password){console.error("Usage: node src/createAdmin.js admin@example.com StrongPassword");process.exit(1)}
const db=await mysql.createConnection({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME||"talent_inspirations"});
const hash=await bcrypt.hash(password,12);
await db.query("INSERT INTO admin_users(email,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)",[email,hash]);
await db.end();console.log("Admin created/updated:",email);
