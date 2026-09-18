import "dotenv/config";
import express from "express";
import cors from "cors";
const app=express();
app.use(cors()); app.use(express.json());
app.get("/api/health",(req,res)=>res.json({ok:true,service:"talent-inspirations",scope:"USA-only"}));
app.get("/api/jobs",(req,res)=>res.json({jobs:[],rule:"Only USA jobs published within the latest 30 days."}));
const port=process.env.PORT||4000;
app.listen(port,()=>console.log(`Talent Inspirations API listening on ${port}`));
