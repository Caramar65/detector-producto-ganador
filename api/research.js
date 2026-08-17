module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // =========================================================
  // 1. MÉTODO HTTP
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido. Usa POST."
    });
  }

  try {
    // =========================================================
    // 2. API KEY
    // =========================================================

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    // =========================================================
    // 3. LEER BODY
    // =========================================================

    let body = req.body || {};

    // Por seguridad, si Vercel recibe el body como string
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({
          error: "El cuerpo de la solicitud no contiene JSON válido."
        });
      }
    }

    const input = Array.isArray(body.products)
      ? body.products
      : [];

    // =========================================================
    // 4. VALIDAR CANTIDAD DE PRODUCTOS
    // =========================================================

    if (input.length < 1 || input.length > 5) {
      return res.status(400).json({
        error: "Debes enviar entre 1 y 5 productos."
      });
    }

    // =========================================================
    // 5. NORMALIZAR PRODUCTOS Y CALCULAR ECONOMÍA
    // =========================================================

    const products = input.map((p, index) => {
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
          `Falta el nombre del producto ${index + 1}.`
        );
      }

      if (!Number.isFinite(cost) || cost <= 0) {
        throw new Error(
          `El costo del producto ${index + 1} debe ser mayor que cero.`
        );
      }

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        throw new Error(
          `El precio de venta del producto ${index + 1} debe ser mayor que cero.`
        );
      }

      const safeReturns = Math.min(
        100,
        Math.max(0, returns)
      );

      const margin =
        salePrice -
        cost -
        shipping -
        otherCosts;

      const marginPercent =
        salePrice > 0
          ? (margin / salePrice) * 100
          : 0;

      const maxCPA = Math.max(
        0,
        margin * (1 - safeReturns / 100)
      );

      const targetCPA = Math.max(
        0,
        maxCPA * 0.55
      );

      const breakEvenROAS =
        margin > 0
          ? salePrice / margin
          : 0;

      return {
        id: Number(p.id) || index + 1,
        productName,
        description,
        url,
        cost,
        shipping,
        otherCosts,
        salePrice,
        returns: safeReturns,
        margin,
        marginPercent,
        maxCPA,
        targetCPA,
        breakEvenROAS
      };
    });

    // =========================================================
    // 6. CONSTRUIR INFORMACIÓN ECONÓMICA PARA LA IA
    // =========================================================

    const productBlock = products
      .map((p) => {
        return `
PRODUCTO ${p.id}

Nombre:
${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL proporcionada por el usuario:
${p.url || "No proporcionada"}

DATOS ECONÓMICOS:
Costo producto: ${p.cost} COP
Envío: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio de venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

ECONOMÍA CALCULADA:
Margen: ${p.margin} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo estimado: ${p.maxCPA.toFixed(0)} COP
CPA objetivo estimado: ${p.targetCPA.toFixed(0)} COP
ROAS de equilibrio: ${p.breakEvenROAS.toFixed(2)}x
`;
      })
      .join("\n-----------------------------\n");

    // =========================================================
    // 7. PROMPT PROFESIONAL
    // =========================================================

    const prompt = `
Eres un analista profesional senior de ecommerce, dropshipping y publicidad digital especializado en el mercado colombiano.

Tu trabajo es investigar y comparar TODOS los productos recibidos.

Hay entre 1 y 5 productos.

NO debes evaluar solamente el primer producto.

Debes comparar los productos utilizando exactamente los mismos criterios.

=========================================================
OBJETIVO
=========================================================

Determina:

1. Ganador general.
2. Ganador para Meta Ads.
3. Ganador para TikTok Ads.
4. Ranking completo de todos los productos.
5. Economía de cada producto.
6. Fortalezas y debilidades.
7. Riesgos.
8. Ángulos publicitarios.
9. Plan inicial de test.
10. Fuentes reales utilizadas durante la investigación.

=========================================================
INVESTIGACIÓN WEB
=========================================================

UTILIZA BÚSQUEDA WEB.

Investiga cada producto individualmente.

Cuando sea posible analiza:

- Demanda potencial.
- Tendencias e interés.
- Competencia.
- Precios observados.
- Oferta existente.
- Diferenciación.
- Potencial visual.
- Potencial para UGC.
- Compra por impulso.
- Saturación publicitaria.
- Problemas o necesidades que resuelve.
- Potencial para Meta Ads.
- Potencial para TikTok Ads.
- Riesgos de publicidad.
- Riesgos regulatorios.
- Riesgos de devoluciones.
- Credibilidad del producto.
- Valor percibido.

Para Colombia, cuando sea relevante, consulta fuentes como:

- INVIMA.
- Meta Advertising.
- TikTok for Business.
- Mercado Libre Colombia.
- Google Trends u otras fuentes de tendencias.
- Sitios de fabricantes.
- Tiendas relevantes.
- Fuentes oficiales relacionadas con el producto.

=========================================================
REGLAS SOBRE FUENTES
=========================================================

MUY IMPORTANTE:

No inventes URLs.

No inventes fuentes.

No escribas una URL que no hayas obtenido realmente mediante búsqueda web o que no haya sido proporcionada por el usuario.

Las fuentes deben ser reales.

Si una fuente no puede verificarse, NO la incluyas.

Cuando una fuente sea utilizada para una afirmación concreta, intenta incluirla en "sources".

Las fuentes pueden ser oficiales, comerciales o de investigación.

Distingue siempre entre:

- Dato verificable.
- Inferencia profesional.
- Estimación.

NO inventes:

- Ventas.
- Número de clientes.
- CTR.
- CPA histórico.
- ROAS histórico.
- Tamaño exacto del mercado.
- Número de anuncios.
- Porcentajes de conversión.

Si no existe información verificable, dilo claramente.

=========================================================
CRITERIOS DE PUNTUACIÓN
=========================================================

Demanda:
0-5

Competencia / oportunidad competitiva:
0-5

IMPORTANTE:

5/5 significa una oportunidad competitiva favorable.

NO significa que no exista competencia.

Visual:
0-5

Diferenciación:
0-5

Impulso:
0-5

Economía:
0-100

Meta Ads:
0-100

TikTok Ads:
0-100

Score general:
0-100

=========================================================
PONDERACIÓN GENERAL
=========================================================

Demanda: 20%

Oportunidad competitiva: 15%

Potencial visual: 15%

Diferenciación: 10%

Compra por impulso: 10%

Economía: 30%

La puntuación general debe considerar estos factores, pero también puede incorporar riesgos importantes que puedan afectar la viabilidad real del producto.

=========================================================
REGLA DE DECISIÓN
=========================================================

80-100:
PRODUCTO PRIORITARIO

70-79:
VALE LA PENA TESTEAR

60-69:
TEST CON PRECAUCIÓN

50-59:
PRODUCTO DÉBIL

0-49:
NO PRIORITARIO

=========================================================
META ADS
=========================================================

Evalúa especialmente:

- Capacidad de explicar el problema y la solución.
- UGC.
- Creativos problema-solución.
- Testimonios.
- Antes/después cuando sea permitido.
- Capacidad de segmentación.
- Claridad del beneficio.
- Potencial de conversión en landing.
- Riesgo de políticas publicitarias.

=========================================================
TIKTOK ADS
=========================================================

Evalúa especialmente:

- Hook visual.
- Demostración.
- UGC.
- Transformación visual.
- Curiosidad.
- Viralidad potencial.
- Facilidad para crear múltiples creativos.
- Capacidad de generar contenido auténtico.

=========================================================
SALUD Y SUPLEMENTOS
=========================================================

Cuando el producto sea de salud, suplemento, dispositivo terapéutico o similar:

NO hagas diagnósticos.

NO prometas curas.

NO presentes resultados garantizados.

NO inventes registros sanitarios.

Evalúa también:

- Riesgo de claims.
- Riesgo de desaprobación publicitaria.
- Necesidad de respaldo documental.
- Registro INVIMA cuando corresponda.
- Claridad de beneficios permitidos.

=========================================================
ECONOMÍA
=========================================================

Utiliza los cálculos proporcionados.

No modifiques artificialmente:

- Margen.
- CPA máximo.
- CPA objetivo.
- ROAS de equilibrio.

=========================================================
FORMATO
=========================================================

Devuelve ÚNICAMENTE JSON válido.

NO utilices Markdown.

NO utilices bloques de código.

NO escribas texto antes del JSON.

NO escribas texto después del JSON.

Todos los productos recibidos deben aparecer en "products".

No omitas productos.

Si hay un solo producto, igualmente debe aparecer dentro de "products".

=========================================================
ESTRUCTURA EXACTA
=========================================================

{
  "products": [
    {
      "id": 1,
      "productName": "",
      "overallScore": 0,
      "priority": "",
      "verdict": "",
      "confidence": 0,
      "recommendedPlatform": "",
      "platformReason": "",
      "finalReason": "",
      "summary": "",
      "demand": 0,
      "competitionOpportunity": 0,
      "visual": 0,
      "differentiation": 0,
      "impulse": 0,
      "economicScore": 0,
      "metaScore": 0,
      "tiktokScore": 0,
      "margin": 0,
      "marginPercent": 0,
      "maxCPA": 0,
      "targetCPA": 0,
      "breakEvenROAS": 0,
      "strengths": [],
      "weaknesses": [],
      "risks": [],
      "angles": [],
      "testPlan": []
    }
  ],

  "overallWinner": {
    "id": 0,
    "productName": "",
    "overallScore": 0,
    "priority": "",
    "recommendedPlatform": "",
    "platformReason": "",
    "finalReason": "",
    "summary": "",
    "margin": 0,
    "marginPercent": 0,
    "maxCPA": 0,
    "targetCPA": 0,
    "breakEvenROAS": 0,
    "strengths": [],
    "weaknesses": [],
    "risks": [],
    "angles": [],
    "testPlan": []
  },

  "metaWinner": {
    "id": 0,
    "productName": "",
    "metaScore": 0,
    "platformReason": ""
  },

  "tiktokWinner": {
    "id": 0,
    "productName": "",
    "tiktokScore": 0,
    "platformReason": ""
  },

  "recommendation": "",

  "researchNotes": [],

  "sources": [
    {
      "title": "",
      "url": "",
      "note": ""
    }
  ]
}

PRODUCTOS A INVESTIGAR:

${productBlock}
`;

    // =========================================================
    // 8. LLAMADA A OPENAI
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

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt
        })
      }
    );

    // =========================================================
    // 9. LEER RESPUESTA DE OPENAI
    // =========================================================

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "OpenAI HTTP error:",
        response.status,
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió un error.",
        status: response.status,
        details: raw.slice(0, 2000)
      });
    }

    let openaiData;

    try {
      openaiData = JSON.parse(raw);
    } catch (error) {
      console.error(
        "Respuesta de OpenAI no es JSON:",
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 2000)
      });
    }

    // =========================================================
    // 10. EXTRAER TEXTO
    // =========================================================

    let text = "";

    if (
      typeof openaiData.output_text === "string"
    ) {
      text = openaiData.output_text;
    }

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
    // 11. LIMPIAR MARKDOWN SI APARECE
    // =========================================================

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // =========================================================
    // 12. PARSEAR JSON DE LA IA
    // =========================================================

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error(
        "La IA no devolvió JSON válido:",
        text
      );

      return res.status(502).json({
        error: "La IA no devolvió JSON válido.",
        details: text.slice(0, 3000)
      });
    }

    // =========================================================
    // 13. NORMALIZAR PRODUCTOS
    // =========================================================

    const aiProducts = Array.isArray(result.products)
      ? result.products
      : [];

    const normalizedProducts = products.map(
      (original, index) => {
        const ai =
          aiProducts.find(
            item =>
              Number(item?.id) ===
              Number(original.id)
          ) ||
          aiProducts[index] ||
          {};

        return {
          id: original.id,

          productName:
            ai.productName ||
            original.productName,

          overallScore:
            Number(ai.overallScore) || 0,

          priority:
            ai.priority || "",

          verdict:
            ai.verdict || "",

          confidence:
            Number(ai.confidence) || 0,

          recommendedPlatform:
            ai.recommendedPlatform || "",

          platformReason:
            ai.platformReason || "",

          finalReason:
            ai.finalReason || "",

          summary:
            ai.summary || "",

          demand:
            Number(ai.demand) || 0,

          competitionOpportunity:
            Number(ai.competitionOpportunity) || 0,

          visual:
            Number(ai.visual) || 0,

          differentiation:
            Number(ai.differentiation) || 0,

          impulse:
            Number(ai.impulse) || 0,

          economicScore:
            Number(ai.economicScore) || 0,

          metaScore:
            Number(ai.metaScore) || 0,

          tiktokScore:
            Number(ai.tiktokScore) || 0,

          // Economía calculada por nuestro servidor.
          // NO dependemos de la IA para estos valores.
          margin:
            original.margin,

          marginPercent:
            original.marginPercent,

          maxCPA:
            original.maxCPA,

          targetCPA:
            original.targetCPA,

          breakEvenROAS:
            original.breakEvenROAS,

          strengths:
            Array.isArray(ai.strengths)
              ? ai.strengths
              : [],

          weaknesses:
            Array.isArray(ai.weaknesses)
              ? ai.weaknesses
              : [],

          risks:
            Array.isArray(ai.risks)
              ? ai.risks
              : [],

          angles:
            Array.isArray(ai.angles)
              ? ai.angles
              : [],

          testPlan:
            Array.isArray(ai.testPlan)
              ? ai.testPlan
              : []
        };
      }
    );

    // =========================================================
    // 14. ORDENAR GANADOR GENERAL
    // =========================================================

    const sorted =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            Number(b.overallScore) -
            Number(a.overallScore)
        );

    const overallWinner =
      sorted[0] || null;

    // =========================================================
    // 15. GANADOR META ADS
    // =========================================================

    const metaWinnerProduct =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            Number(b.metaScore) -
            Number(a.metaScore)
        )[0] || null;

    // =========================================================
    // 16. GANADOR TIKTOK ADS
    // =========================================================

    const tiktokWinnerProduct =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            Number(b.tiktokScore) -
            Number(a.tiktokScore)
        )[0] || null;

    // =========================================================
    // 17. EXTRAER FUENTES REALES DE LAS CITAS WEB
    // =========================================================

    const extractedSources = [];

    if (Array.isArray(openaiData.output)) {
      for (const item of openaiData.output) {
        if (!Array.isArray(item.content)) {
          continue;
        }

        for (const content of item.content) {
          if (
            !content ||
            !Array.isArray(content.annotations)
          ) {
            continue;
          }

          for (const annotation of content.annotations) {
            if (
              annotation &&
              annotation.type === "url_citation" &&
              annotation.url
            ) {
              extractedSources.push({
                title:
                  annotation.title ||
                  annotation.url,

                url:
                  annotation.url,

                note:
                  "Fuente obtenida mediante búsqueda web."
              });
            }
          }
        }
      }
    }

    // =========================================================
    // 18. FUENTES DEVUELTAS POR LA IA
    // =========================================================

    const aiSources =
      Array.isArray(result.sources)
        ? result.sources
        : [];

    const userSources = products
      .filter(p => /^https?:\/\//i.test(p.url))
      .map(p => ({
        title: p.productName,
        url: p.url,
        note: "URL proporcionada por el usuario."
      }));

    // =========================================================
    // 19. UNIFICAR Y LIMPIAR FUENTES
    // =========================================================

    const sourceMap = new Map();

    [
      ...extractedSources,
      ...aiSources,
      ...userSources
    ].forEach(source => {
      if (!source) return;

      const url = String(
        source.url || ""
      ).trim();

      if (!/^https?:\/\//i.test(url)) {
        return;
      }

      if (!sourceMap.has(url)) {
        sourceMap.set(url, {
          title:
            String(
              source.title ||
              url
            ).trim(),

          url,

          note:
            String(
              source.note ||
              "Fuente utilizada durante la investigación."
            ).trim()
        });
      }
    });

    const sources =
      Array.from(sourceMap.values())
        .slice(0, 20);

    // =========================================================
    // 20. INVESTIGATION NOTES
    // =========================================================

    const researchNotes =
      Array.isArray(result.researchNotes)
        ? result.researchNotes
        : [];

    // =========================================================
    // 21. RECOMENDACIÓN
    // =========================================================

    const recommendation =
      typeof result.recommendation === "string"
        ? result.recommendation
        : "";

    // =========================================================
    // 22. RESPUESTA FINAL
    // =========================================================

    const finalResult = {
      products: normalizedProducts,

      overallWinner,

      metaWinner:
        metaWinnerProduct
          ? {
              id: metaWinnerProduct.id,

              productName:
                metaWinnerProduct.productName,

              metaScore:
                metaWinnerProduct.metaScore,

              platformReason:
                metaWinnerProduct.platformReason || ""
            }
          : null,

      tiktokWinner:
        tiktokWinnerProduct
          ? {
              id: tiktokWinnerProduct.id,

              productName:
                tiktokWinnerProduct.productName,

              tiktokScore:
                tiktokWinnerProduct.tiktokScore,

              platformReason:
                tiktokWinnerProduct.platformReason || ""
            }
          : null,

      recommendation,

      researchNotes,

      sources
    };

    return res.status(200).json(finalResult);

  } catch (error) {
    // =========================================================
    // ERROR GENERAL
    // =========================================================

    console.error(
      "Research API error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno del servidor."
    });
  }
};
