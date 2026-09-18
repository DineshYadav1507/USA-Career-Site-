import Stripe from "stripe";
let stripe=null;
function client(){if(!stripe&&process.env.STRIPE_SECRET_KEY)stripe=new Stripe(process.env.STRIPE_SECRET_KEY);return stripe}
export function billingConfigured(){return Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID)}
export async function createCheckout({userId,email}){
 const s=client();if(!s)throw new Error("Stripe is not configured");
 const base=process.env.PUBLIC_WEB_URL||"http://localhost:5173";
 const session=await s.checkout.sessions.create({
  mode:"subscription",
  customer_email:email||undefined,
  client_reference_id:String(userId),
  line_items:[{price:process.env.STRIPE_PRICE_ID,quantity:1}],
  success_url:`${base}/account?payment=success`,
  cancel_url:`${base}/account?payment=cancelled`,
  metadata:{user_id:String(userId)}
 });
 return session;
}
export function constructWebhook(raw,signature){
 const s=client();if(!s||!process.env.STRIPE_WEBHOOK_SECRET)throw new Error("Stripe webhook is not configured");
 return s.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);
}
