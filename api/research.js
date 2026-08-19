module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: "OPENAI_API_KEY no está configurada en Vercel." });

    const input = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!input.length || input.length > 5) return res.status(400).json({ error: "Debes enviar entre 1 y 5 productos." });

    const products = input.map((p, i) => {
      const productName = String(p.productName || p.product || p.name || "").trim();
      const description = String(p.description || "").trim();
      const url = String(p.url || "").trim();
      const cost = Number(p.cost);
      const shipping = Number(p.shipping || 0);
      const otherCosts = Number(p.otherCosts || 0);
      const salePrice = Number(p.salePrice);
      const returns = Number(p.returns || 0);
      if (!productName) throw new Error(`Falta el nombre del producto ${i + 1}.`);
      if (!Number.isFinite(cost) || cost <= 0) throw new Error(`El costo del producto ${i + 1} debe ser mayor que cero.`);
      if (!Number.isFinite(salePrice) || salePrice <= 0) throw new Error(`El precio de venta del producto ${i + 1} debe ser mayor que cero.`);
      if (!Number.isFinite(shipping) || shipping < 0) throw new Error(`El envío del producto ${i + 1} no es válido.`);
      if (!Number.isFinite(otherCosts) || otherCosts < 0) throw new Error(`Los otros costos del producto ${i + 1} no son válidos.`);
      if (!Number.isFinite(returns) || returns < 0 || returns > 100) throw new Error(`Las devoluciones del producto ${i + 1} deben estar entre 0 y 100.`);
      const margin = salePrice - cost - shipping - otherCosts;
      const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;
      const maxCPA = Math.max(0, margin * (1 - returns / 100));
      const targetCPA = Math.max(0, maxCPA * 0.55);
      const breakEvenROAS = margin > 0 ? salePrice / margin : 0;
      return { id: Number(p.id) || i + 1, productName, description, url, cost, shipping, otherCosts, salePrice, returns, margin, marginPercent, maxCPA, targetCPA, breakEvenROAS };
    });

    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const researchId = `INV-${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const researchVersion = "V3.7";

    const block = products.map(p => `PRODUCTO ${p.id}: ${p.productName}\nDescripción: ${p.description || "No proporcionada"}\nURL PROPORCIONADA: ${p.url || "No proporcionada"}\nCosto: ${p.cost} COP | Envío: ${p.shipping} COP | Otros: ${p.otherCosts} COP | Venta: ${p.salePrice} COP | Devoluciones: ${p.returns}%\nMargen servidor: ${p.margin.toFixed(0)} COP (${p.marginPercent.toFixed(2)}%) | CPA máximo: ${p.maxCPA.toFixed(0)} | CPA objetivo: ${p.targetCPA.toFixed(0)} | ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}`).join("\n\n");

    const evidenceItem = {
      type: "object", additionalProperties: false,
      properties: {
        claim: { type: "string" }, type: { type: "string", enum: ["verified", "inference", "recommendation"] },
        evidence: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } }
      },
      required: ["claim", "type", "evidence", "sourceUrls"]
    };

    const sourceItem = {
      type: "object", additionalProperties: false,
      properties: { title: { type: "string" }, url: { type: "string" }, type: { type: "string" }, supports: { type: "string" }, note: { type: "string" } },
      required: ["title", "url", "type", "supports", "note"]
    };

    const productSchema = {
      type: "object", additionalProperties: false,
      properties: {
        id:{type:"integer"}, productName:{type:"string"}, overallScore:{type:"number"}, priority:{type:"string"}, verdict:{type:"string"}, confidence:{type:"number"},
        recommendedPlatform:{type:"string"}, platformReason:{type:"string"}, finalReason:{type:"string"}, summary:{type:"string"},
        demand:{type:"integer"}, competitionOpportunity:{type:"integer"}, visual:{type:"integer"}, differentiation:{type:"integer"}, impulse:{type:"integer"},
        economicScore:{type:"number"}, metaScore:{type:"number"}, tiktokScore:{type:"number"},
        margin:{type:"number"}, marginPercent:{type:"number"}, maxCPA:{type:"number"}, targetCPA:{type:"number"}, breakEvenROAS:{type:"number"},
        strengths:{type:"array",items:{type:"string"}}, weaknesses:{type:"array",items:{type:"string"}}, risks:{type:"array",items:{type:"string"}}, angles:{type:"array",items:{type:"string"}}, testPlan:{type:"array",items:{type:"string"}},
        evidence:{type:"array",minItems:3,maxItems:4,items:evidenceItem}
      },
      required:["id","productName","overallScore","priority","verdict","confidence","recommendedPlatform","platformReason","finalReason","summary","demand","competitionOpportunity","visual","differentiation","impulse","economicScore","metaScore","tiktokScore","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan","evidence"]
    };

    const winnerSchema = {
      type:"object", additionalProperties:false,
      properties:{ id:{type:"integer"},productName:{type:"string"},overallScore:{type:"number"},priority:{type:"string"},recommendedPlatform:{type:"string"},platformReason:{type:"string"},finalReason:{type:"string"},summary:{type:"string"},margin:{type:"number"},marginPercent:{type:"number"},maxCPA:{type:"number"},targetCPA:{type:"number"},breakEvenROAS:{type:"number"},strengths:{type:"array",items:{type:"string"}},weaknesses:{type:"array",items:{type:"string"}},risks:{type:"array",items:{type:"string"}},angles:{type:"array",items:{type:"string"}},testPlan:{type:"array",items:{type:"string"}} },
      required:["id","productName","overallScore","priority","recommendedPlatform","platformReason","finalReason","summary","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan"]
    };

    const schema = {
      type:"object", additionalProperties:false,
      properties:{
        products:{type:"array",minItems:1,maxItems:5,items:productSchema}, overallWinner:winnerSchema,
        metaWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"},metaScore:{type:"number"},platformReason:{type:"string"}},required:["id","productName","metaScore","platformReason"]},
        tiktokWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"},tiktokScore:{type:"number"},platformReason:{type:"string"}},required:["id","productName","tiktokScore","platformReason"]},
        recommendation:{type:"string"},researchNotes:{type:"array",items:{type:"string"}},sources:{type:"array",items:sourceItem}
      },
      required:["products","overallWinner","metaWinner","tiktokWinner","recommendation","researchNotes","sources"]
    };

    const productCount = products.length;
    const prompt = `Analiza ecommerce y publicidad digital para Colombia. Compara ${productCount} producto(s) y decide ganador general, Meta Ads y TikTok Ads.

