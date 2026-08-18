export default async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");

  if(req.method!=="POST"){
    return res.status(405).json({error:"Usa POST."});
  }

  try{
    const key=process.env.OPENAI_API_KEY;
    if(!key){
      return res.status(500).json({error:"OPENAI_API_KEY no está configurada en Vercel."});
    }

    const input=req.body?.products;
    if(!Array.isArray(input)||input.length<1||input.length>5){
      return res.status(400).json({error:"Debes enviar entre 1 y 5 productos."});
    }

    const products=input.map((p,i)=>{
      const name=String(p.productName||p.product||p.name||"").trim();
      const description=String(p.description||"").trim();
      const url=String(p.url||"").trim();
      const cost=Number(p.cost);
      const shipping=Number(p.shipping||0);
      const otherCosts=Number(p.otherCosts||0);
      const salePrice=Number(p.salePrice);
      const returns=Number(p.returns||0);

      if(!name) throw Error(`Falta el nombre del producto ${i+1}.`);
      if(!Number.isFinite(cost)||cost<=0) throw Error(`Costo inválido en producto ${i+1}.`);
      if(!Number.isFinite(salePrice)||salePrice<=0) throw Error(`Precio inválido en producto ${i+1}.`);

      const margin=salePrice-cost-shipping-otherCosts;
      const adjustedMargin=Math.max(0,margin*(1-returns/100));

      return {
        id:Number(p.id)||i+1,
        productName:name,
        description,
        url,
        cost,
        shipping:Number.isFinite(shipping)?shipping:0,
        otherCosts:Number.isFinite(otherCosts)?otherCosts:0,
        salePrice,
        returns:Number.isFinite(returns)?returns:0,
        margin,
        marginPercent:salePrice?margin/salePrice*100:0,
        maxCPA:adjustedMargin,
        targetCPA:adjustedMargin*.55,
        breakEvenROAS:margin>0?salePrice/margin:0
      };
    });

    const info=products.map(p=>`PRODUCTO ${p.id}: ${p.productName}
Descripción: ${p.description||"N/D"}
URL proporcionada por el usuario: ${p.url||"N/D"}
Costo: ${p.cost} COP | Envío: ${p.shipping} COP | Otros: ${p.otherCosts} | Precio: ${p.salePrice} | Devoluciones: ${p.returns}% | Margen: ${p.margin} (${p.marginPercent.toFixed(1)}%) | CPA máximo: ${p.maxCPA.toFixed(0)} | CPA objetivo: ${p.targetCPA.toFixed(0)} | ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}x`).join("\n\n");

    const evidenceItem={
      type:"object",
      additionalProperties:false,
      properties:{
        claim:{type:"string"},
        evidence:{type:"string"},
        sourceUrl:{type:"string"},
        sourceTitle:{type:"string"}
      },
      required:["claim","evidence","sourceUrl","sourceTitle"]
    };

    const productSchema={
      type:"object",
      additionalProperties:false,
      properties:{
        id:{type:"integer"},
        productName:{type:"string"},
        overallScore:{type:"number"},
        demand:{type:"integer"},
        competitionOpportunity:{type:"integer"},
        visual:{type:"integer"},
        differentiation:{type:"integer"},
        impulse:{type:"integer"},
        economicScore:{type:"number"},
        metaScore:{type:"number"},
        tiktokScore:{type:"number"},
        recommendedPlatform:{type:"string"},
        priority:{type:"string"},
        verdict:{type:"string"},
        summary:{type:"string"},
        finalReason:{type:"string"},
        platformReason:{type:"string"},
        margin:{type:"number"},
        marginPercent:{type:"number"},
        maxCPA:{type:"number"},
        targetCPA:{type:"number"},
        breakEvenROAS:{type:"number"},
        strengths:{type:"array",items:{type:"string"}},
        weaknesses:{type:"array",items:{type:"string"}},
        risks:{type:"array",items:{type:"string"}},
        angles:{type:"array",items:{type:"string"}},
        testPlan:{type:"array",items:{type:"string"}},
        evidence:{type:"array",items:evidenceItem}
      },
      required:["id","productName","overallScore","demand","competitionOpportunity","visual","differentiation","impulse","economicScore","metaScore","tiktokScore","recommendedPlatform","priority","verdict","summary","finalReason","platformReason","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan","evidence"]
    };

    const schema={
      type:"object",
      additionalProperties:false,
      properties:{
        products:{type:"array",minItems:1,maxItems:5,items:productSchema},
        overallWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
        metaWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
        tiktokWinner:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},productName:{type:"string"}},required:["id","productName"]},
        recommendation:{type:"string"},
        researchNotes:{type:"array",items:{type:"string"}},
        sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"},note:{type:"string"}},required:["title","url","note"]}}
      },
      required:["products","overallWinner","metaWinner","tiktokWinner","recommendation","researchNotes","sources"]
    };

    const prompt=`Eres un analista profesional de ecommerce, dropshipping y publicidad digital para Colombia.

Compara TODOS los productos recibidos usando exactamente los mismos criterios. Debes determinar ganador general, ganador Meta Ads y ganador TikTok Ads.

INVESTIGACIÓN WEB OBLIGATORIA: usa búsqueda web actual cuando sea posible. Investiga demanda/interés, competencia, precios y ofertas, contenido/anuncios, potencial visual, diferenciación, compra por impulso y riesgos. Para salud, suplementos y dispositivos, revisa fuentes oficiales y políticas publicitarias cuando correspondan, especialmente INVIMA, Meta y TikTok.

REGLA CENTRAL DE TRAZABILIDAD:
Cada afirmación importante de investigación debe tener evidencia concreta y una fuente verificable. En "evidence" escribe de 4 a 10 elementos por producto. Cada elemento debe contener:
- claim: qué afirmación se está haciendo.
- evidence: qué encontraste que sustenta esa afirmación; separa hechos verificables de inferencias.
- sourceUrl: URL REAL obtenida de la búsqueda web o una URL proporcionada por el usuario. NO inventes URLs.
- sourceTitle: nombre corto de la fuente.

No conviertas una inferencia en un hecho. Si algo no pudo verificarse, dilo claramente en evidence. No inventes ventas, volumen de búsqueda, CTR, CPA históricos, cuotas de mercado ni cifras de mercado.

FUENTES: incluye solo URLs reales obtenidas de la búsqueda o URLs proporcionadas por el usuario. Deduplica fuentes cuando sea posible. Cada fuente debe tener title, url y note explicando qué parte de la investigación respalda. Las URLs del usuario pueden utilizarse para verificar características, precio, presentación y oferta, pero no deben presentarse como evidencia independiente de demanda de mercado.

RESEARCH NOTES: además de las notas generales, cada nota que dependa de investigación debe terminar con "Fuente: <título o títulos>". Esto permite que el informe visible sea trazable incluso antes de una futura interfaz de evidencia más avanzada.

Puntuaciones: demanda 1-5 (5 fuerte); competitionOpportunity 1-5 (5=oportunidad competitiva favorable); visual 1-5; differentiation 1-5; impulse 1-5. EconomicScore, metaScore y tiktokScore de 0-100.
OverallScore: 20% demanda + 15% oportunidad competitiva + 15% visual + 10% diferenciación + 10% impulso + 20% economía + 10% mejor plataforma.
80-100 PRODUCTO PRIORITARIO; 70-79 VALE LA PENA TESTEAR; 60-69 TEST CON PRECAUCIÓN; 50-59 PRODUCTO DÉBIL; 0-49 NO PRIORITARIO.
El overallWinner debe ser el mayor overallScore; metaWinner el mayor metaScore; tiktokWinner el mayor tiktokScore.
Devuelve únicamente el JSON del esquema. No agregues markdown.

DATOS DE LOS PRODUCTOS:
${info}`;

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),55000);

    let response;
    try{
      response=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+key
        },
        body:JSON.stringify({
          model:process.env.OPENAI_MODEL||"gpt-5",
          tools:[{type:"web_search"}],
          input:prompt,
          text:{
            format:{
              type:"json_schema",
              name:"product_comparison_traceable",
              strict:true,
              schema
            }
          }
        }),
        signal:controller.signal
      });
    }catch(fetchError){
      if(fetchError?.name==="AbortError"){
        return res.status(504).json({error:"La investigación tardó demasiado. Intenta nuevamente con menos productos o vuelve a intentarlo en unos segundos."});
      }
      throw fetchError;
    }finally{
      clearTimeout(timeout);
    }

    const raw=await response.text();

    if(!response.ok){
      let apiError={};
      try{apiError=JSON.parse(raw)}catch{}
      console.error("OpenAI error:",raw.slice(0,3000));
      return res.status(502).json({
        error:"OpenAI devolvió un error.",
        status:response.status,
        details:apiError?.error?.message||raw.slice(0,1200)
      });
    }

    let apiResult;
    try{
      apiResult=JSON.parse(raw);
    }catch{
      return res.status(502).json({error:"OpenAI respondió con formato inesperado."});
    }

    let text=typeof apiResult.output_text==="string"?apiResult.output_text:"";

    if(!text&&Array.isArray(apiResult.output)){
      for(const item of apiResult.output){
        if(Array.isArray(item.content)){
          for(const content of item.content){
            if(typeof content.text==="string") text+=content.text;
          }
        }
      }
    }

    if(!text){
      return res.status(502).json({error:"OpenAI no devolvió contenido utilizable."});
    }

    let data;
    try{
      data=JSON.parse(text);
    }catch{
      console.error("Invalid structured output:",text.slice(0,3000));
      return res.status(502).json({error:"OpenAI no devolvió JSON válido."});
    }

    const byId=new Map(products.map(p=>[p.id,p]));

    data.products=(Array.isArray(data.products)?data.products:[]).map((x,index)=>{
      const original=byId.get(Number(x.id))||products[index];
      return {
        ...x,
        id:original.id,
        productName:x.productName||original.productName,
        margin:original.margin,
        marginPercent:original.marginPercent,
        maxCPA:original.maxCPA,
        targetCPA:original.targetCPA,
        breakEvenROAS:original.breakEvenROAS
      };
    });

    const scored=new Map(data.products.map(p=>[Number(p.id),p]));
    const first=data.products[0]||null;

    data.overallWinner=scored.get(Number(data.overallWinner?.id))||first;
    data.metaWinner=scored.get(Number(data.metaWinner?.id))||first;
    data.tiktokWinner=scored.get(Number(data.tiktokWinner?.id))||first;

    /*
      Normalizamos y validamos las fuentes.
      Solo dejamos URLs HTTP/HTTPS reales y eliminamos duplicados.
    */
    const sourceMap=new Map();

    for(const p of products){
      if(/^https?:\/\//i.test(p.url)){
        sourceMap.set(p.url,{
          title:`Producto ${p.productName} — URL proporcionada por el usuario`,
          url:p.url,
          note:"Fuente proporcionada por el usuario. Útil para verificar presentación, precio, características y oferta; no constituye por sí sola evidencia de demanda de mercado."
        });
      }
    }

    if(Array.isArray(data.sources)){
      for(const s of data.sources){
        const url=String(s?.url||"").trim();
        if(!/^https?:\/\//i.test(url)) continue;
        if(!sourceMap.has(url)){
          sourceMap.set(url,{
            title:String(s?.title||"Fuente web").trim(),
            url,
            note:String(s?.note||"Fuente utilizada durante la investigación web.").trim()
          });
        }
      }
    }

    data.sources=Array.from(sourceMap.values()).slice(0,25);

    /*
      Convertimos la evidencia estructurada en notas visibles.
      Así la versión actual de index.html puede mostrar trazabilidad
      sin necesidad de modificar el render principal.
    */
    const traceNotes=[];

    for(const p of data.products){
      if(!Array.isArray(p.evidence)) continue;

      for(const ev of p.evidence.slice(0,10)){
        const claim=String(ev?.claim||"").trim();
        const evidence=String(ev?.evidence||"").trim();
        const url=String(ev?.sourceUrl||"").trim();
        const title=String(ev?.sourceTitle||"").trim();

        if(!claim||!evidence) continue;

        if(/^https?:\/\//i.test(url)){
          const source=sourceMap.get(url);
          const sourceLabel=source?.title||title||url;
          traceNotes.push(`${p.productName} — ${claim}: ${evidence} Fuente: ${sourceLabel}.`);
        }else if(title){
          traceNotes.push(`${p.productName} — ${claim}: ${evidence} Fuente: ${title}.`);
        }else{
          traceNotes.push(`${p.productName} — ${claim}: ${evidence}`);
        }
      }
    }

    const existingNotes=Array.isArray(data.researchNotes)?data.researchNotes.map(x=>String(x)).filter(Boolean):[];
    data.researchNotes=[...traceNotes,...existingNotes].slice(0,45);

    /*
      Mantener evidence en la respuesta también permite que futuras
      versiones del frontend presenten una matriz de evidencia sin
      volver a tocar el motor de investigación.
    */
    data.traceability={
      enabled:true,
      verifiedSourceCount:data.sources.length,
      evidenceCount:data.products.reduce((n,p)=>n+(Array.isArray(p.evidence)?p.evidence.length:0),0),
      rule:"Cada afirmación de investigación debe poder asociarse a evidencia y a una fuente verificable cuando exista."
    };

    return res.status(200).json(data);

  }catch(e){
    console.error("Research API error:",e);
    return res.status(500).json({error:e.message||"Error interno."});
  }
}
