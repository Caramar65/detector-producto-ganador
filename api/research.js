module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido. Usa POST."
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    // =========================================================
    // 1. RECIBIR PRODUCTOS
    // =========================================================

    let body = req.body || {};

    // Algunos entornos pueden entregar req.body como texto
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: "El cuerpo de la solicitud no contiene JSON válido."
        });
      }
    }

    const inputProducts = Array.isArray(body.products)
      ? body.products
      : [];

    if (inputProducts.length < 1) {
      return res.status(400).json({
        error: "Debes enviar al menos 1 producto."
      });
    }

    if (inputProducts.length > 5) {
      return res.status(400).json({
        error: "Puedes analizar máximo 5 productos."
      });
    }

    // =========================================================
    // 2. NORMALIZAR Y VALIDAR PRODUCTOS
    // =========================================================

    const products = inputProducts.map((p, index) => {
      const id = Number(p.id) || index + 1;

      const productName = String(
        p.productName ||
        p.product ||
        p.name ||
        ""
      ).trim();

      const description = String(
        p.description || ""
      ).trim();

      const url = String(
        p.url || ""
      ).trim();

      const cost = Number(p.cost || 0);
      const shipping = Number(p.shipping || 0);
      const otherCosts = Number(p.otherCosts || 0);
      const salePrice = Number(p.salePrice || 0);
      const returns = Number(p.returns || 0);

      if (!productName) {
        throw new Error(
          `Falta el nombre del producto ${id}.`
        );
      }

      if (!Number.isFinite(cost) || cost <= 0) {
        throw new Error(
          `El costo del producto "${productName}" debe ser mayor que cero.`
        );
      }

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        throw new Error(
          `El precio de venta del producto "${productName}" debe ser mayor que cero.`
        );
      }

      // =======================================================
      // ECONOMÍA DEL PRODUCTO
      // =======================================================

      const margin =
        salePrice -
        cost -
        shipping -
        otherCosts;

      const marginPercent =
        salePrice > 0
          ? (margin / salePrice) * 100
          : 0;

      const returnFactor =
        Math.max(
          0,
          Math.min(100, returns)
        ) / 100;

      const maxCPA =
        Math.max(
          0,
          margin * (1 - returnFactor)
        );

      const targetCPA =
        Math.max(
          0,
          maxCPA * 0.55
        );

      const breakEvenROAS =
        margin > 0
          ? salePrice / margin
          : 0;

      // Score económico 0-100
      let economicScore = 0;

      if (marginPercent >= 60) {
        economicScore = 100;
      } else if (marginPercent >= 50) {
        economicScore = 90;
      } else if (marginPercent >= 40) {
        economicScore = 80;
      } else if (marginPercent >= 30) {
        economicScore = 65;
      } else if (marginPercent >= 20) {
        economicScore = 50;
      } else if (marginPercent > 0) {
        economicScore = 30;
      } else {
        economicScore = 0;
      }

      return {
        id,
        productName,
        description,
        url,
        cost,
        shipping,
        otherCosts,
        salePrice,
        returns,
        margin,
        marginPercent,
        maxCPA,
        targetCPA,
        breakEvenROAS,
        economicScore
      };
    });

    // =========================================================
    // 3. PREPARAR INFORMACIÓN PARA LA IA
    // =========================================================

    const productInformation = products
      .map((p) => {
        return `
PRODUCTO ${p.id}
Nombre: ${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL:
${p.url || "No proporcionada"}

Economía:
Costo: ${p.cost} COP
Envío: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

Cálculos:
Margen: ${p.margin} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo: ${p.maxCPA.toFixed(0)} COP
CPA objetivo: ${p.targetCPA.toFixed(0)} COP
ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}x
Score económico: ${p.economicScore}/100
`;
      })
      .join("\n-------------------------\n");

    // =========================================================
    // 4. PROMPT PRINCIPAL
    // =========================================================

    const prompt = `
Actúa como un analista profesional de ecommerce, dropshipping y publicidad digital para el mercado colombiano.

Debes analizar y COMPARAR ${products.length} producto(s).

OBJETIVO PRINCIPAL:

Determinar cuál producto tiene mayor potencial para ser probado mediante publicidad pagada y determinar específicamente:

1. Ganador general
2. Mejor producto para Meta Ads
3. Mejor producto para TikTok Ads
4. Ranking completo de todos los productos

NO debes asumir que necesariamente gana el producto con mayor margen.

Debes considerar conjuntamente:

- Demanda potencial
- Competencia
- Potencial visual
- Diferenciación
- Compra por impulso
- Economía unitaria
- Facilidad para crear anuncios
- Capacidad de demostrar el beneficio
- Potencial UGC
- Adecuación a Meta Ads
- Adecuación a TikTok Ads
- Riesgos publicitarios
- Riesgo de saturación
- Precio percibido
- Relación problema-solución
- Potencial para escalar

IMPORTANTE:

- No inventes ventas reales.
- No inventes cifras de mercado.
- No presentes estimaciones como datos comprobados.
- Si no tienes información suficiente sobre un punto, utiliza una estimación razonada y aclara que es una estimación.
- El análisis debe estar orientado al mercado colombiano.
- Considera las políticas publicitarias de Meta y TikTok.
- Evita claims médicos o promesas de resultados garantizados.
- En productos de salud, prioriza lenguaje de bienestar, comodidad, apoyo y experiencia de usuario.
- NO confundas "competencia" con "oportunidad competitiva".
- Un producto puede tener mucha competencia y aun así tener una buena oportunidad.
- La puntuación de competencia debe representar OPORTUNIDAD COMPETITIVA:
  5 = oportunidad muy favorable
  4 = oportunidad favorable
  3 = oportunidad media
  2 = oportunidad difícil
  1 = oportunidad muy difícil

ESCALA PARA LOS CRITERIOS:

Demanda:
1 = muy baja
2 = baja
3 = media
4 = alta
5 = muy alta

Competencia/oportunidad:
1 = muy desfavorable
2 = desfavorable
3 = media
4 = favorable
5 = muy favorable

Visual:
1 = muy difícil de demostrar
2 = difícil
3 = medio
4 = bueno
5 = excelente

Diferenciación:
1 = muy difícil diferenciar
2 = difícil
3 = media
4 = buena
5 = excelente

Impulso:
1 = muy bajo
2 = bajo
3 = medio
4 = alto
5 = muy alto

PARA EL SCORE GENERAL:

Debes ponderar aproximadamente:

Demanda: 20%
Competencia/oportunidad: 15%
Visual: 15%
Diferenciación: 10%
Impulso: 10%
Economía: 20%
Potencial publicitario/plataforma: 10%

El resultado final debe estar entre 0 y 100.

REGLA DE DECISIÓN:

80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

PARA META ADS:

Considera especialmente:
- Problema-solución
- Público identificable
- UGC testimonial
- Demostración visual
- Capacidad de explicar el beneficio rápidamente
- Capacidad de segmentación creativa
- Potencial de conversión

PARA TIKTOK ADS:

Considera especialmente:
- Hook visual
- Transformación/demostración
- UGC
- Viralidad
- Curiosidad
- Entretenimiento
- Facilidad de mostrar el producto en pocos segundos

PRODUCTOS A ANALIZAR:

${productInformation}

Devuelve ÚNICAMENTE un objeto JSON válido.

NO uses markdown.
NO uses bloques de código.
NO pongas texto antes del JSON.
NO pongas texto después del JSON.

La estructura EXACTA debe ser:

{
  "products": [
    {
      "id": 1,
      "productName": "",
      "overallScore": 0,
      "demand": 0,
      "competitionOpportunity": 0,
      "visual": 0,
      "differentiation": 0,
      "impulse": 0,
      "economicScore": 0,
      "metaScore": 0,
      "tiktokScore": 0,
      "verdict": "",
      "priority": "",
      "recommendedPlatform": "",
      "summary": "",
      "finalReason": "",
      "platformReason": "",
      "strengths": [],
      "weaknesses": [],
      "risks": [],
      "angles": [],
      "testPlan": [],
      "researchNotes": [],
      "margin": 0,
      "marginPercent": 0,
      "maxCPA": 0,
      "targetCPA": 0,
      "breakEvenROAS": 0
    }
  ],
  "overallWinner": {
    "id": 1,
    "productName": ""
  },
  "metaWinner": {
    "id": 1,
    "productName": ""
  },
  "tiktokWinner": {
    "id": 1,
    "productName": ""
  },
  "recommendation": "",
  "researchNotes": [],
  "sources": []
}

REGLAS ADICIONALES:

- "products" debe contener EXACTAMENTE ${products.length} elementos.
- Cada elemento debe corresponder a uno de los productos enviados.
- No inventes productos adicionales.
- Los IDs deben coincidir con los IDs recibidos.
- overallWinner.id debe corresponder al mejor producto.
- metaWinner.id debe corresponder al mejor producto para Meta Ads.
- tiktokWinner.id debe corresponder al mejor producto para TikTok Ads.
- Todos los scores deben ser números.
- overallScore debe ser un número entre 0 y 100.
- demand, competitionOpportunity, visual, differentiation e impulse deben ser números enteros entre 1 y 5.
- economicScore, metaScore y tiktokScore deben ser números entre 0 y 100.
- strengths, weaknesses, risks, angles, testPlan y researchNotes deben ser arrays.
`;

    // =========================================================
    // 5. LLAMADA A OPENAI
    // =========================================================

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

    // =========================================================
    // 6. ERROR DE OPENAI
    // =========================================================

    if (!response.ok) {
      console.error(
        "OpenAI HTTP error:",
        response.status,
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió un error.",
        status: response.status,
        details: raw.slice(0, 1500)
      });
    }

    // =========================================================
    // 7. PARSEAR RESPUESTA DE OPENAI
    // =========================================================

    let openaiData;

    try {
      openaiData = JSON.parse(raw);
    } catch {
      console.error(
        "Respuesta HTTP de OpenAI no válida:",
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 1500)
      });
    }

    let text = "";

    // Forma habitual
    if (
      typeof openaiData.output_text === "string"
    ) {
      text = openaiData.output_text;
    }

    // Compatibilidad con diferentes respuestas
    if (
      !text &&
      Array.isArray(openaiData.output)
    ) {
      for (const item of openaiData.output) {
        if (!Array.isArray(item.content)) {
          continue;
        }

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
        error:
          "OpenAI no devolvió contenido de análisis."
      });
    }

    // =========================================================
    // 8. LIMPIAR MARKDOWN SI EL MODELO LO AGREGA
    // =========================================================

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Buscar objeto JSON si existe texto adicional
    if (!text.startsWith("{")) {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
      ) {
        text = text.slice(
          firstBrace,
          lastBrace + 1
        );
      }
    }

    // =========================================================
    // 9. PARSEAR JSON DE LA IA
    // =========================================================

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      console.error(
        "La IA no devolvió JSON válido:",
        text
      );

      return res.status(502).json({
        error: "La IA no devolvió JSON válido.",
        details: text.slice(0, 2000)
      });
    }

    // =========================================================
    // 10. NORMALIZAR RESULTADO
    // =========================================================

    if (
      !result ||
      !Array.isArray(result.products)
    ) {
      return res.status(502).json({
        error:
          "La IA devolvió una estructura de análisis inválida."
      });
    }

    // =========================================================
    // 11. ASEGURAR QUE TODOS LOS PRODUCTOS EXISTAN
    // =========================================================

    const normalizedProducts = products.map(
      (original) => {

        const aiProduct =
          result.products.find(
            (p) =>
              Number(p.id) ===
              Number(original.id)
          ) ||
          result.products.find(
            (p) =>
              String(
                p.productName || ""
              ).trim().toLowerCase() ===
              original.productName
                .trim()
                .toLowerCase()
          );

        const p = aiProduct || {};

        return {
          id: original.id,

          productName:
            p.productName ||
            original.productName,

          overallScore:
            Number.isFinite(
              Number(p.overallScore)
            )
              ? Number(p.overallScore)
              : 0,

          demand:
            Number.isFinite(Number(p.demand))
              ? Number(p.demand)
              : 1,

          competitionOpportunity:
            Number.isFinite(
              Number(
                p.competitionOpportunity
              )
            )
              ? Number(
                  p.competitionOpportunity
                )
              : 1,

          visual:
            Number.isFinite(Number(p.visual))
              ? Number(p.visual)
              : 1,

          differentiation:
            Number.isFinite(
              Number(p.differentiation)
            )
              ? Number(p.differentiation)
              : 1,

          impulse:
            Number.isFinite(Number(p.impulse))
              ? Number(p.impulse)
              : 1,

          economicScore:
            original.economicScore,

          metaScore:
            Number.isFinite(
              Number(p.metaScore)
            )
              ? Number(p.metaScore)
              : 0,

          tiktokScore:
            Number.isFinite(
              Number(p.tiktokScore)
            )
              ? Number(p.tiktokScore)
              : 0,

          verdict:
            p.verdict ||
            "Pendiente de evaluación",

          priority:
            p.priority ||
            "",

          recommendedPlatform:
            p.recommendedPlatform ||
            "",

          summary:
            p.summary ||
            "",

          finalReason:
            p.finalReason ||
            p.summary ||
            "",

          platformReason:
            p.platformReason ||
            "",

          strengths:
            Array.isArray(p.strengths)
              ? p.strengths
              : [],

          weaknesses:
            Array.isArray(p.weaknesses)
              ? p.weaknesses
              : [],

          risks:
            Array.isArray(p.risks)
              ? p.risks
              : [],

          angles:
            Array.isArray(p.angles)
              ? p.angles
              : [],

          testPlan:
            Array.isArray(p.testPlan)
              ? p.testPlan
              : [],

          researchNotes:
            Array.isArray(
              p.researchNotes
            )
              ? p.researchNotes
              : [],

          margin:
            original.margin,

          marginPercent:
            original.marginPercent,

          maxCPA:
            original.maxCPA,

          targetCPA:
            original.targetCPA,

          breakEvenROAS:
            original.breakEvenROAS
        };
      }
    );

    // =========================================================
    // 12. ORDENAR / IDENTIFICAR GANADORES
    // =========================================================

    const sorted =
      [...normalizedProducts].sort(
        (a, b) =>
          b.overallScore -
          a.overallScore
      );

    const overallWinner =
      sorted[0];

    const metaWinner =
      [...normalizedProducts].sort(
        (a, b) =>
          b.metaScore -
          a.metaScore
      )[0];

    const tiktokWinner =
      [...normalizedProducts].sort(
        (a, b) =>
          b.tiktokScore -
          a.tiktokScore
      )[0];

    // =========================================================
    // 13. DEVOLVER ESTRUCTURA DEFINITIVA
    // =========================================================

    return res.status(200).json({
      products: normalizedProducts,

      overallWinner: {
        id: overallWinner.id,
        productName:
          overallWinner.productName
      },

      metaWinner: {
        id: metaWinner.id,
        productName:
          metaWinner.productName
      },

      tiktokWinner: {
        id: tiktokWinner.id,
        productName:
          tiktokWinner.productName
      },

      recommendation:
        result.recommendation ||
        `El producto recomendado para comenzar es ${overallWinner.productName}.`,

      researchNotes:
        Array.isArray(result.researchNotes)
          ? result.researchNotes
          : [],

      sources:
        Array.isArray(result.sources)
          ? result.sources
          : []
    });

  } catch (error) {

    console.error(
      "Research API error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Error interno del servidor."
    });
  }
};
