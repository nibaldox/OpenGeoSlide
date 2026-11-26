# R10 M1b: notas de medición (E13l-3 y E13l-4)

Base de identidad: `694f13a` (f3a-integracion), binario release en un worktree detached. Script: `ident_r10.py`
(3350 corridas: 93 casos + pending + D01–D23 + acads1a; bishop, spencer, janbu s/c, M-P por defecto, constant,
half_sine, clipped_sine, trapezoidal y tres data_points; superficie fija o búsqueda, más círculo crítico fijo y polilínea
inscrita).

## 1. Medición de `bea90d1` (E13l-4 tal como llegó) contra `694f13a`

- 3350 corridas, **529 difieren**, todas `morgenstern_price` con `data_points`: `dp_narrow` 272, `dp_small` (máx 1e-3) 256,
  `dp_ramp` 1 (D09 fijo: λ 1,0148290331364727 → …304575; FS en el 13.º dígito).
- **Las cinco funciones estándar (por defecto, constant, half_sine, clipped_sine, trapezoidal) no cambian ni una:
  0 corridas.** Las «16 corridas» de V018/V077/V078/D13 que se atribuyeron a E13l-4 son del candidato de escala
  E13l-3 (`ident_s1.json`), no de E13l-4. La hipótesis de f_max ≠ 1 exacto no aplica: `function_scale` devuelve 1 para
  las funciones con nombre y el código no las toca.
- Causa de los 437 cambios `< 1e-9` y del de `dp_ramp`: la rejilla fina **agrega** puntos a la rejilla vieja cuando
  `f̄ < f_max/2` (D09 tiene caras aéreas con f = 0 en el pie, así que `f̄ < f_max/2` aun con máximo 1); Brent refina
  brackets más cortos y llega a otra raíz en el 10.º–13.º dígito. Cambios `≥ 1e-6`: 6 corridas, todas de **búsqueda**
  (gana otra superficie porque ahora convergen candidatas que antes eran `no_lambda_root`).

## 2. E13l-4 corregido: dos pasadas

Cambio en `morgenstern_price::solve`. **Pasada 1 = esquema de E13d sin tocar** (rejilla `0,05/f̄`, `f` sin normalizar,
`fine = false`). Si converge, ese es el resultado, byte a byte, sea cual sea la escala de `f`. Solo si no converge y la
función es `data_points`, **pasada 2**: `f/f_max`, rejilla `0,05/max(f̄, f_max/2)` más los puntos de la rejilla vieja, y
`λ = λ_n/f_max` al informar; si la pasada 2 tampoco converge se devuelve el resultado de la pasada 1 (el viejo). Las
funciones con nombre no entran a la pasada 2.

Identidad contra `694f13a` (3350 corridas, mismo script): **62 difieren (antes 529)**, todas `data_points` en
**búsqueda** (60) o polilínea inscrita (2):
- 58 `dp_narrow` + 2 `dp_small` en búsqueda convergidas antes y ahora: 52 con el mismo FS y distinto byte (cuentas
  `evaluated/valid` de la búsqueda, una superficie que antes era `no_lambda_root` ahora es válida); 6 ganan otra
  superficie (V030 1,2482→1,2154; V032b 0,9756→0,9514; V034b 1,1417→1,0161; V102a 0,99967→0,99985; D02 0,3877→0,3843;
  D09 0,8260→0,4603);
- 2 polilíneas (V032b, V102a, `dp_narrow`): `not_converged` → `converged` (1,0511 y 1,0068).
- **0 corridas de superficie fija o círculo crítico fijo cambian** (ni `dp_ramp` de D09, ni ninguna función con nombre,
  ni `data_points` que ya convergía).

Casos de R10A-08 con el CLI final:
1. D10 con pico `[0,8; 0,9; 1,0]`: no converge → 1,047929 (cSlope 1,047543, +0,04 %).
2. D10 con el pico `[0,88; 0,9; 0,92]` de R10A-08: **sigue `not_converged (no_lambda_root)`**. La raíz de momentos existe
   (FS ≈ 1,048, λ = 2,83, cSlope 1,047735, con avisos de tracción) pero la admisibilidad E11b rechaza `λ·f` ≥ 2,4 con
   `min_m_alpha = 0,2`. Con `min_m_alpha` 0,1 sigue sin converger; con 0,05 y 0,01 converge a 1,048127 (+0,04 % sobre cSlope,
   con `negative_effective_normal_major` e `interslice_shear_exceeds_strength`). No se relaja el umbral.
3. V047a `1e-300`: converge (λ = 6,498e299, la pasada 1 lo conserva idéntico).
4. V047a `1e-310`: `λ = λ_n/s` = 6,5e309 no cabe en un f64: **`invalid (non_finite)`**, ya no `λ = None` con `converged`.
5. Pico entre fronteras (`f̄ = 0`): `invalid (no_lambda_root)`, sin pasada 2 posible; un código propio
   (p. ej. `interslice_no_support`) exigiría E6, web y py; se deja como propuesta.
