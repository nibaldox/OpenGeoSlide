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
- 58 `dp_narrow` + 2 `dp_small` en búsqueda convergidas antes y ahora: 54 con el mismo FS y distinto byte (cuentas
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

## 3. E13l-3: escala motriz contra los cuatro criterios

Cantidades medidas por modelo con superficie fija, Spencer (`soil = ΣW`, `W* = ΣW*`, `t = Σ|W*·sen α + H·cos α|`,
`h = Σ|H|`). Solo 8 modelos del repo tienen `max(ΣW, ΣW*) ≠ max(ΣW, t, h)`:

| modelo | ΣW | ΣW* | t | h | escala vieja / candidata |
|---|---|---|---|---|---|
| V018 | 6,3e-5 | 1493 | 827 | 0 | 1,80 |
| V077 | 8,9e-5 | 1028 | 545 | 0 | 1,88 |
| V078 | 8,9e-5 | 1028 | 545 | 0 | 1,88 |
| V081a | 358 | 389 | 270 | 0 | 1,09 |
| V081b | 2110 | 2328 | 1142 | 0 | 1,10 |
| V097a | 2486 | 2586 | 1000 | 0 | 1,04 |
| D12 | 1779 | 1792 | 1060 | 0 | 1,01 |
| D13 | 1108 | 1204 | 597 | 25,9 | 1,09 |

**Candidata del contrato `D = max(ΣW, Σ|t|, Σ|H|)`** (identidad contra el binario sin cambio, 3350 corridas): **15
corridas cambian**: V018 (1), V077 (5), V078 (6) en el 10.º dígito del FS y en λ, y D13 (4, `data_points`) en el 12.º
dígito. Los criterios 3 y 4 sí los cumple (sobrecarga inerte y V068 con carga en el pie) y la mitad horizontal de R10A-03
también. **Incumple el criterio 2** (D13 no es de Prandtl). Es el efecto de cambiar la escala de la tolerancia de Brent y
del cierre en un modelo con cargas que no son inertes (razón vieja/candidata hasta 1,10).

**Alternativa que cumple los cuatro:** `escala = max(D, min(max(ΣW, ΣW*), K·D))`, es decir, se conserva la escala vieja
mientras no pase de `K·D`, y se acota a `K·D` si pasa; `K = 3`. Ventana de `K` medida:
- V018/V077/V078 (razón 1,80–1,88) exigen `K > 1,9` para no cambiar;
- V068 + UDL q = 5000 en el pie plano (`Σ|N'<0|/ΣW = 0,19`) exige `K < 3,8` (0,19/K > 0,05): con `K = 1,5; 2; 3` conserva
  `negative_effective_normal_major`, con `K = 4; 5` lo degrada a nota (como la escala vieja). `K = 3` queda en medio.
- Sobrecarga inerte R10A-03 (suelo no drenado, polilínea con tramo plano, UDL q en `[10, 20]`): FS exacto invariante
  1,68263 (Spencer, λ = −0,1154). Escala vieja: q = 1e8 → 1,70829 (λ = −0,10, `converged`), q = 1e9 → 1,54609 (λ = −0,20,
  `converged`), tol 0,01: q = 1e6 → 1,70829. Con `K = 2, 3, 4` y `D` solo: **1,68263 / −0,1154 para todo q hasta 1e11,
  tol 1e-5 y 0,01.**
- Mitad horizontal de R10A-03 (γ = 1e-6 con carga lineal horizontal 500): Spencer pasa de `no_lambda_root` a converger
  (0,53123 y 0,97845 contra cSlope 0,5312264 y 0,9784504, c = 10 / φ = 0 y c = 20 / φ = 10) porque `Σ|H|` entra en `D`.

**Resultado con `K = 3`:** identidad contra la versión anterior al cambio de escala, **0 corridas de 3350 cambian**
(V018, V077 y V078 quedan byte a byte iguales, porque su razón es < 3). 4 tests en `tests/e13l_scale.rs`, que fallaban
(3 de 4) antes del cambio.
