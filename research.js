export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Usa POST." });
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
      body.productName || body.product || body.name || ""
    ).trim();

    const description = String(body.description || "").trim();
    const url = String(body.url || "").trim();

    const cost = Number(body.cost || 0);
    const shipping = Number(body.shipping || 0);
    const otherCosts = Number(body.otherCosts ?? body.other ?? 0);
    const salePrice = Number(body.salePrice ?? body.price ?? 0);
    const returns = Number(body.returns || 0);

    if (!productName) {
      return res.status(400).json({
        error: "Falta el nombre del producto."
      });
    }

    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(salePrice) || salePrice <= 0) {
      return res.status(400).json({
        error: "Para analizar economía necesitas costo y precio de venta válidos."
      });
    }

    const margin = salePrice - cost - shipping - otherCosts;
    const marginPct = (margin / salePrice) * 100;

    // Estimación económica conservadora antes de pedir el análisis de mercado.
    const maxCpa = Math.max(0, margin * (1 - returns / 100));
    const targetCpa = Math.max(0, maxCpa * 0.55);
    const breakEvenRoas = margin > 0 ? salePrice / margin : 0;

    const prompt = `
Actúa como un analista profesional de productos para ecommerce y dropshipping en Colombia.

IMPORTANTE:
- Analiza exclusivamente el producto recibido.
- No inventes datos de ventas ni cifras de mercado como si fueran mediciones verificadas.
- Si no tienes datos externos verificables, expresa las conclusiones como estimaciones.
- Devuelve ÚNICAMENTE un objeto JSON válido.
- No uses markdown, no uses bloques de código y no agregues texto antes ni después del JSON.

PRODUCTO:
${productName}

DESCRIPCIÓN:
${description || "No proporcionada"}

URL:
${url || "No proporcionada"}

ECONOMÍA:
Costo: ${cost} COP
Envío asumido: ${shipping} COP
Otros costos: ${otherCosts} COP
Precio de venta: ${salePrice} COP
Devoluciones/no recibidos: ${returns}%
Margen bruto calculado: ${margin} COP
Margen porcentual calculado: ${marginPct.toFixed(2)}%
CPA máximo estimado después de devoluciones: ${maxCpa.toFixed(0)} COP
CPA objetivo inicial: ${targetCpa.toFixed(0)} COP
ROAS de equilibrio: ${breakEvenRoas.toFixed(2)}x

Evalúa:
1. demanda
2. competencia
3. potencial visual
4. diferenciación
5. impulso de compra
6. economía unitaria
7. plataforma recomendada: Meta Ads, TikTok Ads o ambas
8. riesgos
9. ángulos publicitarios
10. plan inicial de test

Usa escalas de 1 a 5 para las cinco dimensiones.
El score general debe ser de 0 a 100.
La confianza debe ser de 0 a 100.

Regla orientativa:
80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

JSON EXACTO:
{
  "productName": "",
  "score": 0,
  "confidence": 0,
  "decision": "",
  "recommendedPlatform": "",
  "summary": "",
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
  "strengths": [],
  "weaknesses": [],
  "risks": [],
  "angles": [],
  "testPlan": [],
  "researchNotes": [],
  "sources": []
}
`;

    const model = process.env.OPENAI_MODEL || "gpt-5";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      let apiError;
      try { apiError = JSON.parse(raw); } catch {}
      return res.status(response.status).json({
        error: apiError?.error?.message || "Error de la API de OpenAI.",
        details: apiError || raw.slice(0, 500)
      });
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: "OpenAI respondió con un formato inesperado.",
        details: raw.slice(0, 500)
      });
    }

    // Responses API normalmente expone el texto consolidado aquí.
    let text = result.output_text || "";

    // Fallback para respuestas donde output_text no venga directamente.
    if (!text && Array.isArray(result.output)) {
      for (const item of result.output) {
        if (!Array.isArray(item.content)) continue;
        for (const content of item.content) {
          if (typeof content.text === "string") {
            text += content.text;
          }
        }
      }
    }

    if (!text) {
      return res.status(502).json({
        error: "OpenAI no devolvió contenido de análisis."
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        data = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({
          error: "OpenAI no devolvió JSON válido.",
          details: text.slice(0, 1000)
        });
      }
    }

    // Aseguramos que los valores económicos calculados por nuestra app
    // lleguen al frontend aunque el modelo los omita.
    data.productName = data.productName || productName;
    data.margin = margin;
    data.marginPercent = marginPct;
    data.maxCPA = maxCpa;
    data.targetCPA = targetCpa;
    data.breakEvenROAS = breakEvenRoas;

    return res.status(200).json(data);

  } catch (error) {
    console.error("research error:", error);
    return res.status(500).json({
      error: error?.message || "Error interno del servidor."
    });
  }
}
