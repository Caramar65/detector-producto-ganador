module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({error:"Método no permitido"});

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({error:"OPENAI_API_KEY no está configurada en Vercel."});

    const input = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!input.length || input.length > 5)
      return res.status(400).json({error:"Debes enviar entre 1 y 5 productos."});

    const products = input.map((p,i)=>{
      const productName=String(p.productName||p.product||p.name||"").trim();
      const description=String(p.description||"").trim();
      const url=String(p.url||"").trim();
      const cost=Number(p.cost), shipping=Number(p.shipping||0), otherCosts=Number(p.otherCosts||0);
      const salePrice=Number(p.salePrice), returns=Number(p.returns||0);
      if(!productName) throw Error(`Falta el nombre del producto ${i+1}.`);
      if(!Number.isFinite(cost)||cost<=0) throw Error(`El costo del producto ${i+1} debe ser mayor que cero.`);
      if(!Number.isFinite(salePrice)||salePrice<=0) throw Error(`El precio de venta del producto ${i+1} debe ser mayor que cero.`);
      const margin=salePrice-cost-shipping-otherCosts;
      const marginPercent=salePrice?margin/salePrice*100:0;
      const maxCPA=Math.max(0,margin*(1-returns/100));
      const targetCPA=Math.max(0,maxCPA*.55);
      const breakEvenROAS=margin>0?salePrice/margin:0;
      return {id:Number(p.id)||i+1,productName,description,url,cost,shipping,otherCosts,salePrice,returns,margin,marginPercent,maxCPA,targetCPA,breakEvenROAS};
    });

    const block=products.map(p=>`
PRODUCTO ${p.id}: ${p.productName}
Descripción: ${p.description||"No proporcionada"}
URL: ${p.url||"No proporcionada"}
Costo: ${p.cost} COP | Envío: ${p.shipping} COP | Otros: ${p.otherCosts} COP | Venta: ${p.salePrice} COP | Devoluciones: ${p.returns}%
Margen: ${p.margin} COP (${p.marginPercent.toFixed(2)}%) | CPA máximo: ${p.maxCPA.toFixed(0)} | CPA objetivo: ${p.targetCPA.toFixed(0)} | ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}
`).join("\n");

    const prompt=`Eres un analista profesional de ecommerce y publicidad para Colombia.

Compara TODOS los productos recibidos, desde 1 hasta 5, usando exactamente los mismos criterios. Debes determinar ganador general, ganador Meta Ads y ganador TikTok Ads.

USA BÚSQUEDA WEB. Investiga cada producto buscando demanda/interés, competencia y precios, anuncios/contenido, potencial visual, diferenciación, compra por impulso y riesgos. Para salud/suplementos/dispositivos, cuando corresponda, consulta fuentes oficiales como INVIMA y políticas publicitarias oficiales.

FUENTES: en "sources" incluye SOLO URLs que realmente hayas obtenido de la búsqueda web o URLs proporcionadas por el usuario. NO inventes URLs. Si no puedes verificar una fuente, no la incluyas. Distingue datos verificables de inferencias. No inventes ventas, CTR, CPA históricos ni cifras de mercado.

Puntuaciones: demanda 0-5, competitionOpportunity 0-5 (5=oportunidad favorable), visual 0-5, differentiation 0-5, impulse 0-5, economicScore 0-100, metaScore 0-100, tiktokScore 0-100, overallScore 0-100.
Ponderación sugerida general: demanda 20%, oportunidad competitiva 15%, visual 15%, diferenciación 10%, impulso 10%, economía 30%.
80-100 prioritario; 70-79 vale la pena testear; 60-69 test con precaución; 50-59 débil; 0-49 no prioritario.

Devuelve ÚNICAMENTE JSON válido, sin markdown ni texto adicional.

PRODUCTOS:
${block}

ESTRUCTURA EXACTA:
{
"products":[{"id":1,"productName":"","overallScore":0,"priority":"","verdict":"","confidence":0,"recommendedPlatform":"","platformReason":"","finalReason":"","summary":"","demand":0,"competitionOpportunity":0,"visual":0,"differentiation":0,"impulse":0,"economicScore":0,"metaScore":0,"tiktokScore":0,"margin":0,"marginPercent":0,"maxCPA":0,"targetCPA":0,"breakEvenROAS":0,"strengths":[],"weaknesses":[],"risks":[],"angles":[],"testPlan":[]}],
"overallWinner":{"id":0,"productName":"","overallScore":0,"priority":"","recommendedPlatform":"","platformReason":"","finalReason":"","summary":"","margin":0,"marginPercent":0,"maxCPA":0,"targetCPA":0,"breakEvenROAS":0,"strengths":[],"weaknesses":[],"risks":[],"angles":[],"testPlan":[]},
"metaWinner":{"id":0,"productName":"","metaScore":0,"platformReason":""},
"tiktokWinner":{"id":0,"productName":"","tiktokScore":0,"platformReason":""},
"recommendation":"","researchNotes":[],"sources":[{"title":"","url":"","note":""}]
}`;

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization:`Bearer ${key}`"},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5",tools:[{type:"web_search"}],input:prompt})
    });
    const raw=await response.text();
    if(!response.ok) return res.status(502).json({error:"OpenAI devolvió un error.",status:response.status,details:raw.slice(0,1500)});

    let apiData; try{apiData=JSON.parse(raw)}catch{return res.status(502).json({error:"OpenAI devolvió una respuesta inesperada.",details:raw.slice(0,1500)})};
    let text=typeof apiData.output_text==="string"?apiData.output_text:"";
    if(!text&&Array.isArray(apiData.output)) for(const item of apiData.output) for(const c of (item.content||[])) if(typeof c?.text==="string") text+=c.text;
    text=text.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    let result; try{result=JSON.parse(text)}catch{return res.status(502).json({error:"La IA no devolvió JSON válido.",details:text.slice(0,2000)})};

    result.products=(Array.isArray(result.products)?result.products:[]).map((r,i)=>{
      const o=products.find(p=>Number(p.id)===Number(r.id))||products[i];
      return {...r,id:o.id,productName:r.productName||o.productName,margin:o.margin,marginPercent:o.marginPercent,maxCPA:o.maxCPA,targetCPA:o.targetCPA,breakEvenROAS:o.breakEvenROAS};
    });

    const sorted=result.products.slice().sort((a,b)=>(Number(b.overallScore)||0)-(Number(a.overallScore)||0));
    result.overallWinner=sorted[0]||null;
    const meta=result.products.slice().sort((a,b)=>(Number(b.metaScore)||0)-(Number(a.metaScore)||0))[0];
    const tik=result.products.slice().sort((a,b)=>(Number(b.tiktokScore)||0)-(Number(a.tiktokScore)||0))[0];
    result.metaWinner=meta?{id:meta.id,productName:meta.productName,metaScore:meta.metaScore,platformReason:meta.platformReason||""}:null;
    result.tiktokWinner=tik?{id:tik.id,productName:tik.productName,tiktokScore:tik.tiktokScore,platformReason:tik.platformReason||""}:null;
    result.sources=Array.isArray(result.sources)?result.sources.filter(s=>s&&/^https?:\/\//i.test(String(s.url||""))).slice(0,20):[];

    return res.status(200).json(result);
  } catch(e) {
    console.error("Research API error:",e);
    return res.status(500).json({error:e.message||"Error interno del servidor."});
  }
};
