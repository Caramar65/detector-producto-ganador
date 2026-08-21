module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido. Usa POST." });

  const startedAt = Date.now();
  const pad = n => String(n).padStart(2, "0");
  const d = new Date();
  const researchId = `INV-${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const researchVersion = "V3.9";
  const clamp = (n,min,max) => Math.min(max, Math.max(min, Number(n) || 0));

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: "OPENAI_API_KEY no está configurada en Vercel.", researchId, researchVersion });

    const input = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!input.length || input.length > 5) return res.status(400).json({ error: "Debes enviar entre 1 y 5 productos.", researchId, researchVersion });

    const products = input.map((p,i) => {
      const productName = String(p.productName || p.product || p.name || "").trim();
      const description = String(p.description || "").trim();
      const url = String(p.url || "").trim();
      const cost = Number(p.cost), shipping = Number(p.shipping || 0), otherCosts = Number(p.otherCosts || 0);
      const salePrice = Number(p.salePrice), returns = Number(p.returns || 0);
      if (!productName) throw Error(`Falta el nombre del producto ${i+1}.`);
      if (!Number.isFinite(cost) || cost <= 0) throw Error(`El costo del producto ${i+1} debe ser mayor que cero.`);
      if (!Number.isFinite(salePrice) || salePrice <= 0) throw Error(`El precio de venta del producto ${i+1} debe ser mayor que cero.`);
      if (!Number.isFinite(shipping) || shipping < 0) throw Error(`El envío del producto ${i+1} no es válido.`);
      if (!Number.isFinite(otherCosts) || otherCosts < 0) throw Error(`Los otros costos del producto ${i+1} no son válidos.`);
      if (!Number.isFinite(returns) || returns < 0 || returns > 100) throw Error(`Las devoluciones del producto ${i+1} deben estar entre 0 y 100.`);
      const margin = salePrice - cost - shipping - otherCosts;
      const marginPercent = salePrice ? margin / salePrice * 100 : 0;
      const maxCPA = Math.max(0, margin * (1 - returns / 100));
      const targetCPA = Math.max(0, maxCPA * 0.55);
      const breakEvenROAS = margin > 0 ? salePrice / margin : 0;
      return { id:Number(p.id)||i+1, productName, description, url, cost, shipping, otherCosts, salePrice, returns, margin, marginPercent, maxCPA, targetCPA, breakEvenROAS };
    });

    const block = products.map(p => `PRODUCTO ${p.id}: ${p.productName}\nDescripción: ${p.description || "No proporcionada"}\nURL PROPORCIONADA POR EL USUARIO: ${p.url || "No proporcionada"}\nCosto: ${p.cost} COP | Envío: ${p.shipping} COP | Otros: ${p.otherCosts} COP | Venta: ${p.salePrice} COP | Devoluciones: ${p.returns}%\nMargen servidor: ${p.margin.toFixed(0)} COP (${p.marginPercent.toFixed(2)}%) | CPA máximo: ${p.maxCPA.toFixed(0)} | CPA objetivo: ${p.targetCPA.toFixed(0)} | ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}x`).join("\n\n");

    const short = { type:"string", maxLength:700 };
    const tiny = { type:"string", maxLength:320 };
    const list3 = { type:"array", maxItems:3, items:tiny };
    const evidenceItem = {
      type:"object", additionalProperties:false,
      properties:{
        claim:short,
        type:{type:"string",enum:["verified","inference","recommendation"]},
        evidence:short,
        sourceUrls:{type:"array",maxItems:3,items:{type:"string",maxLength:600}}
      },
      required:["claim","type","evidence","sourceUrls"]
    };
    const sourceItem = {
      type:"object", additionalProperties:false,
      properties:{title:tiny,url:{type:"string",maxLength:600},type:tiny,supports:short,note:short},
      required:["title","url","type","supports","note"]
    };
    const productSchema = {
      type:"object", additionalProperties:false,
      properties:{
        id:{type:"integer"},productName:short,overallScore:{type:"number"},priority:tiny,verdict:short,confidence:{type:"number"},
        recommendedPlatform:tiny,platformReason:short,finalReason:short,summary:short,
        demand:{type:"integer"},competitionOpportunity:{type:"integer"},visual:{type:"integer"},differentiation:{type:"integer"},impulse:{type:"integer"},
        economicScore:{type:"number"},metaScore:{type:"number"},tiktokScore:{type:"number"},
        margin:{type:"number"},marginPercent:{type:"number"},maxCPA:{type:"number"},targetCPA:{type:"number"},breakEvenROAS:{type:"number"},
        strengths:list3,weaknesses:list3,risks:list3,angles:list3,testPlan:list3,evidence:{type:"array",minItems:2,maxItems:4,items:evidenceItem}
      },
      required:["id","productName","overallScore","priority","verdict","confidence","recommendedPlatform","platformReason","finalReason","summary","demand","competitionOpportunity","visual","differentiation","impulse","economicScore","metaScore","tiktokScore","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan","evidence"]
    };
    const winnerSchema = {
      type:"object",additionalProperties:false,
      properties:{id:{type:"integer"},productName:short,overallScore:{type:"number"},priority:tiny,recommendedPlatform:tiny,platformReason:short,finalReason:short,summary:short,margin:{type:"number"},marginPercent:{type:"number"},maxCPA:{type:"number"},targetCPA:{type:"number"},breakEvenROAS:{type:"number"},strengths:list3,weaknesses:list3,risks:list3,angles:list3,testPlan:list3},
      required:["id","productName","overallScore","priority","recommendedPlatform","platformReason","finalReason","summary","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan"]
    };
    const schema = {
      type:"object",additionalProperties:false,
      properties:{
        products:{type:"array",minItems:1,maxItems:5,items:productSchema},
        overallWinner:winnerSchema,
        metaWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:short,metaScore:{type:"number"},platformReason:short},required:["id","productName","metaScore","platformReason"]},
        tiktokWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:short,tiktokScore:{type:"number"},platformReason:short},required:["id","productName","tiktokScore","platformReason"]},
        recommendation:short,
        researchNotes:{type:"array",maxItems:15,items:short},
        sources:{type:"array",maxItems:20,items:sourceItem}
      },
      required:["products","overallWinner","metaWinner","tiktokWinner","recommendation","researchNotes","sources"]
    };

    const prompt = `Eres un analista profesional de ecommerce, dropshipping y publicidad digital para Colombia.