INVESTIGACIÓN WEB: obligatoria pero RÁPIDA. Haz como máximo 2 búsquedas web por producto y usa contexto bajo. Prioriza una fuente oficial/regulatoria si aplica y una fuente de mercado/oferta. No hagas búsquedas redundantes. Si la evidencia no existe, declara la incertidumbre. La URL del usuario sirve para verificar el producto, precio o características, no para demostrar demanda.

TRAZABILIDAD: no inventes URLs, ventas, CTR, CPA históricos, ROAS históricos, volúmenes ni cifras de mercado. Cada producto debe tener 3-4 evidence: verified, inference o recommendation. sourceUrls solo puede usar URLs realmente encontradas o URLs proporcionadas por el usuario. sources debe contener esas mismas URLs con título, tipo, supports y note.

CRITERIOS: demand 0-5; competitionOpportunity 0-5; visual 0-5; differentiation 0-5; impulse 0-5; economicScore/metaScore/tiktokScore/overallScore 0-100. Ponderación general: demanda 20%, competencia 15%, visual 15%, diferenciación 10%, impulso 10%, economía 30%. 80+ prioritario; 70-79 testear; 60-69 precaución; 50-59 débil; <50 no prioritario.

ECONOMÍA: usa exactamente los valores calculados por servidor para margen, marginPercent, maxCPA, targetCPA y breakEvenROAS.

