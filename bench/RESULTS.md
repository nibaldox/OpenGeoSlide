# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por `bench/run_all.sh` el 2026-11-24T23:31:53.197Z.

## Máquina y versiones

| Concepto | Valor |
|---|---|
| CPU | AMD Ryzen 9 9900X 12-Core Processor (12 núcleos, 24 hilos) |
| RAM | 30.5 GiB |
| Rust | rustc 1.97.1 (8bab26f4f 2026-07-14) |
| wasm-bindgen | wasm-bindgen 0.2.130 |
| Node | v22.23.0 |
| Chrome | Google Chrome 158.0.8127.36 (headless) |

## Caso y protocolo

- Caso: `verification/cases/V047a.json` (ACADS 1(a), talud homogéneo seco), `kind = search`:
  búsqueda circular entrada–salida 20 × 20 × 20 con refinamiento, 50 dovelas.
- Método por separado (Bishop y Spencer). Un calentamiento y 5 repeticiones; se reporta la mediana.
- Tiempo medido alrededor de `analyze_json` (JSON de entrada → JSON de salida), igual en los tres targets.
- `native`: `ogs bench` (un hilo, perfil release). `native-parallel`: mismo código con `--features parallel`
  (rayon). `node-wasm`: wasm-bindgen `--target nodejs`. `chrome-wasm`: `/?bench=1` en el worker, con `pnpm preview`.

## Resultados

| target | método | evaluadas | mediana ms | ms/superficie | FS |
|---|---|---|---|---|---|
| native | Bishop simplificado | 4449 | 14,42 | 0,0032 | 0,985171473 |
| native | Spencer | 4499 | 40,74 | 0,0091 | 0,984175887 |
| native-parallel | Bishop simplificado | 4449 | 2,20 | 0,0005 | 0,985171473 |
| native-parallel | Spencer | 4499 | 5,16 | 0,0011 | 0,984175887 |
| node-wasm | Bishop simplificado | 4449 | 18,35 | 0,0041 | 0,985171473 |
| node-wasm | Spencer | 4499 | 49,32 | 0,0110 | 0,984175887 |
| chrome-wasm | Bishop simplificado | 4449 | 16,30 | 0,0037 | 0,985171473 |
| chrome-wasm | Spencer | 4499 | 41,10 | 0,0091 | 0,984175887 |

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
| Bishop simplificado | 0,15 | 1,27 | 1,13 |
| Spencer | 0,13 | 1,21 | 1,01 |

## Verificación de FS

Tolerancia relativa de referencia: 1e-9. Referencia: `native`.

| método | target | FS | error relativo | ¿coincide? |
|---|---|---|---|---|
| Bishop simplificado | native-parallel | 0,985171473 | 0.00e+0 | sí |
| Bishop simplificado | node-wasm | 0,985171473 | 0.00e+0 | sí |
| Bishop simplificado | chrome-wasm | 0,985171473 | 0.00e+0 | sí |
| Spencer | native-parallel | 0,984175887 | 0.00e+0 | sí |
| Spencer | node-wasm | 0,984175887 | 1.13e-16 | sí |
| Spencer | chrome-wasm | 0,984175887 | 1.13e-16 | sí |

Resultado del gate de FS: **CUMPLE**.

## Superficies válidas

Número de superficies con FS válido (`valid` de la búsqueda). No es parte del gate, pero debe coincidir entre targets.

| método | native | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|---|
| Bishop simplificado | 2727 | 2727 | 2727 | 2727 |
| Spencer | 2776 | 2776 | 2776 | 2776 |

Coinciden en todos los targets.

## Datos crudos

`bench/results/*.json` (tiempos por repetición, `evaluated`, `valid` y FS de cada método).