OBJETIVO: compara TODOS los productos recibidos y determina ganador general, ganador Meta Ads y ganador TikTok Ads. La decisión debe ser útil para saber qué producto probar primero.

INVESTIGACIÓN WEB: usa búsqueda web actual y relevante. Para cada producto prioriza hasta 2 búsquedas de alta calidad: una fuente oficial/regulatoria cuando aplique y una fuente de mercado/oferta. No hagas búsquedas redundantes. Si una afirmación no puede verificarse, declárala como inferencia o recomendación.

TRAZABILIDAD OBLIGATORIA: cada producto debe tener 2-4 elementos en evidence. Cada elemento incluye claim, type, evidence y sourceUrls. 'verified' significa respaldado por una fuente; 'inference' es conclusión razonada; 'recommendation' es acción sugerida. sourceUrls contiene SOLO URLs reales encontradas en la búsqueda web o proporcionadas por el usuario. No inventes URLs.

FUENTES: sources debe reutilizar las URLs de evidence y explicar qué respalda cada una. La URL del usuario sirve para verificar precio, presentación, características u oferta, pero NO demuestra por sí sola demanda de mercado. No inventes ventas, CTR, CPA históricos, ROAS históricos, volumen de búsquedas, cuotas de mercado ni cifras de mercado.

SALUD Y CUMPLIMIENTO: evita afirmaciones clínicas, terapéuticas o de curación no verificadas. Identifica riesgos de publicidad, etiquetado, registro sanitario y políticas de plataforma cuando correspondan. Usa lenguaje de bienestar cuando la evidencia no permita una afirmación médica.

CRITERIOS: demand, competitionOpportunity, visual, differentiation e impulse de 1-5. 5 es mejor. economicScore, metaScore, tiktokScore y overallScore de 0-100. Ponderación general: demanda 20%, competencia 15%, visual 15%, diferenciación 10%, impulso 10%, economía 20%, mejor plataforma 10%. 80-100 prioritario; 70-79 vale la pena testear; 60-69 test con precaución; 50-59 débil; 0-49 no prioritario.