SALUD: evita afirmaciones clínicas no verificadas; usa lenguaje de bienestar y cumplimiento. strengths, weaknesses, risks, angles y testPlan: máximo 3 puntos útiles cada uno y frases compactas.

PRODUCTOS:
${block}

Devuelve únicamente JSON válido según el esquema. Sin markdown.`;

    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(Number(process.env.RESEARCH_TIMEOUT_MS || 55000), 30000), 59000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
        body:JSON.stringify({
          model:"gpt-5.4-mini",
          tools:[{type:"web_search",search_context_size:"low"}],
          input:prompt,
          max_output_tokens:7000,
          reasoning:{effort:"low"},
          text:{format:{type:"json_schema",name:"product_comparison_traceable_v37",strict:true,schema}}
        }),
        signal:controller.signal
      });
    } catch (fetchError) {
      if (fetchError?.name === "AbortError") return res.status(504).json({error:"La investigación superó el tiempo disponible. Se agotó el tiempo de la consulta web. Intenta nuevamente; si persiste incluso con 1 producto, revisaremos la infraestructura de ejecución.",researchId,researchVersion});
      throw fetchError;
    } finally { clearTimeout(timeout); }

    const raw = await response.text();
    if (!response.ok) {
      let apiError={}; try{apiError=JSON.parse(raw);}catch{}
      console.error("OpenAI error:",raw.slice(0,3000));
      return res.status(502).json({error:"OpenAI devolvió un error.",status:response.status,details:apiError?.error?.message||raw.slice(0,1200),researchId,researchVersion});
    }

    let apiData; try{apiData=JSON.parse(raw);}catch{return res.status(502).json({error:"OpenAI devolvió una respuesta inesperada.",researchId,researchVersion});}
    const webCitations=[]; const seenUrls=new Set();
    const addCitation=(url,title="")=>{const clean=String(url||"").trim();if(!/^https?:\/\//i.test(clean)||seenUrls.has(clean))return;seenUrls.add(clean);webCitations.push({title:String(title||clean).trim(),url:clean});};
    const walk=value=>{if(!value||typeof value!=="object")return;if(Array.isArray(value)){value.forEach(walk);return;}if(value.type==="url_citation"||value.type==="url_citation_detail")addCitation(value.url,value.title||value.name||"");for(const [key,child] of Object.entries(value))if(["annotations","content","output","url_citation"].includes(key))walk(child);};
    walk(apiData.output);

    let text=typeof apiData.output_text==="string"?apiData.output_text:"";
    if(!text&&Array.isArray(apiData.output))for(const item of apiData.output)for(const c of item.content||[])if(typeof c?.text==="string")text+=c.text;
    text=String(text).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    if(!text)return res.status(502).json({error:"OpenAI no devolvió contenido de análisis.",researchId,researchVersion});

    let result;
    try{result=JSON.parse(text);}catch(parseError){console.error("JSON parse error:",parseError);console.error("OpenAI text:",text.slice(0,5000));return res.status(502).json({error:"La IA no devolvió JSON válido.",researchId,researchVersion,details:text.slice(0,3000)});}

    result.products=(Array.isArray(result.products)?result.products:[]).map((r,i)=>{const original=products.find(p=>Number(p.id)===Number(r.id))||products[i];if(!original)return r;return {...r,id:original.id,productName:String(r.productName||original.productName),margin:original.margin,marginPercent:original.marginPercent,maxCPA:original.maxCPA,targetCPA:original.targetCPA,breakEvenROAS:original.breakEvenROAS,evidence:Array.isArray(r.evidence)?r.evidence:[]};});
    const sorted=result.products.slice().sort((a,b)=>(Number(b.overallScore)||0)-(Number(a.overallScore)||0));
    result.overallWinner=sorted[0]||null;
    const meta=result.products.slice().sort((a,b)=>(Number(b.metaScore)||0)-(Number(a.metaScore)||0))[0];
    const tik=result.products.slice().sort((a,b)=>(Number(b.tiktokScore)||0)-(Number(a.tiktokScore)||0))[0];
    result.metaWinner=meta?{id:meta.id,productName:meta.productName,metaScore:meta.metaScore,platformReason:meta.platformReason||""}:null;
    result.tiktokWinner=tik?{id:tik.id,productName:tik.productName,tiktokScore:tik.tiktokScore,platformReason:tik.platformReason||""}:null;

    const userSources=products.filter(p=>p.url&&/^https?:\/\//i.test(p.url)).map(p=>({title:`${p.productName} — URL proporcionada por el usuario`,url:p.url,type:"user_provided",supports:"Página proporcionada para el análisis del producto.",note:"Fuente proporcionada por el usuario; puede verificar precio, presentación y características, pero no demuestra por sí sola la demanda."}));
    const sourceMap=new Map();
    webCitations.forEach(c=>sourceMap.set(c.url,{title:c.title,url:c.url,type:"web_search",supports:"Fuente capturada directamente por búsqueda web.",note:"URL capturada de una cita de búsqueda web."}));
    (Array.isArray(result.sources)?result.sources:[]).forEach(s=>{const url=String(s?.url||"").trim();if(!/^https?:\/\//i.test(url)||sourceMap.has(url))return;sourceMap.set(url,{title:String(s.title||url),url,type:String(s.type||"other"),supports:String(s.supports||""),note:String(s.note||"Fuente declarada por el análisis.")});});
    userSources.forEach(s=>{if(!sourceMap.has(s.url))sourceMap.set(s.url,s);});
    result.sources=Array.from(sourceMap.values()).slice(0,20);
    const knownUrls=new Set(result.sources.map(s=>s.url));
    const typeLabel={verified:"DATO VERIFICABLE",inference:"INFERENCIA",recommendation:"RECOMENDACIÓN"};
    const evidenceNotes=[];
    result.products=result.products.map(p=>{const evidence=(Array.isArray(p.evidence)?p.evidence:[]).map(e=>{const sourceUrls=Array.isArray(e?.sourceUrls)?e.sourceUrls.map(u=>String(u).trim()).filter(u=>knownUrls.has(u)):[];const type=["verified","inference","recommendation"].includes(e?.type)?e.type:"inference";const clean={claim:String(e?.claim||"").trim(),type,evidence:String(e?.evidence||"").trim(),sourceUrls};if(clean.claim&&clean.evidence){const sourceTitles=sourceUrls.map(u=>sourceMap.get(u)?.title||u);const sourceText=sourceTitles.length?` Fuente: ${sourceTitles.join("; ")}.`:" Fuente: no verificada en una URL capturada.";evidenceNotes.push(`${p.productName} — ${typeLabel[type]}: ${clean.claim}. ${clean.evidence}.${sourceText}`);}return clean;});return {...p,evidence};});
    const existingNotes=Array.isArray(result.researchNotes)?result.researchNotes.map(x=>String(x).trim()).filter(Boolean):[];
    result.researchNotes=[...evidenceNotes,...existingNotes].slice(0,30);
    result.traceability={researchId,researchVersion,generatedAt:now.toISOString(),productsAnalyzed:products.length,webSearchUsed:true,webCitationsCaptured:webCitations.length,verifiedSourceCount:result.sources.length,evidenceCount:result.products.reduce((n,p)=>n+(Array.isArray(p.evidence)?p.evidence.length:0),0),sourcePolicy:"Solo se aceptan URLs capturadas de web_search o proporcionadas por el usuario; no se inventan URLs.",evidencePolicy:"Cada hallazgo se clasifica como dato verificable, inferencia o recomendación y conserva sus URLs asociadas cuando existen."};
    result.researchId=researchId; result.researchVersion=researchVersion;
    return res.status(200).json(result);
  } catch(e) {
    console.error("Research API error:",e);
    return res.status(500).json({error:e.message||"Error interno del servidor."});
  }
};