# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por `bench/run_all.sh` el 2026-11-25T00:56:14.746Z.

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
| native | Bishop simplificado | 4449 | 19,83 | 0,0045 | 0,985170167 |
| native | Spencer | 4506 | 95,22 | 0,0211 | 0,984175473 |
| native-parallel | Bishop simplificado | 4449 | 3,28 | 0,0007 | 0,985170167 |
| native-parallel | Spencer | 4506 | 10,96 | 0,0024 | 0,984175473 |
| node-wasm | Bishop simplificado | 4449 | 24,68 | 0,0055 | 0,985170167 |
| node-wasm | Spencer | 4506 | 115,40 | 0,0256 | 0,984175473 |
| chrome-wasm | Bishop simplificado | 4449 | 21,30 | 0,0048 | 0,985170167 |
| chrome-wasm | Spencer | 4506 | 92,00 | 0,0204 | 0,984175473 |

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
| Bishop simplificado | 0,17 | 1,24 | 1,07 |
| Spencer | 0,12 | 1,21 | 0,97 |

## Verificación de FS

Tolerancia relativa de referencia: 1e-9. Referencia: `native`.

| método | target | FS | error relativo | ¿coincide? |
|---|---|---|---|---|
| Bishop simplificado | native-parallel | 0,985170167 | 0.00e+0 | sí |
| Bishop simplificado | node-wasm | 0,985170167 | 1.13e-16 | sí |
| Bishop simplificado | chrome-wasm | 0,985170167 | 1.13e-16 | sí |
| Spencer | native-parallel | 0,984175473 | 0.00e+0 | sí |
| Spencer | node-wasm | 0,984175473 | 5.64e-16 | sí |
| Spencer | chrome-wasm | 0,984175473 | 5.64e-16 | sí |

Resultado del gate de FS: **CUMPLE**.

## Superficies válidas

Número de superficies con FS válido (`valid` de la búsqueda). No es parte del gate, pero debe coincidir entre targets.

| método | native | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|---|
| Bishop simplificado | 2839 | 2839 | 2839 | 2839 |
| Spencer | 2896 | 2896 | 2896 | 2896 |

Coinciden en todos los targets.

## Datos crudos

`bench/results/*.json` (tiempos por repetición, `evaluated`, `valid` y FS de cada método).
