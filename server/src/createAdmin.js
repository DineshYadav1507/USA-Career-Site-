import "dotenv/config";import mysql from "mysql2/promise";import bcrypt from "bcryptjs";
const [,,email,password]=process.argv;if(!email||!password){console.error("Usage: node src/createAdmin.js email password");process.exit(1)}
const pool=await mysql.createConnection({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"talent",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"talent_inspirations"});
await pool.execute("INSERT INTO admin_users(email,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)",[email,await bcrypt.hash(password,12)]);console.log("Admin created/updated:",email);await pool.end();