ECONOMÍA: usa EXACTAMENTE los valores del servidor para margin, marginPercent, maxCPA, targetCPA y breakEvenROAS.

FORMATO: strengths, weaknesses, risks, angles y testPlan máximo 3 elementos cada uno. Ajusta estrictamente al JSON Schema. Sin markdown y sin texto fuera del JSON.

PRODUCTOS:\n${block}`;

    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(Number(process.env.RESEARCH_TIMEOUT_MS || 55000),30000),59000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
        body:JSON.stringify({
          model:process.env.OPENAI_MODEL || "gpt-5.4-mini",
          tools:[{type:"web_search",search_context_size:"low"}],
          input:prompt,
          max_output_tokens:12000,
          reasoning:{effort:"low"},
          text:{verbosity:"low",format:{type:"json_schema",name:"product_comparison_traceable_v39",strict:true,schema}}
        }),
        signal:controller.signal
      });
    } catch(fetchError) {
      if(fetchError?.name === "AbortError") return res.status(504).json({error:"La investigación superó el tiempo disponible. Vuelve a intentarlo; la consulta está optimizada para 1–5 productos.",researchId,researchVersion});
      throw fetchError;
    } finally { clearTimeout(timeout); }

    const raw = await response.text();
    if(!response.ok){
      let apiError={}; try{apiError=JSON.parse(raw);}catch{}
      console.error("OpenAI error:",raw.slice(0,4000));
      return res.status(502).json({error:"OpenAI devolvió un error.",status:response.status,details:apiError?.error?.message||raw.slice(0,1500),researchId,researchVersion});
    }

    let apiData;
    try{apiData=JSON.parse(raw);}catch{return res.status(502).json({error:"OpenAI devolvió una respuesta inesperada.",researchId,researchVersion});}
    if(apiData?.incomplete_details?.reason === "max_output_tokens") return res.status(502).json({error:"La investigación produjo una respuesta demasiado extensa. Vuelve a intentarlo.",researchId,researchVersion});

    const webCitations=[]; const seenUrls=new Set();
    const addCitation=(url,title="")=>{const clean=String(url||"").trim();if(!/^https?:\/\//i.test(clean)||seenUrls.has(clean))return;seenUrls.add(clean);webCitations.push({title:String(title||clean).trim(),url:clean});};
    const walk=value=>{if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(walk);return;}if(value.type==="url_citation"||value.type==="url_citation_detail")addCitation(value.url,value.title||value.name||"");Object.values(value).forEach(walk);};
    walk(apiData.output);

    let text=typeof apiData.output_text === "string" ? apiData.output_text : "";
    if(!text && Array.isArray(apiData.output)) for(const item of apiData.output) for(const content of item.content||[]) if(typeof content?.text === "string") text += content.text;
    text=String(text).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    if(!text) return res.status(502).json({error:"OpenAI no devolvió contenido de análisis.",researchId,researchVersion});

    let result;
    try{result=JSON.parse(text);}catch(parseError){
      console.error("JSON parse error:",parseError);
      console.error("OpenAI text:",text.slice(0,5000));
      return res.status(502).json({error:"La IA no devolvió JSON válido.",researchId,researchVersion,details:text.slice(0,2500)});
    }

    const byId=new Map(products.map(p=>[p.id,p]));
    result.products=(Array.isArray(result.products)?result.products:[]).map((r,i)=>{
      const original=byId.get(Number(r.id))||products[i];
      if(!original) return null;
      return {
        ...r,
        id:original.id,
        productName:String(r.productName||original.productName),
        overallScore:clamp(r.overallScore,0,100),
        demand:Math.round(clamp(r.demand,1,5)),
        competitionOpportunity:Math.round(clamp(r.competitionOpportunity,1,5)),
        visual:Math.round(clamp(r.visual,1,5)),
        differentiation:Math.round(clamp(r.differentiation,1,5)),
        impulse:Math.round(clamp(r.impulse,1,5)),
        economicScore:clamp(r.economicScore,0,100),
        metaScore:clamp(r.metaScore,0,100),
        tiktokScore:clamp(r.tiktokScore,0,100),
        confidence:clamp(r.confidence,0,100),
        margin:original.margin,
        marginPercent:original.marginPercent,
        maxCPA:original.maxCPA,
        targetCPA:original.targetCPA,
        breakEvenROAS:original.breakEvenROAS,
        strengths:Array.isArray(r.strengths)?r.strengths.slice(0,3):[],
        weaknesses:Array.isArray(r.weaknesses)?r.weaknesses.slice(0,3):[],
        risks:Array.isArray(r.risks)?r.risks.slice(0,3):[],
        angles:Array.isArray(r.angles)?r.angles.slice(0,3):[],
        testPlan:Array.isArray(r.testPlan)?r.testPlan.slice(0,3):[],
        evidence:Array.isArray(r.evidence)?r.evidence.slice(0,4):[]
      };
    }).filter(Boolean);

    if(!result.products.length) return res.status(502).json({error:"La investigación no devolvió productos analizables.",researchId,researchVersion});

    const sorted=result.products.slice().sort((a,b)=>b.overallScore-a.overallScore);
    const meta=result.products.slice().sort((a,b)=>b.metaScore-a.metaScore)[0];
    const tik=result.products.slice().sort((a,b)=>b.tiktokScore-a.tiktokScore)[0];
    const winner=sorted[0];
    result.overallWinner={...winner};
    result.metaWinner=meta?{id:meta.id,productName:meta.productName,metaScore:meta.metaScore,platformReason:meta.platformReason||""}:null;
    result.tiktokWinner=tik?{id:tik.id,productName:tik.productName,tiktokScore:tik.tiktokScore,platformReason:tik.platformReason||""}:null;

    const sourceMap=new Map();
    const addSource=s=>{
      const url=String(s?.url||"").trim();
      if(!/^https?:\/\//i.test(url)||sourceMap.has(url)) return;
      sourceMap.set(url,{title:String(s?.title||url).trim(),url,type:String(s?.type||"web_search").trim(),supports:String(s?.supports||"").trim(),note:String(s?.note||"").trim()});
    };
    webCitations.forEach(c=>addSource({title:c.title,url:c.url,type:"web_search",supports:"Fuente capturada directamente de una cita de búsqueda web.",note:"URL capturada por la investigación web."}));
    (Array.isArray(result.sources)?result.sources:[]).forEach(addSource);
    products.forEach(p=>{if(/^https?:\/\//i.test(p.url)) addSource({title:`${p.productName} — URL proporcionada por el usuario`,url:p.url,type:"user_provided",supports:"Verificación de producto, precio, presentación, características u oferta.",note:"Fuente proporcionada por el usuario; no demuestra por sí sola demanda de mercado."});});
    result.sources=Array.from(sourceMap.values()).slice(0,25);

    const sourceByUrl=new Map(result.sources.map(s=>[s.url,s]));
    const traceNotes=[];
    for(const product of result.products){
      for(const ev of product.evidence||[]){
        const claim=String(ev?.claim||"").trim();
        const evidence=String(ev?.evidence||"").trim();
        const type=String(ev?.type||"inference").trim();
        if(!claim||!evidence) continue;
        const names=(Array.isArray(ev?.sourceUrls)?ev.sourceUrls:[]).map(u=>sourceByUrl.get(String(u).trim())).filter(Boolean).map(s=>s.title);
        traceNotes.push(`${product.productName} — [${type}] ${claim}: ${evidence}${names.length?` Fuente: ${names.join("; ")}.`:""}`);
      }
    }
    const originalNotes=Array.isArray(result.researchNotes)?result.researchNotes.map(String).filter(Boolean):[];
    result.researchNotes=[...traceNotes,...originalNotes].slice(0,50);

    result.researchId=researchId;
    result.researchVersion=researchVersion;
    result.generatedAt=new Date().toISOString();
    result.traceability={enabled:true,verifiedSourceCount:result.sources.length,evidenceCount:result.products.reduce((n,p)=>n+(Array.isArray(p.evidence)?p.evidence.length:0),0),webCitationCount:webCitations.length,rule:"Las afirmaciones verificables deben poder asociarse a evidencia y a una fuente real; las inferencias y recomendaciones se identifican como tales."};
    result.performance={productCount:products.length,durationMs:Date.now()-startedAt};

    return res.status(200).json(result);
  } catch(error){
    console.error("Research API error:",error);
    return res.status(500).json({error:error?.message||"Error interno del servidor.",researchId,researchVersion});
  }
};
