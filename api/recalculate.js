function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,v));}
function qualitative(v){const n=Number(v);if(!Number.isFinite(n))return 0;return clamp((n-1)/4*100);}
function economicScore(product,input){
  const sale=Number(input?.salePrice ?? product?.salePrice);
  const margin=Number(input?.margin ?? product?.margin);
  const returns=Number(input?.returns ?? product?.returns ?? 0);
  if(!Number.isFinite(sale)||sale<=0||!Number.isFinite(margin))return 0;
  const adjusted=Math.max(0,margin*(1-clamp(returns,0,100)/100));
  const adjustedMarginPct=adjusted/sale*100;
  // 50% de margen ajustado se considera el nivel económico de referencia (100/100).
  return clamp(adjustedMarginPct/50*100);
}
function scoreProduct(p,input){
  const demand=qualitative(p.demand);
  const competition=qualitative(p.competitionOpportunity);
  const visual=qualitative(p.visual);
  const differentiation=qualitative(p.differentiation);
  const impulse=qualitative(p.impulse);
  const economy=economicScore(p,input);
  const meta=clamp(Number(p.metaScore)||0);
  const tiktok=clamp(Number(p.tiktokScore)||0);
  const bestPlatform=Math.max(meta,tiktok);
  const overall=(demand*.20)+(competition*.15)+(visual*.15)+(differentiation*.10)+(impulse*.10)+(economy*.20)+(bestPlatform*.10);
  const platform=meta>=tiktok?'Meta Ads':'TikTok Ads';
  let priority='No prioritario';
  if(overall>=80)priority='Producto prioritario';
  else if(overall>=70)priority='Vale la pena testear';
  else if(overall>=60)priority='Test con precaución';
  else if(overall>=50)priority='Producto débil';
  return Object.assign({},p,{economicScore:Number(economy.toFixed(1)),overallScore:Number(overall.toFixed(1)),recommendedPlatform:platform,priority});
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({error:'Usa POST.'});
  try{
    const body=req.body||{};
    const result=body.result;
    const inputs=Array.isArray(body.products)?body.products:[];
    if(!result||!Array.isArray(result.products))return res.status(400).json({error:'Faltan los resultados de investigación.'});
    const inputMap=new Map(inputs.map(x=>[Number(x.id),x]));
    const products=result.products.map(p=>scoreProduct(p,inputMap.get(Number(p.id))||{}));
    if(!products.length)return res.status(400).json({error:'No hay productos para puntuar.'});
    const overallWinner=products.reduce((a,b)=>b.overallScore>a.overallScore?b:a);
    const metaWinner=products.reduce((a,b)=>(Number(b.metaScore)||0)>(Number(a.metaScore)||0)?b:a);
    const tiktokWinner=products.reduce((a,b)=>(Number(b.tiktokScore)||0)>(Number(a.tiktokScore)||0)?b:a);
    const out=Object.assign({},result,{products,overallWinner:{id:overallWinner.id,productName:overallWinner.productName},metaWinner:{id:metaWinner.id,productName:metaWinner.productName,metaScore:metaWinner.metaScore,platformReason:metaWinner.platformReason||''},tiktokWinner:{id:tiktokWinner.id,productName:tiktokWinner.productName,tiktokScore:tiktokWinner.tiktokScore,platformReason:tiktokWinner.platformReason||''},scoringMethodology:{version:'1.0',weights:{demand:.20,competitionOpportunity:.15,visual:.15,differentiation:.10,impulse:.10,economy:.20,bestPlatform:.10},qualitativeScale:'1-5 converted linearly to 0-100: (score-1)/4*100',economicFormula:'Adjusted margin percentage / 50% × 100, capped at 0-100',platformRule:'The higher of Meta Ads and TikTok Ads scores supplies the 10% platform component; ties favor Meta Ads.',winnerRule:'Highest deterministic overallScore wins.'}});
    return res.status(200).json(out);
  }catch(e){
    console.error('Recalculate error:',e);
    return res.status(500).json({error:e.message||'Error al recalcular.'});
  }
}
