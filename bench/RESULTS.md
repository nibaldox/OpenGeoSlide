# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por `bench/run_all.sh` el 2026-11-25T00:06:16.960Z.

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
| native | Bishop simplificado | 4449 | 19,56 | 0,0044 | 0,985170167 |
| native | Spencer | 4506 | 54,60 | 0,0121 | 0,984175473 |
| native-parallel | Bishop simplificado | 4449 | 2,64 | 0,0006 | 0,985170167 |
| native-parallel | Spencer | 4506 | 6,43 | 0,0014 | 0,984175473 |
| node-wasm | Bishop simplificado | 4449 | 23,72 | 0,0053 | 0,985170167 |
| node-wasm | Spencer | 4506 | 67,88 | 0,0151 | 0,984175473 |
| chrome-wasm | Bishop simplificado | 4449 | 20,40 | 0,0046 | 0,985170167 |
| chrome-wasm | Spencer | 4506 | 56,90 | 0,0126 | 0,984175473 |

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
| Bishop simplificado | 0,13 | 1,21 | 1,04 |
| Spencer | 0,12 | 1,24 | 1,04 |

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
| Bishop simplificado | 3089 | 3089 | 3089 | 3089 |
| Spencer | 3145 | 3145 | 3145 | 3145 |

Coinciden en todos los targets.

## Datos crudos

`bench/results/*.json` (tiempos por repetición, `evaluated`, `valid` y FS de cada método).
