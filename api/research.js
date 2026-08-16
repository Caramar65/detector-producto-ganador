module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    const body = req.body || {};

    const productName = String(
  body.productName ||
  body.product ||
  body.name ||
  ""
).trim();
    const description = String(body.description || "").trim();
    const url = String(body.url || "").trim();

    const cost = Number(body.cost || 0);
    const shipping = Number(body.shipping || 0);
    const otherCosts = Number(body.otherCosts || 0);
    const salePrice = Number(body.salePrice || 0);
    const returns = Number(body.returns || 0);

    if (!productName) {
      return res.status(400).json({
        error: "Falta el nombre del producto."
      });
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      return res.status(400).json({
        error: "El costo del producto debe ser mayor que cero."
      });
    }

    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      return res.status(400).json({
        error: "El precio de venta debe ser mayor que cero."
      });
    }

    const margin =
      salePrice -
      cost -
      shipping -
      otherCosts;

    const marginPercent =
      salePrice > 0
        ? (margin / salePrice) * 100
        : 0;

    const maxCPA = Math.max(0, margin * (1 - returns / 100));

    const targetCPA = Math.max(
      0,
      maxCPA * 0.55
    );

    const breakEvenROAS =
      margin > 0
        ? salePrice / margin
        : 0;

    const prompt = `
Actúa como un analista profesional de productos para ecommerce y dropshipping en Colombia.

Tu objetivo es determinar si este producto merece ser probado con publicidad pagada.

IMPORTANTE:
- No inventes ventas reales.
- No presentes estimaciones como datos comprobados.
- Cuando no existan datos verificables, indícalo claramente.
- Devuelve ÚNICAMENTE JSON válido.
- No escribas markdown.
- No pongas texto antes ni después del JSON.

PRODUCTO:
${productName}

DESCRIPCIÓN:
${description || "No proporcionada"}

URL:
${url || "No proporcionada"}

DATOS ECONÓMICOS:
Costo producto: ${cost} COP
Envío asumido: ${shipping} COP
Otros costos: ${otherCosts} COP
Precio venta: ${salePrice} COP
Devoluciones/no recibidos estimados: ${returns}%

ECONOMÍA CALCULADA:
Margen bruto: ${margin} COP
Margen porcentual: ${marginPercent.toFixed(2)}%
CPA máximo estimado: ${maxCPA.toFixed(0)} COP
CPA objetivo estimado: ${targetCPA.toFixed(0)} COP
ROAS de equilibrio aproximado: ${breakEvenROAS.toFixed(2)}

ANALIZA:

1. Demanda potencial
2. Competencia
3. Potencial visual para anuncios
4. Diferenciación
5. Compra por impulso
6. Economía unitaria
7. Riesgos
8. Plataforma recomendada: Meta Ads o TikTok Ads
9. Fortalezas
10. Debilidades
11. Ángulos publicitarios
12. Plan inicial de test

ASIGNA UNA PUNTUACIÓN DE 0 A 100.

REGLA DE DECISIÓN:
80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

Devuelve EXACTAMENTE esta estructura:

{
  "productName": "",
  "score": 0,
  "confidence": 0,
  "decision": "",
  "recommendedPlatform": "",
  "margin": 0,
  "marginPercent": 0,
  "maxCPA": 0,
  "targetCPA": 0,
  "breakEvenROAS": 0,
  "demand": 0,
  "competition": 0,
  "visual": 0,
  "differentiation": 0,
  "impulse": 0,
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "risks": [],
  "angles": [],
  "testPlan": [],
  "researchNotes": [],
  "sources": []
}
`;

    const model =
      process.env.OPENAI_MODEL || "gpt-5";

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: prompt
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error("OpenAI HTTP error:", response.status, raw);

      return res.status(502).json({
        error: "OpenAI devolvió un error.",
        status: response.status,
        details: raw.slice(0, 1000)
      });
    }

    let openaiData;

    try {
      openaiData = JSON.parse(raw);
    } catch (error) {
      console.error("OpenAI response no JSON:", raw);

      return res.status(502).json({
        error: "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 1000)
      });
    }

    let text = "";

    if (typeof openaiData.output_text === "string") {
      text = openaiData.output_text;
    }

    if (!text && Array.isArray(openaiData.output)) {
      for (const item of openaiData.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content &&
            typeof content.text === "string"
          ) {
            text += content.text;
          }
        }
      }
    }

    text = text.trim();

    if (!text) {
      console.error(
        "OpenAI no devolvió texto:",
        JSON.stringify(openaiData)
      );

      return res.status(502).json({
        error: "OpenAI no devolvió contenido de análisis."
      });
    }

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error(
        "El modelo no devolvió JSON válido:",
        text
      );

      return res.status(502).json({
        error: "La IA no devolvió JSON válido.",
        details: text.slice(0, 1500)
      });
    }

    result.productName =
      result.productName || productName;

    result.margin =
      Number(result.margin ?? margin);

    result.marginPercent =
      Number(
        result.marginPercent ?? marginPercent
      );

    result.maxCPA =
      Number(result.maxCPA ?? maxCPA);

    result.targetCPA =
      Number(result.targetCPA ?? targetCPA);

    result.breakEvenROAS =
      Number(
        result.breakEvenROAS ??
        breakEvenROAS
      );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Research API error:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Error interno del servidor."
    });
  }
};

