import {Client,LocalAuth} from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import {EventEmitter} from "node:events";

class WhatsAppEngine extends EventEmitter{
 constructor(){
  super();
  this.ready=false;
  this.qr=null;
  this.queue=[];
  this.sending=false;
  this.lastSentAt=0;
  this.minDelayMs=Number(process.env.WA_MIN_DELAY_MS||45000);
  this.maxDelayMs=Number(process.env.WA_MAX_DELAY_MS||180000);
  this.dailyLimit=Number(process.env.WA_DAILY_LIMIT||80);
  this.recipientCooldownMs=Number(process.env.WA_RECIPIENT_COOLDOWN_MS||600000);
  this.lastRecipientSent=new Map();
  this.sentToday=0;
  this.dayKey=new Date().toISOString().slice(0,10);
  this.client=new Client({
   authStrategy:new LocalAuth({clientId:"talent-inspirations",dataPath:"./.wwebjs_auth"}),
   puppeteer:{headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]}
  });
  this.client.on("qr",qr=>{this.qr=qr;this.ready=false;console.log("WhatsApp QR received — scan it from the VPS terminal");qrcode.generate(qr,{small:true});this.emit("qr",qr)});
  this.client.on("authenticated",()=>console.log("WhatsApp authenticated"));
  this.client.on("ready",()=>{this.ready=true;console.log("WhatsApp Web ready");this.emit("ready")});
  this.client.on("auth_failure",m=>{this.ready=false;console.error("WhatsApp auth failure:",m)});
  this.client.on("disconnected",r=>{this.ready=false;console.error("WhatsApp disconnected:",r)});
  this.client.on("message",msg=>this.emit("message",msg));
 }
 resetDaily(){const key=new Date().toISOString().slice(0,10);if(key!==this.dayKey){this.dayKey=key;this.sentToday=0}}
 randomDelay(){return Math.floor(this.minDelayMs+Math.random()*(this.maxDelayMs-this.minDelayMs))}
 enqueue(to,text,meta={}){
  this.queue.push({to:String(to).replace(/[^\d]/g,""),text,meta});
  this.process().catch(e=>console.error("WhatsApp queue:",e.message));
 }
 async process(){
  if(this.sending||!this.ready)return;
  this.sending=true;
  try{
   while(this.queue.length){
    this.resetDaily();
    if(this.sentToday>=this.dailyLimit){console.warn("WhatsApp daily safety limit reached");break}
    const item=this.queue.shift();
    const now=Date.now();
    const wait=Math.max(0,this.lastSentAt+this.randomDelay()-now);
    if(wait)await new Promise(r=>setTimeout(r,wait));
    const lastRecipient=this.lastRecipientSent.get(item.to)||0;
    const recipientWait=Math.max(0,lastRecipient+this.recipientCooldownMs-Date.now());
    if(recipientWait)await new Promise(r=>setTimeout(r,recipientWait));
    const chatId=item.to+"@c.us";
    const exists=await this.client.isRegisteredUser(chatId).catch(()=>false);
    if(!exists){console.warn("WhatsApp number is not registered:",item.to);continue}
    await this.client.sendMessage(chatId,item.text);
    this.lastSentAt=Date.now();
    this.lastRecipientSent.set(item.to,this.lastSentAt);
    this.sentToday++;
    this.emit("sent",item);
   }
  }finally{this.sending=false}
 }
 async send(to,text,meta={}){this.enqueue(to,text,meta);return {queued:true}}
 async start(){await this.client.initialize()}
 status(){this.resetDaily();return {ready:this.ready,queued:this.queue.length,sentToday:this.sentToday,dailyLimit:this.dailyLimit,qrPending:Boolean(this.qr)}}
}
export const whatsapp=new WhatsAppEngine();
