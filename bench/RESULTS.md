# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por `bench/run_all.sh` el 2026-11-24T23:27:51.635Z.

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
| native | Bishop simplificado | 4340 | 12,69 | 0,0029 | 0,985434380 |
| native | Spencer | 4310 | 101,90 | 0,0236 | 0,984452524 |
| native-parallel | Bishop simplificado | 4340 | 1,72 | 0,0004 | 0,985434380 |
| native-parallel | Spencer | 4310 | 9,82 | 0,0023 | 0,984452524 |
| node-wasm | Bishop simplificado | 4340 | 14,65 | 0,0034 | 0,985434380 |
| node-wasm | Spencer | 4310 | 130,20 | 0,0302 | 0,984452524 |
| chrome-wasm | Bishop simplificado | 4340 | 14,20 | 0,0033 | 0,985434380 |
| chrome-wasm | Spencer | 4310 | 100,30 | 0,0233 | 0,984452524 |

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
| Bishop simplificado | 0,14 | 1,15 | 1,12 |
| Spencer | 0,10 | 1,28 | 0,98 |

## Verificación de FS

Tolerancia relativa de referencia: 1e-9. Referencia: `native`.

| método | target | FS | error relativo | ¿coincide? |
|---|---|---|---|---|
| Bishop simplificado | native-parallel | 0,985434380 | 0.00e+0 | sí |
| Bishop simplificado | node-wasm | 0,985434380 | 0.00e+0 | sí |
| Bishop simplificado | chrome-wasm | 0,985434380 | 0.00e+0 | sí |
| Spencer | native-parallel | 0,984452524 | 0.00e+0 | sí |
| Spencer | node-wasm | 0,984452524 | 1.13e-16 | sí |
| Spencer | chrome-wasm | 0,984452524 | 1.13e-16 | sí |

Resultado del gate de FS: **CUMPLE**.

## Superficies válidas

Número de superficies con FS válido (`valid` de la búsqueda). No es parte del gate, pero debe coincidir entre targets.

| método | native | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|---|
| Bishop simplificado | 2510 | 2510 | 2501 | 2501 |
| Spencer | 2283 | 2283 | 2281 | 2281 |

**Hallazgo:** el número de superficies válidas difiere entre targets (Bishop simplificado, Spencer). El FS del mejor resultado coincide, pero las evaluaciones en el límite de validez no. Causa no verificada; una hipótesis es la diferencia de redondeo de las funciones trigonométricas entre la libm del sistema (nativo) y la de wasm32.

## Datos crudos

`bench/results/*.json` (tiempos por repetición, `evaluated`, `valid` y FS de cada método).
