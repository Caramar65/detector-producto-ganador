# Metodología de Evaluación — Detector de Producto Ganador

## Propósito

El Detector de Producto Ganador es una herramienta de apoyo a la decisión para productos físicos. Investiga el contexto comercial y publicitario, calcula la economía del producto y prioriza cuál producto merece una prueba inicial y en qué plataforma presenta mejores condiciones.

La herramienta **no garantiza ventas, rentabilidad ni aprobación publicitaria**. Una puntuación alta significa que el producto presenta una combinación más favorable de factores para ser probado, no que vaya a vender necesariamente.

## Variables y ponderación

La puntuación general utiliza una ponderación fija de 100 puntos:

| Variable | Peso |
|---|---:|
| Demanda | 20% |
| Oportunidad competitiva | 15% |
| Potencial visual | 15% |
| Diferenciación | 10% |
| Impulso de compra | 10% |
| Economía | 20% |
| Mejor plataforma | 10% |
| **Total** | **100%** |

Las cinco variables cualitativas son evaluadas por la IA en una escala de 1 a 5. Para el cálculo final se convierten de forma lineal a 0–100 mediante:

`(puntuación - 1) / 4 × 100`

Así, 1/5 equivale a 0 puntos de contribución y 5/5 equivale a 100 puntos de contribución.

## Economía

La economía parte de datos introducidos por el usuario y no de una estimación de la IA:

- margen = precio de venta − costo − envío − otros costos;
- margen porcentual = margen / precio de venta × 100;
- margen ajustado = margen × (1 − devoluciones/no recibidos %);
- CPA máximo = margen ajustado;
- CPA objetivo = CPA máximo × 55%;
- ROAS de equilibrio = precio de venta / margen, cuando el margen es positivo.

Para la puntuación económica se utiliza el margen porcentual ajustado. Un margen ajustado del 50% representa el nivel de referencia de 100/100:

`score económico = margen ajustado % / 50 × 100`, limitado al rango 0–100.

Esta regla busca premiar productos que conservan suficiente margen después del efecto estimado de devoluciones/no recibidos y, por tanto, dejan espacio para adquirir clientes mediante publicidad.

## Selección de plataforma

La IA proporciona una evaluación de adecuación para Meta Ads y TikTok Ads. El motor determinista no permite que la IA decida directamente el ganador general.

- `metaScore` y `tiktokScore` se mantienen en escala 0–100.
- La mejor plataforma es la de mayor puntuación.
- La mayor de ambas puntuaciones aporta el 10% correspondiente a plataforma en la puntuación general.
- En caso de empate, se prioriza Meta Ads.

El ganador de Meta Ads es siempre el producto con mayor `metaScore` y el ganador de TikTok Ads es siempre el producto con mayor `tiktokScore`.

## Fórmula final

La puntuación final se calcula exclusivamente en servidor después de recibir la investigación estructurada:

`Score = Demanda×0.20 + Competencia×0.15 + Visual×0.15 + Diferenciación×0.10 + Impulso×0.10 + Economía×0.20 + MejorPlataforma×0.10`

El **ganador general** es el producto con el mayor `overallScore` calculado por esta fórmula.

Esto evita que la IA pueda elegir arbitrariamente un ganador distinto de los resultados numéricos.

## Rangos de interpretación

- **80–100:** Producto prioritario
- **70–79:** Vale la pena testear
- **60–69:** Test con precaución
- **50–59:** Producto débil
- **0–49:** No prioritario

## Investigación y trazabilidad

La IA investiga demanda, competencia, precios/ofertas, contenido, potencial visual, diferenciación, impulso y riesgos cuando dispone de búsqueda web. Las afirmaciones importantes deben acompañarse de evidencia y fuentes verificables.

La aplicación diferencia entre hechos verificables, inferencias y recomendaciones. No debe inventar ventas, volumen de búsqueda, CTR, CPA históricos, cuotas de mercado u otras cifras privadas de terceros.

Las URLs proporcionadas por el usuario pueden utilizarse para verificar características, presentación, precio y oferta, pero no constituyen por sí mismas evidencia independiente de demanda.

## Riesgo y productos regulados

Para suplementos, productos de salud y dispositivos se deben considerar fuentes oficiales, requisitos regulatorios y restricciones publicitarias cuando corresponda. Una oportunidad comercial puede quedar condicionada por riesgos regulatorios o por las políticas de la plataforma.

## Por qué los pesos son expertos y no estadísticos

Los pesos actuales son una **ponderación experta diseñada para la decisión de prueba publicitaria de productos físicos**. No se presentan como pesos obtenidos mediante machine learning ni como coeficientes estadísticos entrenados con un histórico propio de campañas.

La siguiente evolución metodológica será calibrar estos pesos utilizando resultados reales de campañas: CPA, ROAS, conversión, devoluciones y escalabilidad. Hasta disponer de un conjunto suficiente de datos propios, mantener una fórmula fija, explícita y auditable es metodológicamente más transparente que afirmar una precisión estadística inexistente.

## Principio de decisión

El Detector no responde únicamente "qué producto es bueno". Busca responder:

> **¿Cuál de los productos analizados presenta actualmente la combinación más favorable de oportunidad de mercado, capacidad publicitaria, diferenciación, impulso y economía para justificar una prueba, y en qué plataforma presenta mejores condiciones iniciales?**

---

**Versión metodológica:** 1.1  
**Motor de puntuación:** cálculo determinista en servidor  
**Investigación:** IA + búsqueda web + evidencia y fuentes  