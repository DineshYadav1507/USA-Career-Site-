export function whatsappConfigured(){return Boolean(process.env.WHATSAPP_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID)}
export async function sendWhatsApp({phone,text}){
 if(!whatsappConfigured())return {ok:false,queued:true,reason:"WhatsApp Cloud API is not configured"};
 const version=process.env.WHATSAPP_API_VERSION||"v23.0";
 const url=`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
 const r=await fetch(url,{method:"POST",headers:{"Authorization":`Bearer ${process.env.WHATSAPP_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:phone,type:"text",text:{preview_url:true,body:text}})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data?.error?.message||`WhatsApp HTTP ${r.status}`);
 return {ok:true,id:data?.messages?.[0]?.id||null};
}
