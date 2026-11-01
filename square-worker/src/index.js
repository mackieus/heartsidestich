// Heartside Stitch — Square Sandbox ONLY. Do not switch to production without
// implementing shipping/tax calculation, persistent orders, and fulfillment workflows.
const PRODUCTS = new Set(['North Carolina Cardinal Embroidered Tee','Raleigh Acorn Embroidered Tee','Outer Banks Lighthouse Embroidered Tee']);
const SIZES = new Set(['S','M','L']);
const UNIT_PRICE_CENTS = 2499;
const SHIPPING_CENTS = 599;
const ORIGIN = 'https://heartsidestitch.com';
const headers = {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin && origin!==ORIGIN) return json({error:'Origin not allowed'},403);
  const url=new URL(request.url);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(url.pathname==='/health' && request.method==='GET') return json({status:'ok',environment:'sandbox'});
  if(url.pathname!=='/api/sandbox-payment' || request.method!=='POST') return json({error:'Not found'},404);
  if(!env.SQUARE_SANDBOX_ACCESS_TOKEN || !env.SQUARE_SANDBOX_LOCATION_ID) return json({error:'Sandbox backend not configured'},503);
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
  const merchandiseCents=count*UNIT_PRICE_CENTS;
  const amount=merchandiseCents+SHIPPING_CENTS; // sandbox only: tax not calculated
  const result=await fetch('https://connect.squareupsandbox.com/v2/payments',{
   method:'POST',headers:{'Authorization':'Bearer '+env.SQUARE_SANDBOX_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':'2026-09-16'},
   body:JSON.stringify({source_id:body.sourceId,idempotency_key:body.idempotencyKey,location_id:env.SQUARE_SANDBOX_LOCATION_ID,amount_money:{amount,currency:'USD'},autocomplete:true,note:'SANDBOX ONLY Heartside Stitch: '+items.map(i=>i.quantity+'x '+i.name+' '+i.size).join('; ').slice(0,400)})
  });
  const response=await result.json().catch(()=>({}));
  if(!result.ok) return json({error:'Square sandbox payment failed',details:(response.errors||[]).map(e=>({code:e.code,category:e.category,field:e.field||null,detail:typeof e.detail==='string'?e.detail.slice(0,300).replace(/(?:Bearer\s+)?(?:EAAA|sandbox-sq0atb-|cnon:)[^\s,;]+/gi,'[redacted]'):null}))},502);
  const payment=response.payment;
  if(!payment?.id || !payment?.status) return json({error:'Square returned an incomplete payment response'},502);
  // D1 is optional during migration; never claim that an order was stored when it was not.
  let orderStored=false;
  let orderStorageStatus=env.ORDERS_DB?'failed':'not_configured';
  if(env.ORDERS_DB && payment.status==='COMPLETED'){
   try{
    await env.ORDERS_DB.prepare(
     'INSERT OR IGNORE INTO orders (id,square_payment_id,environment,payment_status,items_json,merchandise_cents,shipping_cents,tax_cents,total_cents) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(crypto.randomUUID(),payment.id,'sandbox',payment.status,JSON.stringify(items),merchandiseCents,SHIPPING_CENTS,null,amount).run();
    const row=await env.ORDERS_DB.prepare('SELECT id FROM orders WHERE square_payment_id=?').bind(payment.id).first();
    orderStored=!!row;
    orderStorageStatus=orderStored?'stored':'failed';
   }catch(e){console.error('Sandbox order storage failed',e?.message||'unknown')}
  }
  return json({status:payment.status,paymentId:payment.id,amountCents:amount,merchandiseCents,shippingCents:SHIPPING_CENTS,taxCents:null,environment:'sandbox',orderStored,orderStorageStatus});
 }
};
