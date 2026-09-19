import Stripe from "stripe";
let stripe=null;
function client(){if(!stripe&&process.env.STRIPE_SECRET_KEY)stripe=new Stripe(process.env.STRIPE_SECRET_KEY);return stripe}
export const PLANS=[
 {code:"starter_15",name:"15 Days",price:49,durationDays:15,priceEnv:"STRIPE_PRICE_49_15D"},
 {code:"pro_31",name:"31 Days",price:99,durationDays:31,priceEnv:"STRIPE_PRICE_99_31D"},
 {code:"pro_90",name:"3 Months",price:199,durationDays:90,priceEnv:"STRIPE_PRICE_199_3M"},
 {code:"pro_180",name:"6 Months",price:399,durationDays:180,priceEnv:"STRIPE_PRICE_399_6M"}
];
export function getPlan(code){return PLANS.find(x=>x.code===code)||PLANS[1]}
export function billingConfigured(){return Boolean(process.env.STRIPE_SECRET_KEY&&(process.env.STRIPE_PRICE_ID||PLANS.some(p=>process.env[p.priceEnv])))}
export async function createCheckout({userId,email,planCode="pro_31"}){
 const s=client();if(!s)throw new Error("Stripe is not configured");
 const plan=getPlan(planCode);const priceId=process.env[plan.priceEnv]||process.env.STRIPE_PRICE_ID;
 if(!priceId)throw new Error(`Stripe price is not configured for ${plan.name}`);
 const base=process.env.PUBLIC_WEB_URL||"http://localhost:5173";
 const session=await s.checkout.sessions.create({
  mode:"subscription",customer_email:email||undefined,client_reference_id:String(userId),
  line_items:[{price:priceId,quantity:1}],
  success_url:`${base}/account?payment=success&plan=${encodeURIComponent(plan.code)}`,
  cancel_url:`${base}/account?payment=cancelled`,
  metadata:{user_id:String(userId),plan_code:plan.code,duration_days:String(plan.durationDays)},
  subscription_data:{metadata:{user_id:String(userId),plan_code:plan.code,duration_days:String(plan.durationDays)}}
 });
 return session;
}
export function constructWebhook(raw,signature){const s=client();if(!s||!process.env.STRIPE_WEBHOOK_SECRET)throw new Error("Stripe webhook is not configured");return s.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);}
