# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por `bench/run_all.sh` el 2026-11-25T02:53:01.299Z.

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
| native | Bishop simplificado | 8562 | 42,36 | 0,0049 | 0,985130064 |
| native | Spencer | 8587 | 108,88 | 0,0127 | 0,984148811 |
| native-parallel | Bishop simplificado | 8562 | 4,69 | 0,0005 | 0,985130064 |
| native-parallel | Spencer | 8587 | 11,45 | 0,0013 | 0,984148811 |
| node-wasm | Bishop simplificado | 8562 | 52,84 | 0,0062 | 0,985130064 |
| node-wasm | Spencer | 8587 | 135,29 | 0,0158 | 0,984148811 |
| chrome-wasm | Bishop simplificado | 8562 | 44,00 | 0,0051 | 0,985130064 |
| chrome-wasm | Spencer | 8587 | 111,50 | 0,0130 | 0,984148811 |

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
| Bishop simplificado | 0,11 | 1,25 | 1,04 |
| Spencer | 0,11 | 1,24 | 1,02 |

## Verificación de FS

Tolerancia relativa de referencia: 1e-9. Referencia: `native`.

| método | target | FS | error relativo | ¿coincide? |
|---|---|---|---|---|
| Bishop simplificado | native-parallel | 0,985130064 | 0.00e+0 | sí |
| Bishop simplificado | node-wasm | 0,985130064 | 1.13e-16 | sí |
| Bishop simplificado | chrome-wasm | 0,985130064 | 1.13e-16 | sí |
| Spencer | native-parallel | 0,984148811 | 0.00e+0 | sí |
| Spencer | node-wasm | 0,984148811 | 1.13e-16 | sí |
| Spencer | chrome-wasm | 0,984148811 | 1.13e-16 | sí |

Resultado del gate de FS: **CUMPLE**.

## Superficies válidas

Número de superficies con FS válido (`valid` de la búsqueda). No es parte del gate, pero debe coincidir entre targets.

| método | native | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|---|
| Bishop simplificado | 6453 | 6453 | 6453 | 6453 |
| Spencer | 6427 | 6427 | 6427 | 6427 |

Coinciden en todos los targets.

## Datos crudos

`bench/results/*.json` (tiempos por repetición, `evaluated`, `valid` y FS de cada método).
