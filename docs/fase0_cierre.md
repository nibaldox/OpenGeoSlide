# Cierre de la Fase 0 (spike) de OpenGeoSlide

**Fecha:** 2026-11-25 · **Base del cierre:** `4666ba7` (merge W11 + reportes regenerados).

## Veredicto
La Fase 0 queda **cerrada para uso de prueba**.
- La última revisión adversarial independiente, R4 con Antigravity sobre el commit `114b99b`, dio
  **APROBADO_CON_RESERVAS**, con 0 hallazgos CRITICAL y 0 HIGH.
- Los hallazgos MEDIUM que se podían corregir barato se cerraron en W11. El resto está documentado en el README como
  limitaciones conocidas.

## Qué se entregó
- **Motor `ogs-core` (Rust):** geometría y dovelas, Bishop simplificado, Spencer (GLE con f = 1, momentos de Zhu, raíz
  de λ admisible de menor |λ|) y búsqueda circular de entrada-salida con refinamiento. Ejecución serial y paralela,
  bit a bit idénticas.
- **Salidas:** CLI `ogs`, WASM para la web, Python (`opengeoslide`, wheel abi3).
- **Web (React/Vite):** se ejecuta en el navegador con el motor WASM en un worker. Incluye 16 casos de ejemplo,
  verificación frente al valor publicado y medición de rendimiento.
- **Verificación:** 16 casos publicados (ACADS y otros) y una batería diferencial de 10 casos de minería y obra civil
  frente al oráculo cSlope (MIT), con superficie fija y con búsqueda.
- **Contrato normativo** (`briefs/00_CONTRATOS.md`): la evolución E1-E11 queda documentada con la evidencia que
  sostiene cada decisión.

## Números verificados por el coordinador (estado final)

| Verificación | Resultado |
|---|---|
| Tests `ogs-core`, serial y paralelo | 126 pasan, 0 fallan (1 ignorado: perf) |
| Aceptación frente a valores publicados | **38/38** checks en 16 casos |
| cSlope reproduce los mismos checks | 38/38 |
| Batería diferencial frente a cSlope | **búsqueda 20/20 · fija 20/20** |
| Tests Python (verificación) | 150 pasan |
| Tests web (Vitest) y build | 58/58, build OK |
| Wheel Python | 13 pasan, 2 omitidos |
| Bench V047a (mediana, nativo / Chrome) | Bishop 51 / 53 ms · Spencer 178 / 185 ms; FS idéntico en todos los targets |
| Clippy `-D warnings` y fmt | limpio |

## Revisiones adversariales (Antigravity, solo lectura y fuera del espacio de trabajo)

| Ronda | Commit | Veredicto | Lo que destapó |
|---|---|---|---|
| R1 | `ece7f99` | RECHAZADO | Polo negativo de Spencer (FS 0,23 frente a 0,31), m_α de Bishop, aire en λ |
| R2 | `70ee56a` | RECHAZADO | Equilibrio de momentos con dovelas aéreas, presión de poros alta en Bishop, Spencer frente a Bishop |
| R3 | `005044d` | RECHAZADO | Raíz λ < 0 espuria, admisibilidad relajada (+233 %), `min_width` eludido por truncamiento |
| R4 | `114b99b` | **APROBADO_CON_RESERVAS** | Selección de raíz entre signos (MEDIUM) y avisos de bloques truncados (MEDIUM) |

Cada hallazgo CRITICAL o HIGH se reprodujo con el binario y se arbitró contra el oráculo en el mismo círculo antes de
aceptarlo. Así se resolvieron, a favor de la evidencia y no de la intuición, las contradicciones entre rondas: R1-02
frente a R2-01, D03 y D09.

## Backlog de la Fase 1 (priorizado)
1. **R4-01:** desempate físico de la raíz de Spencer cuando coexisten raíces admisibles de distinto signo. Estudio
   frente a cSlope sobre la familia bicapa (1008 casos), conservando D03.
2. **Búsqueda con restricción de frontera** (`min_width` y rangos efectivos, E11d′).
3. **R4-02:** subdivisión adaptativa del paso de λ.
4. **R4-03a:** propagar `truncated_driving_mass` desde los candidatos truncados de la búsqueda.
5. **Cobertura:** casos con `unit_weight_sat`, superficies no circulares (bloque o polilínea), cargas, sismo
   pseudoestático y refuerzos.
6. **Producto:**
   - editor gráfico de geometría y materiales en la web;
   - importación DXF y CSV;
   - informe PDF;
   - empaquetado de escritorio (Tauri);
   - publicación en GitHub Pages, PyPI y crates.io.
7. **Comunidad:** documentación de teoría y validación, guía de contribución y casos de minería aportados por usuarios.

## Advertencia
Este es software en desarrollo. Los resultados no sustituyen el criterio profesional del ingeniero geotécnico, que
sigue siendo responsable de la interpretación y del diseño.
