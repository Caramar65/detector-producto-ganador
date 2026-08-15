export default async function handler(req, res) {
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

    const productName = String(body.product || "").trim();
    const description = String(body.description || "").trim();
    const url = String(body.url || "").trim();

    const cost = Number(body.cost) || 0;
    const shipping = Number(body.shipping) || 0;
    const otherCosts = Number(body.otherCosts ?? body.other ?? 0) || 0;
    const salePrice = Number(body.salePrice ?? body.price) || 0;
    const returns = Number(body.returns) || 0;

    if (!productName) {
      return res.status(400).json({
        error: "Falta el nombre del producto."
      });
    }

    if (cost <= 0 || salePrice <= 0) {
      return res.status(400).json({
        error: "Para analizar economía necesitas costo y precio de venta mayores que cero."
      });
    }

    /*
     * ============================================================
     * CÁLCULO ECONÓMICO
     * ============================================================
     */

    const returnRate = Math.min(Math.max(returns, 0), 100) / 100;

    const expectedRevenue = salePrice * (1 - returnRate);

    const totalCost = cost + shipping + otherCosts;

    const expectedProfitBeforeAds = expectedRevenue - totalCost;

    const expectedMargin =
      expectedRevenue > 0
        ? (expectedProfitBeforeAds / expectedRevenue) * 100
        : 0;

    /*
     * CPA máximo aproximado antes de perder dinero.
     *
     * Si el producto genera $X antes de publicidad,
     * ese es el máximo teórico que podríamos pagar por una venta.
     */

    const maxCPA = Math.max(expectedProfitBeforeAds, 0);

    /*
     * CPA objetivo conservador.
     *
     * Dejamos aproximadamente 40% del beneficio disponible
     * como colchón para errores, variaciones, escalamiento,
     * costos adicionales y fluctuaciones.
     */

    const targetCPA = Math.max(maxCPA * 0.6, 0);

    /*
     * ============================================================
     * PROMPT DE INVESTIGACIÓN
     * ============================================================
     */

    const prompt = `
Actúa como un analista profesional de productos para ecommerce y dropshipping
en Colombia y Latinoamérica.

Tu trabajo es determinar si el siguiente producto merece una prueba real
de publicidad pagada.

IMPORTANTE:

1. Investiga señales actuales disponibles en internet.
2. Diferencia claramente entre:
   - datos encontrados en fuentes externas
   - estimaciones del modelo
3. No inventes datos concretos.
4. Si no encuentras evidencia suficiente, indícalo claramente.
5. No confundas popularidad con rentabilidad.
6. Analiza el producto pensando principalmente en Facebook/Instagram Ads
   y TikTok Ads.
7. Evalúa especialmente si el producto puede venderse mediante creatividad
   visual, UGC, demostraciones, transformación, problema/solución o impulso.
8. La economía proporcionada por la aplicación debe utilizarse como dato
   real del negocio.
9. La recomendación final debe ser conservadora y útil para decidir
   si vale la pena gastar dinero en una prueba.

PRODUCTO:
${productName}

DESCRIPCIÓN:
${description || "No proporcionada"}

URL:
${url || "No proporcionada"}

MERCADO PRINCIPAL:
Colombia

DATOS ECONÓMICOS:

Costo del producto:
${cost} COP

Envío asumido:
${shipping} COP

Otros costos por venta:
${otherCosts} COP

Precio de venta:
${salePrice} COP

Devoluciones / no recibidos estimados:
${returns}%

CÁLCULO ECONÓMICO DE LA APLICACIÓN:

Ingresos esperados después de devoluciones:
${expectedRevenue.toFixed(0)} COP

Costo total antes de publicidad:
${totalCost.toFixed(0)} COP

Beneficio esperado antes de publicidad:
${expectedProfitBeforeAds.toFixed(0)} COP

Margen esperado antes de publicidad:
${expectedMargin.toFixed(2)}%

CPA máximo aproximado:
${maxCPA.toFixed(0)} COP

CPA objetivo conservador:
${targetCPA.toFixed(0)} COP

CRITERIOS:

DEMANDA (1-5):
1 = muy baja
2 = baja
3 = media
4 = alta
5 = muy alta

COMPETENCIA (1-5):
1 = muy baja/favorable
2 = baja
3 = media
4 = alta
5 = muy alta/desfavorable

POTENCIAL VISUAL (1-5):
1 = difícil de demostrar
2 = poco visual
3 = potencial medio
4 = buen potencial visual
5 = excelente para videos, demostraciones, UGC o anuncios

DIFERENCIACIÓN (1-5):
1 = producto completamente comoditizado
2 = poca diferenciación
3 = diferenciación moderada
4 = buena diferenciación
5 = muy fácil diferenciarlo

IMPULSO (1-5):
1 = compra muy racional/lenta
2 = poco impulso
3 = impulso medio
4 = buen impulso
5 = fuerte compra por impulso

ECONOMÍA:
Evalúa si el margen y el CPA permiten comprar tráfico de forma razonable.

Analiza también:

- Demanda
- Competencia
- Potencial visual
- Diferenciación
- Compra por impulso
- Economía unitaria
- CPA máximo
- CPA objetivo
- Riesgo de devoluciones/no recibidos
- Posibilidad de escalar
- Adecuación para Facebook/Instagram
- Adecuación para TikTok
- Posibles ángulos de venta
- Principales riesgos

REGLA GENERAL DE DECISIÓN:

80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

IMPORTANTE:
La puntuación final no debe ser simplemente un promedio ciego.
Considera especialmente economía, demanda, competencia y capacidad de
demostrar el beneficio.

Para Meta Ads:
Prioriza productos con buen potencial visual, audiencia amplia y capacidad
de demostrar claramente el beneficio.

Para TikTok Ads:
Prioriza productos con demostración fuerte, transformación, novedad,
UGC, entretenimiento o alto potencial visual.

Si ninguna plataforma resulta claramente superior, indícalo.

Devuelve exclusivamente el objeto JSON solicitado por el esquema.
No escribas explicaciones antes ni después del JSON.
`;

    /*
     * ============================================================
     * JSON SCHEMA
     * ============================================================
     *
     * Esto evita depender de JSON generado "a mano" por el modelo.
     */

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        product: {
          type: "string"
        },

        score: {
          type: "number"
        },

        demand: {
          type: "number"
        },

        competition: {
          type: "number"
        },

        visual: {
          type: "number"
        },

        differentiation: {
          type: "number"
        },

        impulse: {
          type: "number"
        },

        margin: {
          type: "number"
        },

        maxCPA: {
          type: "number"
        },

        targetCPA: {
          type: "number"
        },

        recommendedPlatform: {
          type: "string"
        },

        decision: {
          type: "string"
        },

        confidence: {
          type: "number"
        },

        summary: {
          type: "string"
        },

        strengths: {
          type: "array",
          items: {
            type: "string"
          }
        },

        weaknesses: {
          type: "array",
          items: {
            type: "string"
          }
        },

        risks: {
          type: "array",
          items: {
            type: "string"
          }
        },

        angles: {
          type: "array",
          items: {
            type: "string"
          }
        },

        testPlan: {
          type: "array",
          items: {
            type: "string"
          }
        },

        researchNotes: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },

      required: [
        "product",
        "score",
        "demand",
        "competition",
        "visual",
        "differentiation",
        "impulse",
        "margin",
        "maxCPA",
        "targetCPA",
        "recommendedPlatform",
        "decision",
        "confidence",
        "summary",
        "strengths",
        "weaknesses",
        "risks",
        "angles",
        "testPlan",
        "researchNotes"
      ]
    };

    /*
     * ============================================================
     * OPENAI RESPONSES API
     * ============================================================
     */

    const model = process.env.OPENAI_MODEL || "gpt-5.6";

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

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt,

          text: {
            format: {
              type: "json_schema",
              name: "product_winner_analysis",
              description:
                "Análisis estructurado de viabilidad de un producto para ecommerce y publicidad digital.",
              strict: true,
              schema
            }
          }
        })
      }
    );

    /*
     * ============================================================
     * MANEJO DE ERROR DE OPENAI
     * ============================================================
     */

    if (!response.ok) {
      const errorText = await response.text();

      let errorMessage = "Error en la API de OpenAI.";

      try {
        const errorData = JSON.parse(errorText);

        errorMessage =
          errorData?.error?.message ||
          errorData?.message ||
          errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText.slice(0, 500);
        }
      }

      return res.status(response.status).json({
        error: errorMessage
      });
    }

    /*
     * ============================================================
     * LEER RESPUESTA
     * ============================================================
     */

    const data = await response.json();

    const text = data?.output_text;

    if (!text) {
      return res.status(502).json({
        error:
          "OpenAI respondió correctamente, pero no entregó contenido estructurado.",
        details: data
      });
    }

    /*
     * ============================================================
     * PARSEAR JSON
     * ============================================================
     */

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      return res.status(502).json({
        error: "OpenAI no devolvió JSON válido.",
        raw: text.slice(0, 2000),
        details: parseError.message
      });
    }

    /*
     * ============================================================
     * NORMALIZAR RESULTADO
     * ============================================================
     *
     * La economía calculada por nuestra aplicación tiene prioridad
     * sobre cualquier cálculo que haga el modelo.
     */

    result.product = productName;

    result.margin = Number(expectedMargin.toFixed(2));
    result.maxCPA = Math.round(maxCPA);
    result.targetCPA = Math.round(targetCPA);

    /*
     * Limitar puntuaciones a rangos razonables.
     */

    result.score = Math.min(Math.max(Number(result.score) || 0, 0), 100);

    result.demand = Math.min(
      Math.max(Number(result.demand) || 0, 1),
      5
    );

    result.competition = Math.min(
      Math.max(Number(result.competition) || 0, 1),
      5
    );

    result.visual = Math.min(
      Math.max(Number(result.visual) || 0, 1),
      5
    );

    result.differentiation = Math.min(
      Math.max(Number(result.differentiation) || 0, 1),
      5
    );

    result.impulse = Math.min(
      Math.max(Number(result.impulse) || 0, 1),
      5
    );

    result.confidence = Math.min(
      Math.max(Number(result.confidence) || 0, 0),
      100
    );

    /*
     * ============================================================
     * RESPUESTA FINAL AL FRONTEND
     * ============================================================
     */

    return res.status(200).json({
      ...result,

      economics: {
        cost,
        shipping,
        otherCosts,
        salePrice,
        returns,
        expectedRevenue: Math.round(expectedRevenue),
        totalCost: Math.round(totalCost),
        expectedProfitBeforeAds: Math.round(
          expectedProfitBeforeAds
        ),
        margin: Number(expectedMargin.toFixed(2)),
        maxCPA: Math.round(maxCPA),
        targetCPA: Math.round(targetCPA)
      }
    });
  } catch (error) {
    console.error("Research API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno al investigar el producto."
    });
  }
}
