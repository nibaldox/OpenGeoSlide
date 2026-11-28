# Robustez de la búsqueda global frente a la semilla (A2b)

A2b (E17b) pide que V053 pase la banda publicada (1,01 ± 3,5 %, es decir FS ≤ 1,04535) con la semilla 0 **y** con al menos 44 de las
semillas 0 a 47, con los valores por defecto (`generated` 500).

## Cómo se mide

- `python verification/global/run.py --steps robust` (con el Python del oráculo): 48 semillas en V053 y S2, Spencer, `global: {"seed": s}`.
  Es el paso `robust` de `run.py`; sus cifras entran a `REPORT.md` y `REPORT.json`.
- `robustez.py --bin <binario> --variant <nombre>` repite el barrido sobre un binario compilado de una variante y guarda
  `<variante>.jsonl` y `<variante>-summary.json` (se usó para escoger la variante de E17c). Los tiempos de ese script son contra el
  circular de V053 y S2 y se miden con 2 trabajos en paralelo: son informativos; la compuerta A7 la mide `run.py` con corridas secuenciales.

## Resultado con el motor final

| Modelo | Semillas en la banda | Mínimo | Mediana | Máximo | Semilla 0 | Gana `global` |
|---|---:|---:|---:|---:|---:|---:|
| V053 | 48/48 | 1.0029 | 1.0077 | 1.0239 | 1.0103 | 48/48 |
| S2 | — | 0.7416 | 0.7588 | 0.8051 | 0.7505 | 48/48 |

La búsqueda de cSlope da 1,0061 en V053 y 0,7156 en S2. El mínimo de V053 (1,0029) queda 0,3 % por debajo del de cSlope; la polilínea ganadora de la semilla 0 evaluada en cSlope difiere 0,02 % del FS de Rust (A2).

## Variantes que se midieron

Todas con 48 semillas en V053 y S2. La columna «razón» es el tiempo con `global` sobre el circular (mediana / máximo).
**Las variantes 1 a 9 y 11 de Terra no dejaron descripción** (se cortó por cuota): solo se conservan sus cifras. La variante 10 es la de Halton con la
semilla como desplazamiento del índice (E17c, «Hallazgo»), y `variante10-rotada` la que agrega la rotación de Cranley-Patterson.
La lectura que sí es firme está en E17c: con la semilla como desplazamiento del índice, las 48 semillas dan casi el mismo conjunto de
puntos (filas con una sola cifra mínima = máxima) y A2b no mide nada; con la rotación, la robustez depende de que las proyecciones del
bloque no den cuñas pasivas de 45° a 90°.

| Variante | V053 en la banda | V053 mín / mediana / máx | V053 semilla 0 | S2 mediana | Razón de costo |
|---|---:|---|---:|---:|---|
| variante1 | 29 | 1.0069 / 1.0334 / 1.0847 | 1.0615 | 0.7839 | 4.18 / 5.00 |
| variante2 | 48 | 1.0311 / 1.0311 / 1.0311 | 1.0311 | 0.7756 | 4.77 / 4.90 |
| variante3 | 0 | 1.0600 / 1.0619 / 1.0619 | 1.0619 | 0.7756 | 3.26 / 3.32 |
| variante4 | 48 | 1.0311 / 1.0311 / 1.0311 | 1.0311 | 0.7756 | 4.71 / 4.80 |
| variante5 | 0 | 1.0619 / 1.0619 / 1.0619 | 1.0619 | 0.7741 | 2.71 / 2.72 |
| variante6 | 0 | 1.0619 / 1.0619 / 1.0619 | 1.0619 | 0.7756 | 2.99 / 3.10 |
| variante7 | 48 | 1.0297 / 1.0297 / 1.0297 | 1.0297 | 0.7733 | 4.58 / 4.67 |
| variante8 | 48 | 1.0310 / 1.0310 / 1.0310 | 1.0310 | 0.7733 | 4.09 / 4.16 |
| variante9 | 48 | 1.0316 / 1.0316 / 1.0316 | 1.0316 | 0.7748 | 3.84 / 3.94 |
| variante10 | 48 | 1.0289 / 1.0289 / 1.0289 | 1.0289 | 0.7597 | 3.04 / 3.09 |
| variante10-rotada | 16 | 1.0047 / 1.0588 / 1.0847 | 1.0289 | 0.7822 | 2.86 / 3.68 |
| **E17c (la elegida)** | **48** | 1.0029 / 1.0077 / 1.0239 | 1.0103 | 0.7588 | 3.01 / 3.77 |

La fila de E17c sale de `e17c-summary.json` (medida del coordinador); la de `run.py` con el motor final da las mismas cifras de FS.

## Qué queda de las variantes

Los archivos `variante*.jsonl`, `variante*-summary.json` y `measurements.jsonl` eran del experimento y no se conservan: esta tabla es lo
que sirve de ellos. `e17c.jsonl`, `e17c-summary.json` y `variante10-rotada-summary.json` (del coordinador) se mantienen.
