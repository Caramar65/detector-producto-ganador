export default async function handler(req, res) {
  // Solo permitimos POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel"
      });
    }

    const {
      productName,
      description,
      url,
      cost,
      shipping,
      otherCosts,
      salePrice,
      returns
    } = req.body || {};

    if (!productName) {
      return res.status(400).json({
        error: "Falta el nombre del producto"
      });
    }

    const prompt = `
Actúa como un analista profesional de productos para ecommerce y dropshipping en Colombia.

Tu objetivo es determinar si un producto merece pasar a una fase real de TEST con publicidad.

Analiza el producto usando:
- demanda
- competencia
- potencial visual
- diferenciación
- impulso de compra
- economía unitaria
- CPA máximo tolerable
- plataforma recomendada
- riesgos

IMPORTANTE:
No inventes datos concretos de mercado como si fueran datos verificados.

Cuando no existan datos externos verificables, utiliza una ESTIMACIÓN DEL MODELO y deja claro que es una estimación.

PRODUCTO:
${productName}

DESCRIPCIÓN:
${description || "No proporcionada"}

URL:
${url || "No proporcionada"}

DATOS ECONÓMICOS:
Costo producto: ${cost || 0} COP
Envío asumido: ${shipping || 0} COP
Otros costos por venta: ${otherCosts || 0} COP
Precio de venta: ${salePrice || 0} COP
Devoluciones/no recibidos estimados: ${returns || 0}%

CRITERIOS:

DEMANDA (1-5):
1 = demanda muy baja
2 = demanda baja
3 = demanda media
4 = demanda alta
5 = demanda muy alta

COMPETENCIA (1-5):
1 = competencia baja/favorable
2 = competencia moderada-baja
3 = competencia media
4 = competencia alta
5 = competencia muy alta

VISUAL (1-5):
1 = difícil de demostrar visualmente
2 = potencial visual bajo
3 = potencial medio
4 = buen potencial visual
5 = excelente potencial para anuncios de video/imágenes

DIFERENCIACIÓN (1-5):
1 = producto completamente comoditizado
2 = poca diferenciación
3 = diferenciación moderada
4 = buena diferenciación
5 = muy fácil construir una propuesta diferente

IMPULSO (1-5):
1 = compra muy racional/lenta
2 = poco impulso
3 = impulso medio
4 = buen impulso
5 = fuerte compra por impulso

Analiza también la economía.

Calcula:

Margen bruto inicial =
precio de venta - costo producto - envío - otros costos

Considera también el porcentaje de devoluciones/no recibidos.

Estima un CPA máximo razonable que permita conservar margen.

Después determina una puntuación general de 0 a 100.

REGLA DE DECISIÓN:

80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

Para la plataforma:

Meta Ads:
preferir cuando el producto tenga buen potencial visual, audiencia amplia y posibilidad de demostrar beneficio.

TikTok Ads:
preferir cuando tenga fuerte demostración visual, transformación, novedad o potencial UGC.

Si ninguna plataforma resulta claramente superior, indícalo.

RESPONDE EXCLUSIVAMENTE EN JSON VÁLIDO.

Usa exactamente esta estructura:

{
  "productName": "",
  "score": 0,
  "demand": 0,
  "competition": 0,
  "visual": 0,
  "differentiation": 0,
  "impulse": 0,
  "margin": 0,
  "marginPercent": 0,
  "maxCPA": 0,
  "recommendedPlatform": "",
  "decision": "",
  "confidence": 0,
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "risks": [],
  "testPlan": [],
  "researchNotes": []
}

No agregues markdown.
No agregues explicaciones fuera del JSON.
`;

    const model = process.env.OPENAI_MODEL || "gpt-5.6";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Error de OpenAI",
        details: data
      });
    }

    let text = data.output_text || "";

    // Limpiar posibles bloques markdown
    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      return res.status(500).json({
        error: "OpenAI no devolvió JSON válido",
        raw: text
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Error interno del servidor"
    });
  }
}
