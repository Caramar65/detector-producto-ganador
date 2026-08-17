module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    // ============================================================
    // 1. CONFIGURACIÓN
    // ============================================================

    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    // ============================================================
    // 2. VALIDAR PRODUCTOS RECIBIDOS
    // ============================================================

    const input = Array.isArray(req.body?.products)
      ? req.body.products
      : [];

    if (!input.length || input.length > 5) {
      return res.status(400).json({
        error: "Debes enviar entre 1 y 5 productos."
      });
    }

    // ============================================================
    // 3. NORMALIZAR Y CALCULAR ECONOMÍA
    // ============================================================

    const products = input.map((p, i) => {

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

      const cost = Number(p.cost);
      const shipping = Number(p.shipping || 0);
      const otherCosts = Number(p.otherCosts || 0);
      const salePrice = Number(p.salePrice);
      const returns = Number(p.returns || 0);

      if (!productName) {
        throw new Error(
          `Falta el nombre del producto ${i + 1}.`
        );
      }

      if (!Number.isFinite(cost) || cost <= 0) {
        throw new Error(
          `El costo del producto ${i + 1} debe ser mayor que cero.`
        );
      }

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        throw new Error(
          `El precio de venta del producto ${i + 1} debe ser mayor que cero.`
        );
      }

      const safeReturns = Math.min(
        100,
        Math.max(0, returns)
      );

      // Margen antes de publicidad
      const margin =
        salePrice -
        cost -
        shipping -
        otherCosts;

      const marginPercent =
        salePrice > 0
          ? (margin / salePrice) * 100
          : 0;

      // CPA máximo considerando devoluciones/no recibidos
      const maxCPA =
        Math.max(
          0,
          margin * (1 - safeReturns / 100)
        );

      // CPA objetivo conservador
      const targetCPA =
        Math.max(
          0,
          maxCPA * 0.55
        );

      // ROAS necesario para cubrir el margen
      const breakEvenROAS =
        margin > 0
          ? salePrice / margin
          : 0;

      return {
        id: Number(p.id) || i + 1,
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

    // ============================================================
    // 4. CONSTRUIR BLOQUE DE INVESTIGACIÓN
    // ============================================================

    const block = products
      .map((p) => `
PRODUCTO ${p.id}
Nombre: ${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL:
${p.url || "No proporcionada"}

ECONOMÍA:
Costo: ${p.cost} COP
Envío: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio de venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

Margen: ${p.margin.toFixed(0)} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo: ${p.maxCPA.toFixed(0)} COP
CPA objetivo: ${p.targetCPA.toFixed(0)} COP
ROAS equilibrio: ${p.breakEvenROAS.toFixed(2)}x
`)
      .join("\n--------------------------------------------------\n");

    // ============================================================
    // 5. PROMPT PRINCIPAL
    // ============================================================

    const prompt = `
Eres un analista senior de ecommerce, marketing digital y publicidad
para el mercado colombiano.

Tu trabajo es investigar y comparar TODOS los productos recibidos.

Hay entre 1 y 5 productos.

NO debes asumir que el primer producto es el ganador.

Debes investigar CADA producto individualmente y después compararlos
utilizando exactamente los mismos criterios.

============================================================
INVESTIGACIÓN WEB OBLIGATORIA
============================================================

USA LA HERRAMIENTA DE BÚSQUEDA WEB.

Para cada producto investiga, cuando exista información disponible:

1. Demanda o interés del mercado.
2. Competidores.
3. Precios observados.
4. Presencia en marketplaces.
5. Presencia en redes sociales.
6. Tipo de anuncios/contenidos utilizados.
7. Potencial visual para anuncios.
8. Potencial UGC.
9. Facilidad de explicar el producto en video.
10. Compra por impulso.
11. Diferenciación.
12. Saturación.
13. Riesgos.
14. Posibilidad de venderlo mediante Meta Ads.
15. Posibilidad de venderlo mediante TikTok Ads.

Para productos de salud, suplementos, bienestar o dispositivos:

- Busca fuentes oficiales cuando sea relevante.
- Consulta INVIMA cuando corresponda.
- Consulta políticas oficiales de Meta cuando sea relevante.
- Consulta políticas oficiales de TikTok cuando sea relevante.
- No inventes registros sanitarios.
- No inventes aprobaciones.
- No inventes cifras de ventas.
- No inventes CTR.
- No inventes CPA históricos.
- No inventes ROAS históricos.

Distingue claramente entre:

DATOS VERIFICABLES
e
INFERENCIAS PROFESIONALES.

============================================================
FUENTES
============================================================

Es MUY IMPORTANTE que el resultado incluya fuentes reales.

En "sources":

- Incluye URLs realmente utilizadas durante la investigación.
- Incluye fuentes oficiales cuando sean relevantes.
- Puedes incluir marketplaces, tendencias, páginas de competidores,
  políticas oficiales y fuentes institucionales.
- Puedes incluir la URL proporcionada por el usuario si es válida.
- NO inventes URLs.
- NO generes URLs ficticias.
- NO pongas URLs genéricas solamente para llenar el campo.
- Si una fuente no puede verificarse, NO la incluyas.

Cada fuente debe tener:

title
url
note

La nota debe explicar brevemente qué aporta esa fuente.

============================================================
ESCALAS
============================================================

Demanda:
0-5

Competencia:
0-5

IMPORTANTE:
competitionOpportunity = 5 significa oportunidad competitiva favorable.

No significa ausencia de competencia.

Visual:
0-5

Diferenciación:
0-5

Impulso:
0-5

economicScore:
0-100

metaScore:
0-100

tiktokScore:
0-100

overallScore:
0-100

============================================================
PONDERACIÓN GENERAL
============================================================

Demanda: 20%

Oportunidad competitiva: 15%

Potencial visual: 15%

Diferenciación: 10%

Compra por impulso: 10%

Economía: 30%

Usa estos porcentajes como guía.

La economía NO debe ignorarse.

============================================================
CLASIFICACIÓN
============================================================

80-100:
PRIORITARIO

70-79:
VALE LA PENA TESTEAR

60-69:
TEST CON PRECAUCIÓN

50-59:
DÉBIL

0-49:
NO PRIORITARIO

============================================================
META ADS
============================================================

Evalúa especialmente:

- Capacidad de explicar el problema y solución.
- UGC.
- Creativos problema-solución.
- Público objetivo.
- Escalabilidad.
- Precio.
- Margen.
- Potencial de conversión.
- Restricciones publicitarias.
- Riesgo de atributos personales.
- Riesgo de claims médicos.

============================================================
TIKTOK ADS
============================================================

Evalúa especialmente:

- Potencial visual.
- Demostración.
- Hook.
- UGC.
- Transformación visual.
- Entretenimiento.
- Capacidad de generar retención.
- Compra impulsiva.
- Facilidad para producir muchos creativos.

============================================================
ECONOMÍA
============================================================

Los siguientes valores calculados por el servidor son DEFINITIVOS:

Margen:
${products.map(p => `${p.productName}: ${p.margin.toFixed(0)} COP`).join("\n")}

CPA máximo:
${products.map(p => `${p.productName}: ${p.maxCPA.toFixed(0)} COP`).join("\n")}

CPA objetivo:
${products.map(p => `${p.productName}: ${p.targetCPA.toFixed(0)} COP`).join("\n")}

ROAS equilibrio:
${products.map(p => `${p.productName}: ${p.breakEvenROAS.toFixed(2)}x`).join("\n")}

NO MODIFIQUES estos valores.

============================================================
PRODUCTOS A INVESTIGAR
============================================================

${block}

============================================================
REGLAS DE RESPUESTA
============================================================

Devuelve ÚNICAMENTE JSON válido.

NO uses markdown.

NO uses bloques de código.

NO agregues explicaciones fuera del JSON.

Todos los campos numéricos deben contener números reales.

Nunca uses:

undefined
null
NaN
""
cuando el campo requiera un número.

Si un dato no puede determinarse con certeza,
utiliza una estimación razonada y explica la incertidumbre
en confidence o en researchNotes.

============================================================
ESTRUCTURA EXACTA
============================================================

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
`;

    // ============================================================
    // 6. LLAMADA A OPENAI
    // ============================================================

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },

        body: JSON.stringify({
          model,

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt,

          temperature: 0.2
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: "OpenAI devolvió un error.",
        status: response.status,
        details: raw.slice(0, 2000)
      });
    }

    // ============================================================
    // 7. PARSEAR RESPUESTA OPENAI
    // ============================================================

    let apiData;

    try {
      apiData = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({
        error: "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 2000)
      });
    }

    let text = "";

    if (
      typeof apiData.output_text === "string" &&
      apiData.output_text.trim()
    ) {
      text = apiData.output_text;
    }

    if (!text && Array.isArray(apiData.output)) {
      for (const item of apiData.output) {

        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {

          if (typeof content?.text === "string") {
            text += content.text;
          }
        }
      }
    }

    text = String(text || "").trim();

    // Eliminar posibles fences de markdown
    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (!text) {
      return res.status(502).json({
        error: "La IA no devolvió contenido.",
        details: raw.slice(0, 2000)
      });
    }

    // ============================================================
    // 8. PARSEAR JSON GENERADO POR LA IA
    // ============================================================

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {

      // Intento adicional: localizar el primer objeto JSON
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");

      if (first >= 0 && last > first) {

        try {
          result = JSON.parse(
            text.slice(first, last + 1)
          );
        } catch (e2) {

          return res.status(502).json({
            error: "La IA no devolvió JSON válido.",
            details: text.slice(0, 3000)
          });
        }

      } else {

        return res.status(502).json({
          error: "La IA no devolvió JSON válido.",
          details: text.slice(0, 3000)
        });
      }
    }

    // ============================================================
    // 9. FUNCIONES DE SEGURIDAD
    // ============================================================

    const number = (value, fallback = 0) => {
      const n = Number(value);

      return Number.isFinite(n)
        ? n
        : fallback;
    };

    const score = (value, min, max) => {
      const n = number(value, min);

      return Math.min(
        max,
        Math.max(min, n)
      );
    };

    const arr = (value) => {
      if (!Array.isArray(value)) return [];

      return value
        .map(x => String(x ?? "").trim())
        .filter(Boolean);
    };

    const cleanUrl = (value) => {
      const url = String(value || "").trim();

      if (!/^https?:\/\//i.test(url)) {
        return "";
      }

      try {
        new URL(url);
        return url;
      } catch {
        return "";
      }
    };

    // ============================================================
    // 10. NORMALIZAR PRODUCTOS
    // ============================================================

    const aiProducts = Array.isArray(result.products)
      ? result.products
      : [];

    const normalizedProducts = products.map(
      (original, index) => {

        const ai =
          aiProducts.find(
            p => Number(p?.id) === Number(original.id)
          ) ||
          aiProducts[index] ||
          {};

        return {

          id: original.id,

          productName:
            String(
              ai.productName ||
              original.productName
            ).trim(),

          overallScore:
            score(ai.overallScore, 0, 100),

          priority:
            String(
              ai.priority ||
              "TEST CON PRECAUCIÓN"
            ).trim(),

          verdict:
            String(
              ai.verdict ||
              "Producto pendiente de validación mediante test."
            ).trim(),

          confidence:
            score(ai.confidence, 0, 100),

          recommendedPlatform:
            String(
              ai.recommendedPlatform ||
              "Meta Ads"
            ).trim(),

          platformReason:
            String(
              ai.platformReason || ""
            ).trim(),

          finalReason:
            String(
              ai.finalReason ||
              ai.summary ||
              ""
            ).trim(),

          summary:
            String(
              ai.summary ||
              ""
            ).trim(),

          demand:
            score(ai.demand, 0, 5),

          competitionOpportunity:
            score(
              ai.competitionOpportunity,
              0,
              5
            ),

          visual:
            score(ai.visual, 0, 5),

          differentiation:
            score(
              ai.differentiation,
              0,
              5
            ),

          impulse:
            score(ai.impulse, 0, 5),

          economicScore:
            score(
              ai.economicScore,
              0,
              100
            ),

          metaScore:
            score(
              ai.metaScore,
              0,
              100
            ),

          tiktokScore:
            score(
              ai.tiktokScore,
              0,
              100
            ),

          // ======================================================
          // ESTOS VALORES SIEMPRE VIENEN DEL SERVIDOR
          // ======================================================

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
            arr(ai.strengths),

          weaknesses:
            arr(ai.weaknesses),

          risks:
            arr(ai.risks),

          angles:
            arr(ai.angles),

          testPlan:
            arr(ai.testPlan)
        };
      }
    );

    // ============================================================
    // 11. ORDENAR RANKING
    // ============================================================

    const sorted =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            b.overallScore -
            a.overallScore
        );

    // ============================================================
    // 12. GANADOR GENERAL
    // ============================================================

    const winner =
      sorted[0] || null;

    // ============================================================
    // 13. GANADOR META
    // ============================================================

    const meta =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            b.metaScore -
            a.metaScore
        )[0] || null;

    // ============================================================
    // 14. GANADOR TIKTOK
    // ============================================================

    const tikTok =
      normalizedProducts
        .slice()
        .sort(
          (a, b) =>
            b.tiktokScore -
            a.tiktokScore
        )[0] || null;

    // ============================================================
    // 15. FUENTES
    // ============================================================

    let sources = [];

    if (Array.isArray(result.sources)) {

      sources = result.sources
        .map(s => {

          const url =
            cleanUrl(s?.url);

          if (!url) return null;

          return {
            title:
              String(
                s?.title ||
                "Fuente consultada"
              ).trim(),

            url,

            note:
              String(
                s?.note ||
                "Fuente utilizada durante la investigación."
              ).trim()
          };
        })
        .filter(Boolean);
    }

    // ============================================================
    // 16. AGREGAR URLs INTRODUCIDAS POR EL USUARIO
    // ============================================================

    for (const p of products) {

      const url = cleanUrl(p.url);

      if (!url) continue;

      const exists =
        sources.some(
          s => s.url === url
        );

      if (!exists) {

        sources.push({
          title:
            `Página proporcionada para ${p.productName}`,

          url,

          note:
            "URL proporcionada por el usuario para complementar la investigación."
        });
      }
    }

    // Máximo 20 fuentes
    sources = sources.slice(0, 20);

    // ============================================================
    // 17. NOTAS DE INVESTIGACIÓN
    // ============================================================

    const researchNotes =
      arr(result.researchNotes);

    if (!researchNotes.length) {

      researchNotes.push(
        "La evaluación combina investigación web, análisis comparativo y economía del producto.",
        "Las puntuaciones representan estimaciones profesionales y no constituyen datos históricos de ventas.",
        "La validación definitiva debe realizarse mediante una campaña controlada."
      );
    }

    // ============================================================
    // 18. RECOMENDACIÓN
    // ============================================================

    let recommendation =
      String(
        result.recommendation || ""
      ).trim();

    if (!recommendation && winner) {

      recommendation =
        `Priorizar ${winner.productName} ` +
        `como primera opción de test. ` +
        `Su puntuación general es ${winner.overallScore}/100.`;
    }

    // ============================================================
    // 19. RESPUESTA FINAL
    // ============================================================

    const finalResult = {

      products: normalizedProducts,

      overallWinner: winner
        ? {
            id: winner.id,
            productName: winner.productName,
            overallScore: winner.overallScore,
            priority: winner.priority,
            recommendedPlatform:
              winner.recommendedPlatform,
            platformReason:
              winner.platformReason,
            finalReason:
              winner.finalReason,
            summary:
              winner.summary,

            margin:
              winner.margin,

            marginPercent:
              winner.marginPercent,

            maxCPA:
              winner.maxCPA,

            targetCPA:
              winner.targetCPA,

            breakEvenROAS:
              winner.breakEvenROAS,

            strengths:
              winner.strengths,

            weaknesses:
              winner.weaknesses,

            risks:
              winner.risks,

            angles:
              winner.angles,

            testPlan:
              winner.testPlan
          }
        : null,

      metaWinner: meta
        ? {
            id: meta.id,
            productName: meta.productName,
            metaScore: meta.metaScore,
            platformReason:
              meta.platformReason
          }
        : null,

      tiktokWinner: tikTok
        ? {
            id: tikTok.id,
            productName: tikTok.productName,
            tiktokScore: tikTok.tiktokScore,
            platformReason:
              tikTok.platformReason
          }
        : null,

      recommendation,

      researchNotes,

      sources
    };

    // ============================================================
    // 20. RESPONDER
    // ============================================================

    return res.status(200).json(finalResult);

  } catch (e) {

    console.error(
      "Research API error:",
      e
    );

    return res.status(500).json({
      error:
        e?.message ||
        "Error interno del servidor."
    });
  }
};
