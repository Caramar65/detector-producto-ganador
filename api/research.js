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
    const researchVersion = "V3.4";

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

    const prompt = `Eres un analista profesional de ecommerce, investigación de mercado y publicidad digital para Colombia.

OBJETIVO: Compara TODOS los productos recibidos, desde 1 hasta 5, usando exactamente los mismos criterios. Determina ganador general, ganador Meta Ads y ganador TikTok Ads.

INVESTIGACIÓN WEB: Usa búsqueda web para obtener evidencia actual cuando esté disponible. Investiga para cada producto demanda/interés, competencia, precios, presencia en ecommerce, contenido/anuncios visibles, potencial visual, diferenciación, compra por impulso, riesgos y restricciones publicitarias. Para salud, suplementos o dispositivos de bienestar, prioriza fuentes oficiales pertinentes como INVIMA, Meta y TikTok cuando existan.

TRAZABILIDAD OBLIGATORIA: No inventes fuentes, URLs, ventas, CTR, CPA históricos, ROAS históricos, volúmenes de ventas ni cifras de mercado.

Clasifica cada evidencia como verified (respaldada por una fuente identificable), inference (inferencia razonable derivada de evidencia) o recommendation (recomendación estratégica, no hecho).

En sources incluye SOLO URLs realmente obtenidas por búsqueda web o URLs proporcionadas por el usuario. Una URL del usuario NO equivale a una fuente web verificada. Si una URL del usuario no pudo ser consultada, marca type=user_provided y dilo en note.

Cada fuente debe tener title, url, type, supports y note. Tipos permitidos: product, official, regulatory, marketplace, advertising, social, news, research, other, user_provided.

Para cada producto devuelve evidence con claim, type y sourceUrls. sourceUrls debe contener únicamente URLs que estén también en sources o sean la URL proporcionada para ese producto.

PUNTUACIONES: demand 0-5; competitionOpportunity 0-5 (5=oportunidad competitiva favorable); visual 0-5; differentiation 0-5; impulse 0-5; economicScore 0-100; metaScore 0-100; tiktokScore 0-100; overallScore 0-100.

PONDERACIÓN GENERAL: Demanda 20%, oportunidad competitiva 15%, visual 15%, diferenciación 10%, impulso 10%, economía 30%.

INTERPRETACIÓN: 80-100 prioritario; 70-79 vale la pena testear; 60-69 test con precaución; 50-59 débil; 0-49 no prioritario.

ECONOMÍA: Los valores calculados por el servidor de margen, margen porcentual, CPA máximo, CPA objetivo y ROAS de equilibrio son los valores oficiales. No los sustituyas.

REDACCIÓN: El informe debe permitir tomar una decisión comercial. Explica brevemente por qué gana cada producto. No conviertas inferencias publicitarias en afirmaciones clínicas.

PRODUCTOS:
${block}

Devuelve ÚNICAMENTE JSON válido, sin markdown ni texto adicional.

ESTRUCTURA EXACTA:
{
  "products": [{
    "id": 1, "productName": "", "overallScore": 0, "priority": "", "verdict": "", "confidence": 0,
    "recommendedPlatform": "", "platformReason": "", "finalReason": "", "summary": "",
    "demand": 0, "competitionOpportunity": 0, "visual": 0, "differentiation": 0, "impulse": 0,
    "economicScore": 0, "metaScore": 0, "tiktokScore": 0,
    "margin": 0, "marginPercent": 0, "maxCPA": 0, "targetCPA": 0, "breakEvenROAS": 0,
    "strengths": [], "weaknesses": [], "risks": [], "angles": [], "testPlan": [],
    "evidence": [{"claim":"","type":"verified","sourceUrls":[]}]
  }],
  "overallWinner": {"id":0,"productName":"","overallScore":0,"priority":"","recommendedPlatform":"","platformReason":"","finalReason":"","summary":"","margin":0,"marginPercent":0,"maxCPA":0,"targetCPA":0,"breakEvenROAS":0,"strengths":[],"weaknesses":[],"risks":[],"angles":[],"testPlan":[]},
  "metaWinner": {"id":0,"productName":"","metaScore":0,"platformReason":""},
  "tiktokWinner": {"id":0,"productName":"","tiktokScore":0,"platformReason":""},
  "recommendation":"",
  "researchNotes":[],
  "sources":[{"title":"","url":"","type":"","supports":"","note":""}]
}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5", tools: [{ type: "web_search" }], input: prompt })
    });

    const raw = await response.text();
    if (!response.ok) return res.status(502).json({ error: "OpenAI devolvió un error.", status: response.status, details: raw.slice(0, 2000), researchId });

    let apiData;
    try { apiData = JSON.parse(raw); }
    catch { return res.status(502).json({ error: "OpenAI devolvió una respuesta inesperada.", details: raw.slice(0, 2000), researchId }); }

    // Capturamos las citas URL que realmente aparecen en la respuesta de web_search.
    const webCitations = [];
    const seenUrls = new Set();
    const addCitation = (url, title = "") => {
      if (!url || !/^https?:\/\//i.test(String(url))) return;
      const clean = String(url).trim();
      if (seenUrls.has(clean)) return;
      seenUrls.add(clean);
      webCitations.push({ title: String(title || clean), url: clean });
    };

    const walk = value => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (value.type === "url_citation" || value.type === "url_citation_detail") addCitation(value.url, value.title || value.name || "");
      for (const [key, child] of Object.entries(value)) {
        if (key === "annotations" || key === "content" || key === "output") walk(child);
      }
    };
    walk(apiData.output);

    let text = typeof apiData.output_text === "string" ? apiData.output_text : "";
    if (!text && Array.isArray(apiData.output)) {
      for (const item of apiData.output) for (const c of item.content || []) if (typeof c?.text === "string") text += c.text;
    }

    text = String(text).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
    if (!text) return res.status(502).json({ error: "OpenAI no devolvió contenido de análisis.", researchId });

    let result;
    try { result = JSON.parse(text); }
    catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("OpenAI text:", text.slice(0, 5000));
      return res.status(502).json({ error: "La IA no devolvió JSON válido.", researchId, details: text.slice(0, 3000) });
    }

    result.products = (Array.isArray(result.products) ? result.products : []).map((r, i) => {
      const original = products.find(p => Number(p.id) === Number(r.id)) || products[i];
      if (!original) return r;
      return {
        ...r,
        id: original.id,
        productName: String(r.productName || original.productName),
        margin: original.margin,
        marginPercent: original.marginPercent,
        maxCPA: original.maxCPA,
        targetCPA: original.targetCPA,
        breakEvenROAS: original.breakEvenROAS,
        evidence: Array.isArray(r.evidence) ? r.evidence : []
      };
    });

    const sorted = result.products.slice().sort((a,b) => (Number(b.overallScore)||0) - (Number(a.overallScore)||0));
    result.overallWinner = sorted[0] || null;
    const meta = result.products.slice().sort((a,b) => (Number(b.metaScore)||0) - (Number(a.metaScore)||0))[0];
    const tik = result.products.slice().sort((a,b) => (Number(b.tiktokScore)||0) - (Number(a.tiktokScore)||0))[0];
    result.metaWinner = meta ? { id: meta.id, productName: meta.productName, metaScore: meta.metaScore, platformReason: meta.platformReason || "" } : null;
    result.tiktokWinner = tik ? { id: tik.id, productName: tik.productName, tiktokScore: tik.tiktokScore, platformReason: tik.platformReason || "" } : null;

    const userSources = products.filter(p => p.url && /^https?:\/\//i.test(p.url)).map(p => ({
      title: `${p.productName} — URL proporcionada por el usuario`,
      url: p.url,
      type: "user_provided",
      supports: "Página proporcionada para el análisis del producto.",
      note: "URL introducida por el usuario. No implica que su contenido haya sido verificado independientemente."
    }));

    const modelSources = Array.isArray(result.sources) ? result.sources : [];
    const sourceMap = new Map();

    webCitations.map(c => ({
      title: c.title,
      url: c.url,
      type: "web_search",
      supports: "Fuente citada por la herramienta web_search.",
      note: "URL extraída de una cita de búsqueda web de OpenAI."
    })).forEach(s => sourceMap.set(s.url, s));

    modelSources.filter(s => s && /^https?:\/\//i.test(String(s.url || ""))).forEach(s => {
      const url = String(s.url);
      if (!sourceMap.has(url)) sourceMap.set(url, {
        title: String(s.title || url),
        url,
        type: String(s.type || "other"),
        supports: String(s.supports || ""),
        note: String(s.note || "Fuente declarada por el análisis. Esta URL debe coincidir con una cita web o una URL proporcionada por el usuario.")
      });
    });

    userSources.forEach(s => {
      if (!sourceMap.has(s.url)) sourceMap.set(s.url, s);
    });

    result.sources = Array.from(sourceMap.values()).slice(0, 30);

    const knownUrls = new Set(result.sources.map(s => s.url));
    result.products = result.products.map(p => ({
      ...p,
      evidence: (Array.isArray(p.evidence) ? p.evidence : []).map(e => ({
        claim: String(e?.claim || ""),
        type: ["verified", "inference", "recommendation"].includes(e?.type) ? e.type : "inference",
        sourceUrls: Array.isArray(e?.sourceUrls) ? e.sourceUrls.filter(u => knownUrls.has(String(u))) : []
      }))
    }));

    result.traceability = {
      researchId,
      researchVersion,
      generatedAt: now.toISOString(),
      productsAnalyzed: products.length,
      webSearchUsed: true,
      webCitationsCaptured: webCitations.length,
      webSearchSourceCount: result.sources.filter(s => s.type === "web_search").length,
      userProvidedSourceCount: result.sources.filter(s => s.type === "user_provided").length,
      sourcePolicy: "Solo se aceptan URLs capturadas de web_search o proporcionadas por el usuario; no se inventan URLs."
    };

    result.researchId = researchId;
    result.researchVersion = researchVersion;

    return res.status(200).json(result);
  } catch (e) {
    console.error("Research API error:", e);
    return res.status(500).json({ error: e.message || "Error interno del servidor." });
  }
};
