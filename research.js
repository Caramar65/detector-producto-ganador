export default async function handler(req,res){
if(req.method!=="POST")return res.status(405).json({error:"Usa POST."});
try{
const key=process.env.OPENAI_API_KEY;if(!key)return res.status(500).json({error:"OPENAI_API_KEY no está configurada en Vercel."});
const input=req.body?.products;if(!Array.isArray(input)||input.length<1||input.length>5)return res.status(400).json({error:"Debes enviar entre 1 y 5 productos."});
const products=input.map((p,i)=>{
const name=String(p.productName||p.product||"").trim(),cost=Number(p.cost),ship=Number(p.shipping||0),other=Number(p.otherCosts||0),price=Number(p.salePrice),ret=Number(p.returns||0);
if(!name)throw Error("Falta el nombre del producto "+(i+1)+".");if(!(cost>0))throw Error("Costo inválido en producto "+(i+1)+".");if(!(price>0))throw Error("Precio inválido en producto "+(i+1)+".");
const margin=price-cost-ship-other,adj=Math.max(0,margin*(1-ret/100));
return {...p,productName:name,cost,shipping:ship,otherCosts:other,salePrice:price,returns:ret,margin,marginPercent:price?margin/price*100:0,maxCPA:adj,targetCPA:adj*.55,breakEvenROAS:margin>0?price/margin:0};
});
const info=products.map(p=>`PRODUCTO ${p.id}: ${p.productName}\nDescripción: ${p.description||"N/D"}\nURL: ${p.url||"N/D"}\nCosto: ${p.cost} COP | Envío: ${p.shipping} | Otros: ${p.otherCosts} | Precio: ${p.salePrice} | Devoluciones: ${p.returns}% | Margen: ${p.margin} (${p.marginPercent.toFixed(1)}%) | CPA máximo: ${p.maxCPA.toFixed(0)} | CPA objetivo: ${p.targetCPA.toFixed(0)} | ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}x`).join("\n\n");

const schema={type:"object",additionalProperties:false,properties:{
products:{type:"array",minItems:1,maxItems:5,items:{type:"object",additionalProperties:false,properties:{
id:{type:"integer"},productName:{type:"string"},overallScore:{type:"number"},demand:{type:"integer"},competitionOpportunity:{type:"integer"},visual:{type:"integer"},differentiation:{type:"integer"},impulse:{type:"integer"},economicScore:{type:"number"},metaScore:{type:"number"},tiktokScore:{type:"number"},recommendedPlatform:{type:"string"},priority:{type:"string"},verdict:{type:"string"},summary:{type:"string"},finalReason:{type:"string"},platformReason:{type:"string"},margin:{type:"number"},marginPercent:{type:"number"},maxCPA:{type:"number"},targetCPA:{type:"number"},breakEvenROAS:{type:"number"},strengths:{type:"array",items:{type:"string"}},weaknesses:{type:"array",items:{type:"string"}},risks:{type:"array",items:{type:"string"}},angles:{type:"array",items:{type:"string"}},testPlan:{type:"array",items:{type:"string"}}},required:["id","productName","overallScore","demand","competitionOpportunity","visual","differentiation","impulse","economicScore","metaScore","tiktokScore","recommendedPlatform","priority","verdict","summary","finalReason","platformReason","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan"]}},
overallWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
metaWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
tiktokWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
recommendation:{type:"string"},researchNotes:{type:"array",items:{type:"string"}},sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"}},required:["title","url"]}}
},required:["products","overallWinner","metaWinner","tiktokWinner","recommendation","researchNotes","sources"]};

const prompt=`Compara estos ${products.length} productos para ecommerce/dropshipping en Colombia. Usa investigación web actual y verificable cuando sea posible. No inventes ventas ni cifras. Si una señal no es verificable, declárala como estimación.
Puntuaciones: demanda 1-5 (5 fuerte); competitionOpportunity 1-5 (5 = oportunidad competitiva favorable); visual 1-5; differentiation 1-5; impulse 1-5. EconomicScore, metaScore y tiktokScore de 0-100.
OverallScore: 20% demanda + 15% oportunidad competitiva + 15% visual + 10% diferenciación + 10% impulso + 20% economía + 10% mejor plataforma.
80-100 PRODUCTO PRIORITARIO; 70-79 VALE LA PENA TESTEAR; 60-69 TEST CON PRECAUCIÓN; 50-59 PRODUCTO DÉBIL; 0-49 NO PRIORITARIO.
El overallWinner debe ser el mayor overallScore; metaWinner el mayor metaScore; tiktokWinner el mayor tiktokScore. Devuelve solo el JSON del esquema.
DATOS:
${info}`;

const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({
model:process.env.OPENAI_MODEL||"gpt-5.6",tools:[{type:"web_search"}],input:prompt,text:{format:{type:"json_schema",name:"product_comparison",strict:true,schema}}
})});
const raw=await response.text();if(!response.ok){let e={};try{e=JSON.parse(raw)}catch{}return res.status(response.status).json({error:e?.error?.message||"Error de OpenAI."});}
let apiResult;try{apiResult=JSON.parse(raw)}catch{return res.status(502).json({error:"OpenAI respondió con formato inesperado."})}
let text=apiResult.output_text||"";
if(!text&&Array.isArray(apiResult.output)){
  for(const item of apiResult.output){
    if(Array.isArray(item.content)){
      for(const content of item.content){
        if(typeof content.text==="string") text+=content.text;
      }
    }
  }
}
if(!text)return res.status(502).json({error:"OpenAI no devolvió contenido utilizable."});
let data;try{data=JSON.parse(text)}catch{return res.status(502).json({error:"OpenAI no devolvió JSON válido."})}
const byId=new Map(products.map(p=>[p.id,p]));data.products=(data.products||[]).map(x=>({...x,...(byId.get(x.id)||{})}));
const scored=new Map(data.products.map(p=>[p.id,p]));data.overallWinner=scored.get(data.overallWinner.id)||data.products[0];data.metaWinner=scored.get(data.metaWinner.id)||data.products[0];data.tiktokWinner=scored.get(data.tiktokWinner.id)||data.products[0];
return res.status(200).json(data);
}catch(e){console.error(e);return res.status(500).json({error:e.message||"Error interno."});}
}