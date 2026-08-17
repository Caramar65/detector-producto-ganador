// /api/research.js
// Detector de Producto Ganador V3.3
// API robusta para 1-5 productos
// Investigación web + análisis económico + ranking Meta/TikTok

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ---------------------------------------------------------
  // 1. MÉTODO
  // ---------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido. Usa POST."
    });
  }

  try {
    // -------------------------------------------------------
    // 2. API KEY
    // -------------------------------------------------------

    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    // -------------------------------------------------------
    // 3. LEER BODY
    // -------------------------------------------------------

    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({
          error: "El servidor recibió un JSON inválido."
        });
      }
    }

    const input = Array.isArray(body?.products)
      ? body.products
      : [];

    if (!input.length) {
      return res.status(400).json({
        error: "Debes enviar al menos 1 producto."
      });
    }

    if (input.length > 5) {
      return res.status(400).json({
        error: "El máximo permitido es de 5 productos."
      });
    }

    // -------------------------------------------------------
    // 4. NORMALIZAR PRODUCTOS
    // -------------------------------------------------------

    const products = input.map((p, i) => {

      const productName = String(
        p?.productName ||
        p?.product ||
        p?.name ||
        ""
      ).trim();

      const description = String(
        p?.description || ""
      ).trim();

      const url = String(
        p?.url || ""
      ).trim();

      const cost = Number(p?.cost);
      const shipping = Number(p?.shipping || 0);
      const otherCosts = Number(p?.otherCosts || 0);
      const salePrice = Number(p?.salePrice);
      const returns = Number(p?.returns || 0);

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

      // -----------------------------------------------------
      // ECONOMÍA REAL DEL PRODUCTO
      // -----------------------------------------------------

      const margin =
        salePrice -
        cost -
        shipping -
        otherCosts;

      const marginPercent =
        salePrice > 0
          ? (margin / salePrice) * 100
          : 0;

      const maxCPA =
        Math.max(
          0,
          margin * (1 - safeReturns / 100)
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

      return {
        id: Number(p?.id) || i + 1,
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

    // -------------------------------------------------------
    // 5. BLOQUE DE PRODUCTOS PARA LA IA
    // -------------------------------------------------------

    const block = products
      .map((p) => {

        return `
PRODUCTO ${p.id}

Nombre:
${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL proporcionada por el usuario:
${p.url || "No proporcionada"}

COSTOS:
Costo producto: ${p.cost} COP
Envío: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

ECONOMÍA CALCULADA:
Margen: ${p.margin.toFixed(0)} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo: ${p.maxCPA.toFixed(0)} COP
CPA objetivo: ${p.targetCPA.toFixed(0)} COP
ROAS de equilibrio: ${p.breakEvenROAS.toFixed(2)}x
`;
      })
      .join("\n---------------------------\n");

    // -------------------------------------------------------
    // 6. PROMPT
    // -------------------------------------------------------

    const prompt = `
Eres un analista senior de ecommerce, productos ganadores,
marketing digital y publicidad para el mercado colombiano.

Tu trabajo es investigar y comparar TODOS los productos recibidos.

IMPORTANTE:

Hay ${products.length} producto(s).

Debes analizar EXACTAMENTE esos ${products.length} productos.
No debes inventar productos adicionales.
No debes eliminar ninguno.

====================================================
INVESTIGACIÓN
====================================================

USA LA BÚSQUEDA WEB cuando esté disponible.

Investiga para cada producto:

1. Demanda / interés del mercado.
2. Competencia.
3. Nivel de oportunidad frente a la competencia.
4. Precios observables en Colombia.
5. Presencia en marketplaces.
6. Potencial para anuncios.
7. Potencial visual.
8. Potencial UGC.
9. Compra por impulso.
10. Diferenciación.
11. Riesgos.
12. Posibles restricciones publicitarias.

Para suplementos, productos de bienestar,
dispositivos relacionados con salud o productos
con afirmaciones sanitarias:

- Consulta fuentes oficiales cuando sea pertinente.
- Prioriza INVIMA.
- Prioriza políticas oficiales de Meta.
- Prioriza políticas oficiales de TikTok.
- No inventes registros sanitarios.
- No inventes aprobaciones.
- No inventes resultados clínicos.

====================================================
FUENTES
====================================================

Las fuentes son MUY IMPORTANTES.

Incluye en "sources" solamente:

A. URLs que hayas podido obtener de la búsqueda web.
B. URLs proporcionadas por el usuario.

NO INVENTES URLs.

Cada fuente debe contener:

{
  "title": "",
  "url": "",
  "note": ""
}

Si no existe una fuente verificable, deja sources como [].

No inventes fuentes para llenar el campo.

====================================================
NO INVENTAR DATOS
====================================================

No inventes:

- ventas
- número de clientes
- CTR
- CPA histórico
- ROAS histórico
- volumen exacto de búsquedas
- facturación
- número de anuncios
- conversiones
- tamaño exacto del mercado

Si un dato no está disponible,
usa una inferencia cualitativa razonable.

Diferencia claramente entre:

DATOS VERIFICABLES

e

INFERENCIAS DEL ANÁLISIS.

====================================================
PUNTUACIONES
====================================================

Asigna:

demand: 0-5

competitionOpportunity: 0-5

IMPORTANTE:
5/5 significa una oportunidad competitiva favorable,
NO significa que no exista competencia.

visual: 0-5

differentiation: 0-5

impulse: 0-5

economicScore: 0-100

metaScore: 0-100

tiktokScore: 0-100

overallScore: 0-100

confidence: 0-100

====================================================
PONDERACIÓN GENERAL
====================================================

Usa aproximadamente:

Demanda: 20%
Competencia/oportunidad: 15%
Visual: 15%
Diferenciación: 10%
Impulso: 10%
Economía: 30%

La economía debe tener un peso importante.

====================================================
INTERPRETACIÓN
====================================================

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

====================================================
META ADS
====================================================

Evalúa especialmente:

- amplitud de audiencia
- facilidad de explicar el producto
- potencial UGC
- problema-solución
- facilidad de producir creativos
- capacidad de generar confianza
- riesgo de políticas

====================================================
TIKTOK ADS
====================================================

Evalúa especialmente:

- potencial visual
- demostración
- transformación observable
- hooks
- UGC
- entretenimiento
- facilidad para crear contenido nativo

====================================================
ECONOMÍA
====================================================

NO modifiques los siguientes valores calculados
por el servidor:

margin
marginPercent
maxCPA
targetCPA
breakEvenROAS

Debes conservarlos exactamente.

====================================================
GANADOR
====================================================

Selecciona:

1. Ganador general.
2. Ganador Meta Ads.
3. Ganador TikTok Ads.

Puede ser el mismo producto.

No estás obligado a elegir productos diferentes.

====================================================
RECOMENDACIÓN
====================================================

La recomendación debe ser práctica.

Debe indicar:

- qué producto probar primero
- plataforma
- por qué
- cómo comenzar
- qué validar
- principales riesgos

====================================================
ÁNGULOS
====================================================

Genera varios ángulos publicitarios realistas.

No hagas promesas médicas.

====================================================
PLAN DE TEST
====================================================

Genera un plan práctico para probar el producto.

Debe considerar:

- creativos
- hooks
- UGC
- audiencias
- plataforma
- métricas
- criterio de pausa
- criterio de escalamiento

====================================================
PRODUCTOS A ANALIZAR
====================================================

${block}

====================================================
FORMATO DE RESPUESTA
====================================================

Devuelve ÚNICAMENTE un objeto JSON válido.

NO uses markdown.

NO uses:
\`\`\`json

NO agregues texto antes o después.

La estructura debe ser:

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

    // -------------------------------------------------------
    // 7. FUNCIÓN PARA LLAMAR OPENAI
    // -------------------------------------------------------

    async function callOpenAI(useWebSearch = true) {

      const model =
        process.env.OPENAI_MODEL ||
        "gpt-5.6";

      const requestBody = {
        model,
        input: prompt
      };

      // -----------------------------------------------
      // BÚSQUEDA WEB
      // -----------------------------------------------

      if (useWebSearch) {
        requestBody.tools = [
          {
            type: "web_search"
          }
        ];
      }

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },

          body: JSON.stringify(requestBody)
        }
      );

      const raw = await response.text();

      let data = null;

      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = null;
      }

      // -----------------------------------------------
      // ERROR REAL DE OPENAI
      // -----------------------------------------------

      if (!response.ok) {

        let message =
          data?.error?.message ||
          data?.message ||
          "OpenAI devolvió un error.";

        const type =
          data?.error?.type || "";

        const code =
          data?.error?.code || "";

        const detail =
          [
            type ? `tipo=${type}` : "",
            code ? `codigo=${code}` : "",
            message
          ]
            .filter(Boolean)
            .join(" | ");

        const error = new Error(detail);

        error.status = response.status;
        error.raw = raw;

        throw error;
      }

      return data;
    }

    // -------------------------------------------------------
    // 8. PRIMER INTENTO
    // -------------------------------------------------------

    let apiData;

    try {

      apiData = await callOpenAI(true);

    } catch (firstError) {

      console.error(
        "Primer intento OpenAI:",
        firstError
      );

      // ---------------------------------------------------
      // SEGUNDO INTENTO
      // ---------------------------------------------------

      try {

        apiData = await callOpenAI(false);

      } catch (secondError) {

        console.error(
          "Segundo intento OpenAI:",
          secondError
        );

        return res.status(
          secondError.status >= 400 &&
          secondError.status < 600
            ? secondError.status
            : 502
        ).json({

          error: "OpenAI no pudo procesar la investigación.",

          details:
            secondError.message ||
            "Error desconocido.",

          firstAttempt:
            firstError.message || "",

          hint:
            "Revisa OPENAI_API_KEY, OPENAI_MODEL, créditos de la API y disponibilidad del modelo."
        });
      }
    }

    // -------------------------------------------------------
    // 9. EXTRAER TEXTO
    // -------------------------------------------------------

    let text = "";

    if (
      apiData &&
      typeof apiData.output_text === "string"
    ) {
      text = apiData.output_text;
    }

    // Fallback para diferentes estructuras
    if (
      !text &&
      Array.isArray(apiData?.output)
    ) {

      for (const item of apiData.output) {

        if (
          Array.isArray(item?.content)
        ) {

          for (const content of item.content) {

            if (
              typeof content?.text === "string"
            ) {
              text += content.text;
            }

          }
        }
      }
    }

    text = String(text || "").trim();

    // -------------------------------------------------------
    // 10. LIMPIAR MARKDOWN
    // -------------------------------------------------------

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // -------------------------------------------------------
    // 11. EXTRAER JSON SI VIENE CON TEXTO EXTRA
    // -------------------------------------------------------

    function extractJSON(value) {

      const first =
        value.indexOf("{");

      const last =
        value.lastIndexOf("}");

      if (
        first >= 0 &&
        last > first
      ) {
        return value.slice(
          first,
          last + 1
        );
      }

      return value;
    }

    text = extractJSON(text);

    // -------------------------------------------------------
    // 12. PARSEAR JSON
    // -------------------------------------------------------

    let result;

    try {

      result = JSON.parse(text);

    } catch (e) {

      console.error(
        "JSON inválido recibido de OpenAI:",
        text.slice(0, 5000)
      );

      return res.status(502).json({

        error:
          "La IA respondió, pero el resultado no pudo convertirse en JSON.",

        details:
          text.slice(0, 3000)
      });
    }

    // -------------------------------------------------------
    // 13. VALIDACIÓN DE PRODUCTOS
    // -------------------------------------------------------

    if (
      !Array.isArray(result.products)
    ) {
      result.products = [];
    }

    // -------------------------------------------------------
    // 14. RECONSTRUIR DATOS ECONÓMICOS
    // -------------------------------------------------------

    result.products =
      products.map((original, index) => {

        const ai =
          result.products.find(
            x =>
              Number(x?.id) ===
              Number(original.id)
          ) ||
          result.products[index] ||
          {};

        return {

          ...ai,

          id: original.id,

          productName:
            ai.productName ||
            original.productName,

          // ECONOMÍA DEL SERVIDOR
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

          // NORMALIZAR PUNTUACIONES
          overallScore:
            Number(ai.overallScore) || 0,

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

          confidence:
            Number(ai.confidence) || 0,

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
      });

    // -------------------------------------------------------
    // 15. ORDENAR
    // -------------------------------------------------------

    const sorted =
      result.products
        .slice()
        .sort(
          (a, b) =>
            Number(b.overallScore) -
            Number(a.overallScore)
        );

    // -------------------------------------------------------
    // 16. GANADOR GENERAL
    // -------------------------------------------------------

    const winner =
      sorted[0] || null;

    if (winner) {

      result.overallWinner = {

        ...winner,

        id: winner.id,

        productName:
          winner.productName,

        overallScore:
          winner.overallScore,

        priority:
          winner.priority || "",

        recommendedPlatform:
          winner.recommendedPlatform || "",

        platformReason:
          winner.platformReason || "",

        finalReason:
          winner.finalReason ||
          winner.summary ||
          "",

        summary:
          winner.summary || "",

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
      };

    } else {

      result.overallWinner = null;

    }

    // -------------------------------------------------------
    // 17. GANADOR META
    // -------------------------------------------------------

    const metaWinner =
      result.products
        .slice()
        .sort(
          (a, b) =>
            Number(b.metaScore) -
            Number(a.metaScore)
        )[0];

    if (metaWinner) {

      result.metaWinner = {

        id:
          metaWinner.id,

        productName:
          metaWinner.productName,

        metaScore:
          metaWinner.metaScore,

        platformReason:
          metaWinner.platformReason ||
          ""
      };

    } else {

      result.metaWinner = null;

    }

    // -------------------------------------------------------
    // 18. GANADOR TIKTOK
    // -------------------------------------------------------

    const tiktokWinner =
      result.products
        .slice()
        .sort(
          (a, b) =>
            Number(b.tiktokScore) -
            Number(a.tiktokScore)
        )[0];

    if (tiktokWinner) {

      result.tiktokWinner = {

        id:
          tiktokWinner.id,

        productName:
          tiktokWinner.productName,

        tiktokScore:
          tiktokWinner.tiktokScore,

        platformReason:
          tiktokWinner.platformReason ||
          ""
      };

    } else {

      result.tiktokWinner = null;

    }

    // -------------------------------------------------------
    // 19. RECOMENDACIÓN
    // -------------------------------------------------------

    result.recommendation =
      typeof result.recommendation === "string"
        ? result.recommendation
        : "";

    // -------------------------------------------------------
    // 20. NOTAS DE INVESTIGACIÓN
    // -------------------------------------------------------

    result.researchNotes =
      Array.isArray(result.researchNotes)
        ? result.researchNotes
        : [];

    // -------------------------------------------------------
    // 21. FUENTES
    // -------------------------------------------------------

    result.sources =
      Array.isArray(result.sources)
        ? result.sources
            .filter(
              s =>
                s &&
                /^https?:\/\//i.test(
                  String(s.url || "")
                )
            )
            .map(s => ({
              title:
                String(
                  s.title || "Fuente"
                ),

              url:
                String(s.url),

              note:
                String(
                  s.note || ""
                )
            }))
            .slice(0, 20)
        : [];

    // -------------------------------------------------------
    // 22. RESPUESTA FINAL
    // -------------------------------------------------------

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      "Research API error:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Error interno del servidor.",

      details:
        process.env.NODE_ENV === "development"
          ? String(error?.stack || "")
          : undefined
    });
  }
};
