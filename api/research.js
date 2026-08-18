module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    const input = Array.isArray(req.body?.products)
      ? req.body.products
      : [];

    if (!input.length || input.length > 5) {
      return res.status(400).json({
        error: "Debes enviar entre 1 y 5 productos."
      });
    }

    // ============================================================
    // 1. NORMALIZACIÓN Y CÁLCULOS ECONÓMICOS
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
        margin * (1 - returns / 100)
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
        id: Number(p.id) || i + 1,
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
        breakEvenROAS
      };
    });

    // ============================================================
    // 2. ID DE INVESTIGACIÓN / TRAZABILIDAD
    // ============================================================

    const now = new Date();

    const pad = (n) =>
      String(n).padStart(2, "0");

    const datePart =
      `${now.getUTCFullYear()}${pad(
        now.getUTCMonth() + 1
      )}${pad(now.getUTCDate())}`;

    const timePart =
      `${pad(now.getUTCHours())}${pad(
        now.getUTCMinutes()
      )}${pad(now.getUTCSeconds())}`;

    const randomPart =
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    const researchId =
      `INV-${datePart}-${timePart}-${randomPart}`;

    const researchVersion = "V3.3";

    // ============================================================
    // 3. BLOQUE DE PRODUCTOS
    // ============================================================

    const block = products
      .map(
        (p) => `
PRODUCTO ${p.id}: ${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL DEL USUARIO:
${p.url || "No proporcionada"}

COSTOS:
Costo producto: ${p.cost} COP
Envío: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio de venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

ECONOMÍA CALCULADA POR EL SERVIDOR:
Margen: ${p.margin.toFixed(0)} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo: ${p.maxCPA.toFixed(0)} COP
CPA objetivo: ${p.targetCPA.toFixed(0)} COP
ROAS de equilibrio: ${p.breakEvenROAS.toFixed(2)}
`
      )
      .join("\n");

    // ============================================================
    // 4. PROMPT PRINCIPAL
    // ============================================================

    const prompt = `
Eres un analista profesional de ecommerce,
investigación de mercado y publicidad digital
para Colombia.

OBJETIVO:

Compara TODOS los productos recibidos,
desde 1 hasta 5, utilizando exactamente
los mismos criterios.

Debes determinar:

1. Ganador general.
2. Ganador para Meta Ads.
3. Ganador para TikTok Ads.
4. Economía de cada producto.
5. Fortalezas.
6. Debilidades.
7. Riesgos.
8. Ángulos publicitarios.
9. Plan de prueba.

INVESTIGACIÓN WEB:

Debes utilizar búsqueda web cuando esté disponible.

Para cada producto investiga, cuando exista
información verificable:

- demanda/interés;
- competencia;
- precios;
- presencia en ecommerce;
- contenido y anuncios visibles;
- potencial visual;
- diferenciación;
- compra por impulso;
- riesgos;
- restricciones publicitarias;
- información regulatoria cuando corresponda.

Para suplementos, productos de salud o dispositivos
relacionados con bienestar, prioriza fuentes oficiales
cuando sean pertinentes, por ejemplo:

- INVIMA
- Meta
- TikTok

REGLA FUNDAMENTAL DE TRAZABILIDAD:

NO inventes:

- fuentes;
- URLs;
- ventas;
- CTR;
- CPA históricos;
- ROAS históricos;
- volúmenes de ventas;
- cifras de mercado.

Una afirmación debe clasificarse correctamente como:

- "verified": existe evidencia verificable;
- "inference": es una inferencia razonable derivada de datos;
- "recommendation": es una recomendación estratégica.

Si un dato no puede verificarse,
indícalo claramente y NO lo presentes como hecho.

FUENTES:

En "sources" incluye solamente:

1. URLs realmente encontradas mediante
   la investigación web.

o

2. URLs proporcionadas por el usuario.

NO inventes URLs.

Cada fuente debe tener:

- title
- url
- type
- supports
- note

TIPOS DE FUENTE PERMITIDOS:

- product
- official
- regulatory
- marketplace
- advertising
- social
- news
- research
- other
- user_provided

Si una URL del usuario no pudo ser consultada,
puede aparecer como "user_provided" en "type",
pero debes indicarlo claramente en "note".

IMPORTANTE:

No confundas una URL proporcionada por el usuario
con una fuente independientemente verificada.

PUNTUACIONES:

- demand: 0-5
- competitionOpportunity: 0-5
  5 = oportunidad competitiva favorable
  0 = oportunidad muy desfavorable
- visual: 0-5
- differentiation: 0-5
- impulse: 0-5
- economicScore: 0-100
- metaScore: 0-100
- tiktokScore: 0-100
- overallScore: 0-100

PONDERACIÓN GENERAL:

Demanda: 20%
Oportunidad competitiva: 15%
Visual: 15%
Diferenciación: 10%
Impulso: 10%
Economía: 30%

INTERPRETACIÓN:

80-100 = prioritario
70-79 = vale la pena testear
60-69 = test con precaución
50-59 = débil
0-49 = no prioritario

REGLA ECONÓMICA:

Los valores de:

- margen;
- margen porcentual;
- CPA máximo;
- CPA objetivo;
- ROAS de equilibrio;

calculados por el servidor son los valores oficiales.

No los recalcules ni los sustituyas por estimaciones
de la búsqueda.

CRITERIO DE REDACCIÓN:

El informe debe permitir que una persona tome
una decisión comercial.

Explica brevemente POR QUÉ un producto gana.

No uses lenguaje médico que convierta una inferencia
publicitaria en una afirmación clínica.

PRODUCTOS:

${block}

DEVUELVE ÚNICAMENTE JSON VÁLIDO.

NO uses markdown.

NO escribas texto antes ni después del JSON.

ESTRUCTURA EXACTA:

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
      "testPlan": [],

      "evidence": [
        {
          "claim": "",
          "type": "verified",
          "sourceUrls": []
        }
      ]
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
      "type": "",
      "supports": "",
      "note": ""
    }
  ]
}
`;

    // ============================================================
    // 5. LLAMADA A OPENAI
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
          model:
            process.env.OPENAI_MODEL || "gpt-5",

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió un error.",
        status: response.status,
        details: raw.slice(0, 2000)
      });
    }

    // ============================================================
    // 6. PARSEO DE RESPUESTA
    // ============================================================

    let apiData;

    try {
      apiData = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error:
          "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 2000)
      });
    }

    let text =
      typeof apiData.output_text === "string"
        ? apiData.output_text
        : "";

    if (
      !text &&
      Array.isArray(apiData.output)
    ) {
      for (
        const item of apiData.output
      ) {
        for (
          const c of item.content || []
        ) {
          if (
            typeof c?.text === "string"
          ) {
            text += c.text;
          }
        }
      }
    }

    text = String(text)
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .trim();

    if (!text) {
      return res.status(502).json({
        error:
          "OpenAI no devolvió contenido de análisis.",
        researchId
      });
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "JSON parse error:",
        parseError
      );

      console.error(
        "OpenAI text:",
        text.slice(0, 5000)
      );

      return res.status(502).json({
        error:
          "La IA no devolvió JSON válido.",
        researchId,
        details: text.slice(0, 3000)
      });
    }

    // ============================================================
    // 7. NORMALIZACIÓN Y PROTECCIÓN ECONÓMICA
    // ============================================================

    result.products = (
      Array.isArray(result.products)
        ? result.products
        : []
    ).map((r, i) => {
      const original =
        products.find(
          (p) =>
            Number(p.id) ===
            Number(r.id)
        ) || products[i];

      if (!original) {
        return r;
      }

      return {
        ...r,

        id: original.id,

        productName:
          String(
            r.productName ||
            original.productName
          ),

        // Valores económicos oficiales
        // calculados por el servidor.
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
    });

    // ============================================================
    // 8. COMPLETAR PRODUCTOS OMITIDOS
    // ============================================================

    const existingIds =
      new Set(
        result.products.map(
          (p) => Number(p.id)
        )
      );

    for (
      const original of products
    ) {
      if (
        !existingIds.has(
          Number(original.id)
        )
      ) {
        result.products.push({
          id: original.id,

          productName:
            original.productName,

          overallScore: 0,

          priority:
            "Sin resultado",

          verdict:
            "La IA no devolvió un análisis completo para este producto.",

          confidence: 0,

          recommendedPlatform: "",

          platformReason: "",

          finalReason: "",

          summary: "",

          demand: 0,

          competitionOpportunity: 0,

          visual: 0,

          differentiation: 0,

          impulse: 0,

          economicScore: 0,

          metaScore: 0,

          tiktokScore: 0,

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

          strengths: [],

          weaknesses: [],

          risks: [],

          angles: [],

          testPlan: [],

          evidence: []
        });
      }
    }

    // ============================================================
    // 9. GANADORES CALCULADOS POR SERVIDOR
    // ============================================================

    const sorted =
      result.products
        .slice()
        .sort(
          (a, b) =>
            (Number(
              b.overallScore
            ) || 0) -
            (Number(
              a.overallScore
            ) || 0)
        );

    const meta =
      result.products
        .slice()
        .sort(
          (a, b) =>
            (Number(
              b.metaScore
            ) || 0) -
            (Number(
              a.metaScore
            ) || 0)
        )[0];

    const tik =
      result.products
        .slice()
        .sort(
          (a, b) =>
            (Number(
              b.tiktokScore
            ) || 0) -
            (Number(
              a.tiktokScore
            ) || 0)
        )[0];

    result.overallWinner =
      sorted[0]
        ? {
            ...sorted[0],

            margin:
              sorted[0].margin,

            marginPercent:
              sorted[0].marginPercent,

            maxCPA:
              sorted[0].maxCPA,

            targetCPA:
              sorted[0].targetCPA,

            breakEvenROAS:
              sorted[0].breakEvenROAS
          }
        : null;

    result.metaWinner =
      meta
        ? {
            id: meta.id,

            productName:
              meta.productName,

            metaScore:
              meta.metaScore,

            platformReason:
              meta.platformReason ||
              ""
          }
        : null;

    result.tiktokWinner =
      tik
        ? {
            id: tik.id,

            productName:
              tik.productName,

            tiktokScore:
              tik.tiktokScore,

            platformReason:
              tik.platformReason ||
              ""
          }
        : null;

    // ============================================================
    // 10. FUENTES
    // ============================================================

    const userProvidedUrls =
      products
        .map(
          (p) => p.url
        )
        .filter(
          (url) =>
            /^https?:\/\//i.test(
              url
            )
        );

    const rawSources =
      Array.isArray(
        result.sources
      )
        ? result.sources
        : [];

    const cleanSources = [];

    for (
      const source of rawSources
    ) {
      if (!source) {
        continue;
      }

      const url =
        String(
          source.url || ""
        ).trim();

      if (
        !/^https?:\/\//i.test(
          url
        )
      ) {
        continue;
      }

      cleanSources.push({
        title:
          String(
            source.title ||
            "Fuente sin título"
          ),

        url,

        type:
          String(
            source.type ||
            "other"
          ),

        supports:
          String(
            source.supports ||
            ""
          ),

        note:
          String(
            source.note ||
            ""
          )
      });
    }

    // Añadir URLs proporcionadas
    // por el usuario si no existen.
    for (
      const url of userProvidedUrls
    ) {
      const exists =
        cleanSources.some(
          (s) =>
            s.url === url
        );

      if (!exists) {
        cleanSources.push({
          title:
            "URL proporcionada por el usuario",

          url,

          type:
            "user_provided",

          supports:
            "Página proporcionada como referencia del producto.",

          note:
            "URL proporcionada por el usuario. No implica que la página haya sido verificada independientemente."
        });
      }
    }

    result.sources =
      cleanSources.slice(
        0,
        30
      );

    // ============================================================
    // 11. TRAZABILIDAD
    // ============================================================

    result.research = {
      id: researchId,

      version:
        researchVersion,

      createdAt:
        now.toISOString(),

      productCount:
        products.length,

      products:
        products.map(
          (p) => ({
            id: p.id,

            productName:
              p.productName,

            url:
              p.url || null
          })
        ),

      methodology: {
        webResearch: true,

        economicCalculations:
          "server",

        scoringCriteria: {
          demand: "0-5",

          competitionOpportunity:
            "0-5",

          visual:
            "0-5",

          differentiation:
            "0-5",

          impulse:
            "0-5",

          economicScore:
            "0-100",

          metaScore:
            "0-100",

          tiktokScore:
            "0-100",

          overallScore:
            "0-100"
        },

        generalWeighting: {
          demand: 20,

          competitionOpportunity:
            15,

          visual: 15,

          differentiation: 10,

          impulse: 10,

          economy: 30
        }
      },

      verificationPolicy: {
        sourcesMustBeReal:
          true,

        inventedUrlsAllowed:
          false,

        historicalAdMetricsInvented:
          false,

        salesFiguresInvented:
          false,

        distinctionBetweenFactInferenceRecommendation:
          true
      }
    };

    // ============================================================
    // 12. NOTAS DE INVESTIGACIÓN
    // ============================================================

    if (
      !Array.isArray(
        result.researchNotes
      )
    ) {
      result.researchNotes = [];
    }

    result.researchNotes =
      result.researchNotes
        .map(
          (note) =>
            String(note)
        )
        .filter(Boolean)
        .slice(
          0,
          30
        );

    // ============================================================
    // 13. RESPUESTA FINAL
    // ============================================================

    return res.status(200).json(
      result
    );

  } catch (e) {
    console.error(
      "Research API error:",
      e
    );

    return res.status(500).json({
      error:
        e.message ||
        "Error interno del servidor."
    });
  }
};
