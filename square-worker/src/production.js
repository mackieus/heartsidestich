// Heartside Stitch — Square PRODUCTION payment Worker.
// Do NOT deploy this with sandbox credentials, and do NOT paste tokens
// into this file, the frontend, or chat. Set SQUARE_ACCESS_TOKEN as a
// Cloudflare Worker secret, and SQUARE_LOCATION_ID as a variable/secret.
// Launch scope: $24.99 tees, sizes S/M/L, $4.95 flat shipping per order,
// no sales tax, email via Square receipts + seller notifications and an
// optional EMAIL_WEBHOOK_URL order-summary hook. Database order storage
// is deferred; the returned orderRecord is structured so it can be saved
// to Cloudflare D1 later without changing the frontend.
const PRODUCTS = new Set(['North Carolina Cardinal Embroidered Tee','Raleigh Acorn Embroidered Tee','Outer Banks Lighthouse Embroidered Tee']);
const SIZES = new Set(['S','M','L']);
const UNIT_PRICE_CENTS = 2499;
const SHIPPING_CENTS = 495;
const TAX_CENTS = 0;
const ORIGIN = 'https://heartsidestitch.com';
const headers = {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin && origin!==ORIGIN) return json({error:'Origin not allowed'},403);
  const url=new URL(request.url);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(url.pathname==='/health' && request.method==='GET') return json({status:'ok',environment:'production'});
  if(url.pathname!=='/api/payment' || request.method!=='POST') return json({error:'Not found'},404);
  if(!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) return json({error:'Production backend not configured'},503);
  let body;
  try {body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  const items=body.items;
  if(!Array.isArray(items)||items.length===0||items.length>20) return json({error:'Invalid cart'},400);
  let count=0;
  for(const item of items){
   if(!PRODUCTS.has(item.name)||!SIZES.has(item.size)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10) return json({error:'Invalid item'},400);
   count+=item.quantity;
  }
  if(count>20) return json({error:'Cart too large'},400);
  if(typeof body.sourceId!=='string'||body.sourceId.length<5||body.sourceId.length>512) return json({error:'Invalid payment token'},400);
  if(typeof body.idempotencyKey!=='string'||!/^[a-f0-9-]{36}$/.test(body.idempotencyKey)) return json({error:'Invalid request ID'},400);
  const buyer=body.buyer||{};
  if(typeof buyer.fullName!=='string'||buyer.fullName.trim().length<1||buyer.fullName.length>100) return json({error:'Invalid buyer name'},400);
  if(!isEmail(buyer.email)) return json({error:'Invalid buyer email'},400);
  if(typeof buyer.address1!=='string'||buyer.address1.trim().length<1||buyer.address1.length>120) return json({error:'Invalid shipping address'},400);
  if(typeof buyer.city!=='string'||buyer.city.trim().length<1||buyer.city.length>80) return json({error:'Invalid shipping city'},400);
  if(typeof buyer.state!=='string'||!/^[A-Za-z]{2}$/.test(buyer.state)) return json({error:'Invalid shipping state'},400);
  if(typeof buyer.postalCode!=='string'||!/^[0-9]{5}(-[0-9]{4})?$/.test(buyer.postalCode)) return json({error:'Invalid ZIP code'},400);
  const merchandiseCents=count*UNIT_PRICE_CENTS;
  const amount=merchandiseCents+SHIPPING_CENTS+TAX_CENTS;
  const result=await fetch('https://connect.squareup.com/v2/payments',{
   method:'POST',headers:{'Authorization':'Bearer '+env.SQUARE_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':'2026-09-16'},
   body:JSON.stringify({source_id:body.sourceId,idempotency_key:body.idempotencyKey,location_id:env.SQUARE_LOCATION_ID,amount_money:{amount,currency:'USD'},autocomplete:true,buyer_email_address:buyer.email,note:'Heartside Stitch: '+items.map(i=>i.quantity+'x '+i.name+' '+i.size).join('; ').slice(0,400)})
  });
  const response=await result.json().catch(()=>({}));
  if(!result.ok) return json({error:'Square payment failed',details:(response.errors||[]).map(e=>({code:e.code,category:e.category,field:e.field||null,detail:typeof e.detail==='string'?e.detail.slice(0,300).replace(/(?:Bearer\s+)?(?:EAAA|sq0atp-|cnon:)[^\s,;]+/gi,'[redacted]'):null}))},502);
  const payment=response.payment;
  if(!payment?.id || !payment?.status) return json({error:'Square returned an incomplete payment response'},502);
  const orderRecord={id:crypto.randomUUID(),squarePaymentId:payment.id,environment:'production',paymentStatus:payment.status,fulfillmentStatus:'pending',items,merchandiseCents,shippingCents:SHIPPING_CENTS,taxCents:TAX_CENTS,totalCents:amount,buyer:{fullName:buyer.fullName,email:buyer.email,address1:buyer.address1,address2:buyer.address2||'',city:buyer.city,state:buyer.state.toUpperCase(),postalCode:buyer.postalCode},createdAt:new Date().toISOString()};
  let emailStatus='not_configured';
  if(env.EMAIL_WEBHOOK_URL && payment.status==='COMPLETED'){
   try{
    const r=await fetch(env.EMAIL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:'Heartside Stitch order '+payment.id,order:orderRecord})});
    emailStatus=r.ok?'sent':'failed';
   }catch{emailStatus='failed'}
  }
  return json({status:payment.status,paymentId:payment.id,amountCents:amount,merchandiseCents,shippingCents:SHIPPING_CENTS,taxCents:TAX_CENTS,environment:'production',orderRecord,emailStatus});
 }
};
