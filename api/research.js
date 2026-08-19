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
    const researchVersion = "V3.5";

    const block = products.map(p => `
PRODUCTO ${p.id}: ${p.productName}
Descripción: ${p.description || "No proporcionada"}
URL PROPORCIONADA POR EL USUARIO: ${p.url || "No proporcionada"}
Costo: ${p.cost} COP | Envío: ${p.shipping} COP | Otros: ${p.otherCosts} COP | Venta: ${p.salePrice} COP | Devoluciones: ${p.returns}%
Margen calculado por servidor: ${p.margin.toFixed(0)} COP (${p.marginPercent.toFixed(2)}%)
CPA máximo calculado por servidor: ${p.maxCPA.toFixed(0)} COP
CPA objetivo calculado por servidor: ${p.targetCPA.toFixed(0)} COP
ROAS de equilibrio calculado por servidor: ${p.breakEvenROAS.toFixed(2)}
`).join("\n");

    const evidenceItem = {
      type: "object",
      additionalProperties: false,
      properties: {
        claim: { type: "string" },
        type: { type: "string", enum: ["verified", "inference", "recommendation"] },
        evidence: { type: "string" },
        sourceUrls: { type: "array", items: { type: "string" } }
      },
      required: ["claim", "type", "evidence", "sourceUrls"]
    };

    const sourceItem = {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        type: { type: "string" },
        supports: { type: "string" },
        note: { type: "string" }
      },
      required: ["title", "url", "type", "supports", "note"]
    };

    const productSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "integer" }, productName: { type: "string" }, overallScore: { type: "number" }, priority: { type: "string" }, verdict: { type: "string" }, confidence: { type: "number" },
        recommendedPlatform: { type: "string" }, platformReason: { type: "string" }, finalReason: { type: "string" }, summary: { type: "string" },
        demand: { type: "integer" }, competitionOpportunity: { type: "integer" }, visual: { type: "integer" }, differentiation: { type: "integer" }, impulse: { type: "integer" },
        economicScore: { type: "number" }, metaScore: { type: "number" }, tiktokScore: { type: "number" },
        margin: { type: "number" }, marginPercent: { type: "number" }, maxCPA: { type: "number" }, targetCPA: { type: "number" }, breakEvenROAS: { type: "number" },
        strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, angles: { type: "array", items: { type: "string" } }, testPlan: { type: "array", items: { type: "string" } },
        evidence: { type: "array", minItems: 4, maxItems: 10, items: evidenceItem }
      },
      required: ["id","productName","overallScore","priority","verdict","confidence","recommendedPlatform","platformReason","finalReason","summary","demand","competitionOpportunity","visual","differentiation","impulse","economicScore","metaScore","tiktokScore","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan","evidence"]
    };

    const winnerSchema = {
      type: "object", additionalProperties: false,
      properties: {
        id: { type: "integer" }, productName: { type: "string" }, overallScore: { type: "number" }, priority: { type: "string" }, recommendedPlatform: { type: "string" }, platformReason: { type: "string" }, finalReason: { type: "string" }, summary: { type: "string" }, margin: { type: "number" }, marginPercent: { type: "number" }, maxCPA: { type: "number" }, targetCPA: { type: "number" }, breakEvenROAS: { type: "number" }, strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, angles: { type: "array", items: { type: "string" } }, testPlan: { type: "array", items: { type: "string" } }
      },
      required: ["id","productName","overallScore","priority","recommendedPlatform","platformReason","finalReason","summary","margin","marginPercent","maxCPA","targetCPA","breakEvenROAS","strengths","weaknesses","risks","angles","testPlan"]
    };

    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        products: { type: "array", minItems: 1, maxItems: 5, items: productSchema },
        overallWinner: winnerSchema,
        metaWinner: { type: "object", additionalProperties: false, properties: { id: { type: "integer" }, productName: { type: "string" }, metaScore: { type: "number" }, platformReason: { type: "string" } }, required: ["id","productName","metaScore","platformReason"] },
        tiktokWinner: { type: "object", additionalProperties: false, properties: { id: { type: "integer" }, productName: { type: "string" }, tiktokScore: { type: "number" }, platformReason: { type: "string" } }, required: ["id","productName","tiktokScore","platformReason"] },
        recommendation: { type: "string" }, researchNotes: { type: "array", items: { type: "string" } }, sources: { type: "array", items: sourceItem }
      },
      required: ["products","overallWinner","metaWinner","tiktokWinner","recommendation","researchNotes","sources"]
    };

    const prompt = `Eres un analista profesional de ecommerce, investigación de mercado y publicidad digital para Colombia.

OBJETIVO: Compara TODOS los productos recibidos, de 1 a 5, con exactamente los mismos criterios. Determina ganador general, ganador Meta Ads y ganador TikTok Ads.

INVESTIGACIÓN WEB OBLIGATORIA: usa búsqueda web actual. Investiga demanda/interés, competencia, precios/ofertas, presencia en ecommerce, contenido/anuncios visibles, potencial visual, diferenciación, compra por impulso, riesgos y restricciones publicitarias. Para salud, suplementos o dispositivos de bienestar, prioriza fuentes oficiales pertinentes como INVIMA, Meta y TikTok cuando existan.

TRAZABILIDAD OBLIGATORIA:
- No inventes URLs, ventas, CTR, CPA históricos, ROAS históricos, volúmenes de ventas ni cifras de mercado.
- Cada producto debe tener entre 4 y 10 elementos de evidence.
- Cada evidence debe indicar type: verified = hecho respaldado por fuente; inference = conclusión razonable derivada de evidencia; recommendation = recomendación estratégica y NO hecho.
- Cada evidence debe incluir claim, evidence y sourceUrls.
- sourceUrls debe contener solo URLs que también estén en sources o la URL proporcionada por el usuario.
- Si algo no pudo verificarse, dilo en evidence en vez de presentarlo como hecho.
- Una URL del usuario sirve para verificar la página/producto, precio, presentación o características, pero no constituye por sí sola evidencia de demanda de mercado.

FUENTES:
- Incluye SOLO URLs reales obtenidas mediante búsqueda web o proporcionadas por el usuario.
- Deduplica URLs.
- Cada fuente debe tener title, url, type, supports y note.
- Tipos de fuente: official, regulatory, marketplace, advertising, social, news, research, product, user_provided u other.
- Las fuentes regulatorias y de políticas deben usarse cuando realmente respalden la afirmación correspondiente.

RESEARCH NOTES: resume los hallazgos más importantes y añade al final de cada nota relevante una referencia del tipo "Fuente: <título>". No uses notas como sustituto de evidence.

PUNTUACIONES: demand 0-5; competitionOpportunity 0-5 (5=oportunidad competitiva favorable); visual 0-5; differentiation 0-5; impulse 0-5; economicScore 0-100; metaScore 0-100; tiktokScore 0-100; overallScore 0-100.
PONDERACIÓN GENERAL: demanda 20%, oportunidad competitiva 15%, visual 15%, diferenciación 10%, impulso 10%, economía 30%.
INTERPRETACIÓN: 80-100 prioritario; 70-79 vale la pena testear; 60-69 test con precaución; 50-59 débil; 0-49 no prioritario.
ECONOMÍA: los valores de margen, margen porcentual, CPA máximo, CPA objetivo y ROAS de equilibrio calculados por el servidor son los valores oficiales. No los sustituyas.
No conviertas inferencias publicitarias en afirmaciones clínicas. Para suplementos y productos de salud usa lenguaje de bienestar y cumplimiento cuando corresponda.

PRODUCTOS:
${block}

Devuelve ÚNICAMENTE JSON válido según el esquema. No agregues markdown ni texto adicional.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5", tools: [{ type: "web_search" }], input: prompt, text: { format: { type: "json_schema", name: "product_comparison_traceable_v35", strict: true, schema } } }),
        signal: controller.signal
      });
    } catch (fetchError) {
      if (fetchError?.name === "AbortError") return res.status(504).json({ error: "La investigación tardó demasiado. Intenta nuevamente con menos productos o vuelve a intentarlo en unos segundos.", researchId });
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    if (!response.ok) {
      let apiError = {};
      try { apiError = JSON.parse(raw); } catch {}
      console.error("OpenAI error:", raw.slice(0, 3000));
      return res.status(502).json({ error: "OpenAI devolvió un error.", status: response.status, details: apiError?.error?.message || raw.slice(0, 1200), researchId });
    }

    let apiData;
    try { apiData = JSON.parse(raw); } catch { return res.status(502).json({ error: "OpenAI devolvió una respuesta inesperada.", researchId }); }

    const webCitations = [];
    const seenUrls = new Set();
    const addCitation = (url, title = "") => {
      const clean = String(url || "").trim();
      if (!/^https?:\/\//i.test(clean) || seenUrls.has(clean)) return;
      seenUrls.add(clean);
      webCitations.push({ title: String(title || clean).trim(), url: clean });
    };

    const walk = value => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (value.type === "url_citation" || value.type === "url_citation_detail") addCitation(value.url, value.title || value.name || "");
      for (const [key, child] of Object.entries(value)) if (["annotations","content","output","url_citation"].includes(key)) walk(child);
    };
    walk(apiData.output);

    let text = typeof apiData.output_text === "string" ? apiData.output_text : "";
    if (!text && Array.isArray(apiData.output)) for (const item of apiData.output) for (const c of item.content || []) if (typeof c?.text === "string") text += c.text;
    text = String(text).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
    if (!text) return res.status(502).json({ error: "OpenAI no devolvió contenido de análisis.", researchId });

    let result;
    try { result = JSON.parse(text); } catch (parseError) { console.error("JSON parse error:", parseError); console.error("OpenAI text:", text.slice(0, 5000)); return res.status(502).json({ error: "La IA no devolvió JSON válido.", researchId, details: text.slice(0, 3000) }); }

    result.products = (Array.isArray(result.products) ? result.products : []).map((r, i) => {
      const original = products.find(p => Number(p.id) === Number(r.id)) || products[i];
      if (!original) return r;
      return { ...r, id: original.id, productName: String(r.productName || original.productName), margin: original.margin, marginPercent: original.marginPercent, maxCPA: original.maxCPA, targetCPA: original.targetCPA, breakEvenROAS: original.breakEvenROAS, evidence: Array.isArray(r.evidence) ? r.evidence : [] };
    });

    const sorted = result.products.slice().sort((a,b) => (Number(b.overallScore)||0) - (Number(a.overallScore)||0));
    result.overallWinner = sorted[0] || null;
    const meta = result.products.slice().sort((a,b) => (Number(b.metaScore)||0) - (Number(a.metaScore)||0))[0];
    const tik = result.products.slice().sort((a,b) => (Number(b.tiktokScore)||0) - (Number(a.tiktokScore)||0))[0];
    result.metaWinner = meta ? { id: meta.id, productName: meta.productName, metaScore: meta.metaScore, platformReason: meta.platformReason || "" } : null;
    result.tiktokWinner = tik ? { id: tik.id, productName: tik.productName, tiktokScore: tik.tiktokScore, platformReason: tik.platformReason || "" } : null;

    const userSources = products.filter(p => p.url && /^https?:\/\//i.test(p.url)).map(p => ({ title: `${p.productName} — URL proporcionada por el usuario`, url: p.url, type: "user_provided", supports: "Página proporcionada para el análisis del producto.", note: "Fuente proporcionada por el usuario. Puede servir para verificar precio, presentación y características, pero no prueba por sí sola la demanda del mercado." }));
    const sourceMap = new Map();

    webCitations.forEach(c => sourceMap.set(c.url, { title: c.title, url: c.url, type: "web_search", supports: "Fuente citada directamente por la búsqueda web.", note: "URL capturada de una cita de búsqueda web." }));
    (Array.isArray(result.sources) ? result.sources : []).forEach(s => {
      const url = String(s?.url || "").trim();
      if (!/^https?:\/\//i.test(url) || sourceMap.has(url)) return;
      sourceMap.set(url, { title: String(s.title || url), url, type: String(s.type || "other"), supports: String(s.supports || ""), note: String(s.note || "Fuente declarada por el análisis.") });
    });
    userSources.forEach(s => { if (!sourceMap.has(s.url)) sourceMap.set(s.url, s); });

    result.sources = Array.from(sourceMap.values()).slice(0, 30);
    const knownUrls = new Set(result.sources.map(s => s.url));
    const typeLabel = { verified: "DATO VERIFICABLE", inference: "INFERENCIA", recommendation: "RECOMENDACIÓN" };
    const evidenceNotes = [];

    result.products = result.products.map(p => {
      const evidence = (Array.isArray(p.evidence) ? p.evidence : []).map(e => {
        const sourceUrls = Array.isArray(e?.sourceUrls) ? e.sourceUrls.map(u => String(u).trim()).filter(u => knownUrls.has(u)) : [];
        const type = ["verified","inference","recommendation"].includes(e?.type) ? e.type : "inference";
        const clean = { claim: String(e?.claim || "").trim(), type, evidence: String(e?.evidence || "").trim(), sourceUrls };
        if (clean.claim && clean.evidence) {
          const sourceTitles = sourceUrls.map(u => sourceMap.get(u)?.title || u);
          const sourceText = sourceTitles.length ? ` Fuente: ${sourceTitles.join("; ")}.` : " Fuente: no verificada en una URL capturada.";
          evidenceNotes.push(`${p.productName} — ${typeLabel[type]}: ${clean.claim}. ${clean.evidence}.${sourceText}`);
        }
        return clean;
      });
      return { ...p, evidence };
    });

    const existingNotes = Array.isArray(result.researchNotes) ? result.researchNotes.map(x => String(x).trim()).filter(Boolean) : [];
    result.researchNotes = [...evidenceNotes, ...existingNotes].slice(0, 50);

    result.traceability = {
      researchId,
      researchVersion,
      generatedAt: now.toISOString(),
      productsAnalyzed: products.length,
      webSearchUsed: true,
      webCitationsCaptured: webCitations.length,
      verifiedSourceCount: result.sources.length,
      evidenceCount: result.products.reduce((n,p) => n + (Array.isArray(p.evidence) ? p.evidence.length : 0), 0),
      sourcePolicy: "Solo se aceptan URLs capturadas de web_search o proporcionadas por el usuario; no se inventan URLs.",
      evidencePolicy: "Cada hallazgo se clasifica como dato verificable, inferencia o recomendación y conserva sus URLs asociadas cuando existen."
    };

    result.researchId = researchId;
    result.researchVersion = researchVersion;

    return res.status(200).json(result);
  } catch (e) {
    console.error("Research API error:", e);
    return res.status(500).json({ error: e.message || "Error interno del servidor." });
  }
};
