function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0));}
function qualitative(v){const n=Number(v);if(!Number.isFinite(n))return 0;return clamp((n-1)/4*100);}
function economics(input){
  const sale=Number(input?.salePrice),cost=Number(input?.cost),shipping=Number(input?.shipping||0),other=Number(input?.otherCosts||0),returns=clamp(Number(input?.returns??0),0,100);
  if(!(sale>0)||!(cost>=0)||!(shipping>=0)||!(other>=0))return {margin:0,adjustedMargin:0,adjustedMarginPercent:0,maxCPA:0,targetCPA:0,breakEvenROAS:0};
  const margin=sale-cost-shipping-other;
  const adjustedMargin=margin*(1-returns/100);
  const adjustedMarginPercent=sale>0?adjustedMargin/sale*100:0;
  return {margin,adjustedMargin,adjustedMarginPercent,maxCPA:Math.max(0,adjustedMargin),targetCPA:Math.max(0,adjustedMargin)*.55,breakEvenROAS:adjustedMargin>0?sale/adjustedMargin:0};
}
function scoreProduct(p,input,monthlyBudget,count){
  const e=economics(input||{});
  const budgetPerProduct=count>0?monthlyBudget/count:monthlyBudget;
  const testCapacity=e.targetCPA>0?Math.floor(budgetPerProduct/e.targetCPA):0;
  const marginComponent=clamp(e.adjustedMarginPercent/50*100);
  const budgetComponent=clamp(testCapacity/20*100);
  const economicScore=marginComponent*.65+budgetComponent*.35;
  const demand=qualitative(p.demand),competition=qualitative(p.competitionOpportunity),visual=qualitative(p.visual),differentiation=qualitative(p.differentiation),impulse=qualitative(p.impulse);
  const meta=clamp(p.metaScore),tiktok=clamp(p.tiktokScore),bestPlatform=Math.max(meta,tiktok);
  const riskScore=clamp(p.riskScore??50);
  const overall=demand*.15+competition*.10+visual*.05+differentiation*.10+impulse*.05+economicScore*.35+riskScore*.10+bestPlatform*.10;
  const platform=meta>=tiktok?'Meta Ads':'TikTok Ads';
  const feasibilityVerdict=overall>=80?'FACTIBILIDAD ALTA':overall>=70?'FACTIBILIDAD BUENA PARA TEST':overall>=60?'TEST CON PRECAUCIÓN':overall>=50?'FACTIBILIDAD DÉBIL':'NO PRIORITARIO';
  return Object.assign({},p,e,{economicScore:Number(economicScore.toFixed(1)),overallScore:Number(overall.toFixed(1)),recommendedPlatform:platform,feasibilityScore:Number(overall.toFixed(1)),feasibilityVerdict,budgetPerProduct,testCapacity});
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({error:'Usa POST.'});
  try{
    const body=req.body||{},result=body.result,inputs=Array.isArray(body.products)?body.products:[];
    const settings=body.result?.settings||body.settings||{};
    const monthlyBudget=Math.max(0,Number(settings.monthlyBudget||500000));
    if(!result||!Array.isArray(result.products))return res.status(400).json({error:'Faltan los resultados de investigación.'});
    const inputMap=new Map(inputs.map(x=>[Number(x.id),x]));
    const products=result.products.map(p=>scoreProduct(p,inputMap.get(Number(p.id))||{},monthlyBudget,inputs.length||result.products.length));
    if(!products.length)return res.status(400).json({error:'No hay productos para puntuar.'});
    const overallWinner=products.reduce((a,b)=>b.overallScore>a.overallScore?b:a);
    const metaWinner=products.reduce((a,b)=>(Number(b.metaScore)||0)>(Number(a.metaScore)||0)?b:a);
    const tiktokWinner=products.reduce((a,b)=>(Number(b.tiktokScore)||0)>(Number(a.tiktokScore)||0)?b:a);
    const out=Object.assign({},result,{products,overallWinner,metaWinner:{id:metaWinner.id,productName:metaWinner.productName,metaScore:metaWinner.metaScore,platformReason:metaWinner.platformReason||''},tiktokWinner:{id:tiktokWinner.id,productName:tiktokWinner.productName,tiktokScore:tiktokWinner.tiktokScore,platformReason:tiktokWinner.platformReason||''},scoringMethodology:{version:'4.0',weights:{demand:.15,competitionOpportunity:.10,visual:.05,differentiation:.10,impulse:.05,economy:.35,risk:.10,bestPlatform:.10},qualitativeScale:'1-5 converted linearly to 0-100: (score-1)/4*100',economicFormula:'Adjusted margin percentage plus test capacity under the user budget: margin component 65%, budget capacity component 35%; adjusted margin = margin × (1 - returns%). CPA maximum = adjusted margin; target CPA = 55% of maximum.',platformRule:'The higher of Meta Ads and TikTok Ads supplies the 10% platform component; ties favor Meta Ads.',winnerRule:'Highest deterministic feasibility score wins.',principle:'Demand and advertising activity are evidence of market interest, not proof of profitability.'}});
    return res.status(200).json(out);
  }catch(e){console.error('Recalculate error:',e);return res.status(500).json({error:e.message||'Error al recalcular.'});}
}