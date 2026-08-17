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

    const body = req.body || {};

    /*
     * ============================================================
     * 1. NORMALIZAR PRODUCTOS
     * ============================================================
     *
     * El sistema acepta:
     *
     * A) Nuevo formato:
     * {
     *   products: [...]
     * }
     *
     * B) Formato antiguo:
     * {
     *   productName: "...",
     *   cost: ...
     * }
     *
     * Esto permite que la aplicación siga funcionando durante
     * la transición.
     */

    let products = [];

    if (Array.isArray(body.products)) {
      products = body.products;
    } else if (
      body.productName ||
      body.product ||
      body.name
    ) {
      products = [body];
    }

    if (!Array.isArray(products) || products.length < 1) {
      return res.status(400).json({
        error: "Debes introducir al menos un producto."
      });
    }

    if (products.length > 5) {
      return res.status(400).json({
        error: "Puedes analizar máximo 5 productos."
      });
    }

    /*
     * ============================================================
     * 2. NORMALIZAR Y VALIDAR CADA PRODUCTO
     * ============================================================
     */

    const normalizedProducts = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i] || {};

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

      const cost = Number(
        p.cost ?? 0
      );

      const shipping = Number(
        p.shipping ?? 0
      );

      const otherCosts = Number(
        p.otherCosts ??
        p.other ??
        0
      );

      const salePrice = Number(
        p.salePrice ??
        p.price ??
        0
      );

      const returns = Number(
        p.returns ?? 0
      );

      if (!productName) {
        return res.status(400).json({
          error: `Falta el nombre del producto ${i + 1}.`
        });
      }

      if (
        !Number.isFinite(cost) ||
        cost <= 0
      ) {
        return res.status(400).json({
          error: `El costo del producto ${i + 1} debe ser mayor que cero.`
        });
      }

      if (
        !Number.isFinite(salePrice) ||
        salePrice <= 0
      ) {
        return res.status(400).json({
          error: `El precio de venta del producto ${i + 1} debe ser mayor que cero.`
        });
      }

      if (
        !Number.isFinite(shipping) ||
        shipping < 0
      ) {
        return res.status(400).json({
          error: `El envío del producto ${i + 1} no es válido.`
        });
      }

      if (
        !Number.isFinite(otherCosts) ||
        otherCosts < 0
      ) {
        return res.status(400).json({
          error: `Los otros costos del producto ${i + 1} no son válidos.`
        });
      }

      if (
        !Number.isFinite(returns) ||
        returns < 0 ||
        returns > 100
      ) {
        return res.status(400).json({
          error: `El porcentaje de devoluciones del producto ${i + 1} no es válido.`
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

      const maxCPA =
        Math.max(
          0,
          margin * (1 - returns / 100)
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

      normalizedProducts.push({
        id: i + 1,
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
      });
    }

    /*
     * ============================================================
     * 3. INFORMACIÓN PARA LA IA
     * ============================================================
     */

    const productInfo = normalizedProducts
      .map((p) => {
        return `
PRODUCTO ${p.id}
Nombre: ${p.productName}

Descripción:
${p.description || "No proporcionada"}

URL:
${p.url || "No proporcionada"}

Costo producto: ${p.cost} COP
Envío asumido: ${p.shipping} COP
Otros costos: ${p.otherCosts} COP
Precio de venta: ${p.salePrice} COP
Devoluciones/no recibidos: ${p.returns}%

Economía calculada:
Margen: ${p.margin} COP
Margen porcentual: ${p.marginPercent.toFixed(2)}%
CPA máximo: ${p.maxCPA.toFixed(0)} COP
CPA objetivo: ${p.targetCPA.toFixed(0)} COP
ROAS de equilibrio: ${p.breakEvenROAS.toFixed(2)}x
`;
      })
      .join("\n-----------------------------\n");

    /*
     * ============================================================
     * 4. PROMPT PRINCIPAL
     * ============================================================
     */

    const prompt = `
Actúa como un analista senior de productos para ecommerce,
dropshipping y publicidad digital en Colombia.

Estamos construyendo un Detector de Producto Ganador.

Debes analizar ${normalizedProducts.length} producto(s).

OBJETIVO:

Determinar cuáles productos tienen mayor potencial para ser
probados con publicidad pagada y seleccionar:

1. GANADOR GENERAL
2. GANADOR PARA META ADS
3. GANADOR PARA TIKTOK ADS

IMPORTANTE:

- No inventes ventas reales.
- No inventes datos de mercado como si fueran datos comprobados.
- Cuando no exista información verificable, utiliza lenguaje de estimación.
- Evalúa cada producto individualmente.
- Compara los productos entre sí.
- Considera la economía unitaria.
- Considera el potencial de los creativos.
- Considera la facilidad de demostrar el producto.
- Considera la fuerza del problema que resuelve.
- Considera compra por impulso.
- Considera competencia.
- Considera diferenciación.
- Considera riesgos.
- Considera especialmente ecommerce en Colombia.
- No favorezcas un producto solamente porque tenga mayor margen.
- Un producto con menor margen puede ganar si tiene mejor potencial publicitario.
- Meta Ads debe evaluarse considerando Facebook e Instagram.
- TikTok Ads debe evaluarse considerando contenido visual, UGC,
  demostración, transformación y potencial viral.
- La puntuación debe ser de 0 a 100.

REGLA DE DECISIÓN:

80-100 = PRODUCTO PRIORITARIO
70-79 = VALE LA PENA TESTEAR
60-69 = TEST CON PRECAUCIÓN
50-59 = PRODUCTO DÉBIL
0-49 = NO PRIORITARIO

CRITERIOS:

DEMANDA:
1 = muy baja
2 = baja
3 = media
4 = alta
5 = muy alta

COMPETENCIA:
1 = muy baja/favorable
2 = baja
3 = media
4 = alta
5 = muy alta/desfavorable

POTENCIAL VISUAL:
1 = difícil de demostrar
2 = poco visual
3 = visual medio
4 = buen potencial
5 = excelente potencial

DIFERENCIACIÓN:
1 = producto completamente comoditizado
2 = poca diferenciación
3 = diferenciación moderada
4 = buena diferenciación
5 = muy fácil construir propuesta diferente

IMPULSO:
1 = compra racional/lenta
2 = poco impulso
3 = impulso medio
4 = buen impulso
5 = fuerte compra por impulso

PRODUCTOS:

${productInfo}

Analiza todos los productos y compáralos.

Para seleccionar los ganadores considera:

GANADOR GENERAL:
El mejor equilibrio entre demanda, competencia, visual,
diferenciación, impulso y economía.

GANADOR META ADS:
El producto que tenga mejor potencial para Facebook e Instagram,
especialmente para demostraciones, UGC, problema-solución y
segmentación amplia.

GANADOR TIKTOK ADS:
El producto con mayor potencial para contenido corto,
demostración visual, transformación, sorpresa, UGC y
retención.

Devuelve exclusivamente los datos solicitados en el esquema JSON.
`;

    /*
     * ============================================================
     * 5. ESQUEMA DE RESPUESTA
     * ============================================================
     */

    const schema = {
      type: "object",
      additionalProperties: false,

      properties: {
        products: {
          type: "array",
          minItems: 1,
          maxItems: 5,

          items: {
            type: "object",
            additionalProperties: false,

            properties: {
              id: {
                type: "integer"
              },

              productName: {
                type: "string"
              },

              score: {
                type: "number"
              },

              confidence: {
                type: "number"
              },

              decision: {
                type: "string"
              },

              recommendedPlatform: {
                type: "string"
              },

              margin: {
                type: "number"
              },

              marginPercent: {
                type: "number"
              },

              maxCPA: {
                type: "number"
              },

              targetCPA: {
                type: "number"
              },

              breakEvenROAS: {
                type: "number"
              },

              demand: {
                type: "integer"
              },

              competition: {
                type: "integer"
              },

              visual: {
                type: "integer"
              },

              differentiation: {
                type: "integer"
              },

              impulse: {
                type: "integer"
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
              },

              sources: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: {
                      type: "string"
                    },
                    url: {
                      type: "string"
                    }
                  },
                  required: [
                    "title",
                    "url"
                  ]
                }
              }
            },

            required: [
              "id",
              "productName",
              "score",
              "confidence",
              "decision",
              "recommendedPlatform",
              "margin",
              "marginPercent",
              "maxCPA",
              "targetCPA",
              "breakEvenROAS",
              "demand",
              "competition",
              "visual",
              "differentiation",
              "impulse",
              "summary",
              "strengths",
              "weaknesses",
              "risks",
              "angles",
              "testPlan",
              "researchNotes",
              "sources"
            ]
          }
        },

        overallWinner: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "integer"
            },
            productName: {
              type: "string"
            }
          },
          required: [
            "id",
            "productName"
          ]
        },

        metaWinner: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "integer"
            },
            productName: {
              type: "string"
            }
          },
          required: [
            "id",
            "productName"
          ]
        },

        tiktokWinner: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "integer"
            },
            productName: {
              type: "string"
            }
          },
          required: [
            "id",
            "productName"
          ]
        },

        recommendation: {
          type: "string"
        },

        researchNotes: {
          type: "array",
          items: {
            type: "string"
          }
        },

        sources: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string"
              },
              url: {
                type: "string"
              }
            },
            required: [
              "title",
              "url"
            ]
          }
        }
      },

      required: [
        "products",
        "overallWinner",
        "metaWinner",
        "tiktokWinner",
        "recommendation",
        "researchNotes",
        "sources"
      ]
    };

    /*
     * ============================================================
     * 6. LLAMADA A OPENAI
     * ============================================================
     */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5";

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

          input: prompt,

          text: {
            format: {
              type: "json_schema",
              name: "product_winner_analysis",
              strict: true,
              schema
            }
          }
        })
      }
    );

    const raw = await response.text();

    /*
     * ============================================================
     * 7. ERROR DE OPENAI
     * ============================================================
     */

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

    let openaiData;

    try {
      openaiData = JSON.parse(raw);
    } catch (error) {
      console.error(
        "Respuesta de OpenAI no JSON:",
        raw
      );

      return res.status(502).json({
        error: "OpenAI devolvió una respuesta inesperada.",
        details: raw.slice(0, 1500)
      });
    }

    /*
     * ============================================================
     * 8. EXTRAER TEXTO DE RESPONSES API
     * ============================================================
     */

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
      for (
        const item of openaiData.output
      ) {
        if (
          !Array.isArray(item.content)
        ) {
          continue;
        }

        for (
          const content of item.content
        ) {
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

    /*
     * ============================================================
     * 9. PARSEAR JSON
     * ============================================================
     */

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
        "JSON inválido recibido del modelo:",
        text
      );

      /*
       * Intento adicional:
       * localizar el primer objeto JSON completo.
       */

      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (
        firstBrace !== -1 &&
        lastBrace > firstBrace
      ) {
        try {
          result = JSON.parse(
            text.slice(
              firstBrace,
              lastBrace + 1
            )
          );
        } catch (secondError) {
          return res.status(502).json({
            error:
              "La IA no devolvió JSON válido.",
            details:
              text.slice(0, 1500)
          });
        }
      } else {
        return res.status(502).json({
          error:
            "La IA no devolvió JSON válido.",
          details:
            text.slice(0, 1500)
        });
      }
    }

    /*
     * ============================================================
     * 10. NORMALIZAR RESULTADO
     * ============================================================
     */

    if (
      !result ||
      !Array.isArray(result.products)
    ) {
      return res.status(502).json({
        error:
          "La IA devolvió una estructura de análisis inesperada."
      });
    }

    /*
     * Garantizamos que los valores económicos calculados
     * por nuestra aplicación no sean reemplazados por valores
     * inventados por el modelo.
     */

    for (
      const product of result.products
    ) {
      const original =
        normalizedProducts.find(
          p => p.id === product.id
        );

      if (!original) {
        continue;
      }

      product.productName =
        original.productName;

      product.margin =
        original.margin;

      product.marginPercent =
        original.marginPercent;

      product.maxCPA =
        original.maxCPA;

      product.targetCPA =
        original.targetCPA;

      product.breakEvenROAS =
        original.breakEvenROAS;
    }

    /*
     * ============================================================
     * 11. DEVOLVER RESULTADO
     * ============================================================
     */

    return res.status(200).json(result);

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
