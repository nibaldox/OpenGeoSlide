# Plan del bloque F3B: Hoek-Brown, SHANSEP y búsqueda no circular (formato v0.6, versión v0.5.0)

Plan del coordinador, escrito el 2026-11-27 sobre `main` `0b9c984` (v0.4.0 publicada).

- **Alcance:** lo que `docs/limitaciones.md` §«Lo que queda para la Fase 3b» declara pendiente y
  `briefs/02_CONTRATOS_FASE3.md` dejó fuera de F3a:
  - **Hoek-Brown generalizado** (GSI, mi, D, σci);
  - **SHANSEP** (Su = S·σ′v·OCR^m);
  - **búsqueda no circular** (refinamiento de Celestino y Duncan);
  - el caso publicado de **Hammah et al. (2005b)**.
- **Por qué va antes de Minería.** En `docs/propuesta.md` §6, Hoek-Brown y la búsqueda no circular son entregables
  del **MVP** (fase 1 de la hoja de ruta), que sigue abierto. La fase de Minería (anisotropía y juntas ubicuas,
  Barton-Bandis, pico y residual, Monte Carlo con PoF, retroanálisis) se apoya en las dos: un rajo en roca sin
  Hoek-Brown y sin superficies no circulares no se puede analizar.
- **Contrato normativo:** `briefs/05_CONTRATOS_FASE3B.md`, con las enmiendas **E16**. Lo escribe solo el coordinador,
  después de la exploración.

## 1. Decisiones

Propuestas del coordinador. Se pueden cambiar sin costo hasta que se congele el contrato.

- **D1, formato v0.6 y versión v0.5.0.**
  - Los campos nuevos exigen `"version": "0.6"`.
  - El motor sigue aceptando de 0.1 a 0.5.
  - **Identidad:** un modelo sin campos nuevos da la misma salida, byte a byte, que la v0.4.0, con la versión del
    motor normalizada. No se espera ninguna excepción. Si aparece una, se declara por su nombre en
    `identity_exceptions.json` con su enmienda.
- **D2, orden y cortes.** Las tres capacidades van en paralelo, con dueños de archivo disjuntos:
  - **Hoek-Brown es el núcleo de la versión.** La v0.5.0 no sale sin él.
  - **SHANSEP es corto.** Va en la misma ola.
  - **La búsqueda no circular es el mayor riesgo.** Si en la integración no pasa sus compuertas, sale en una versión
    propia y no retrasa la v0.5.0. Es la misma regla que tuvo Ito-Matsui en F3G (D2 de `PLAN_GRIETA_AGUA.md`).
- **D3, Hoek-Brown en equilibrio límite** (se confirma con X25 y X28):
  - c y φ **instantáneos** (tangentes) en la σ′n de la base de cada dovela, con la fórmula cerrada de Hoek,
    Carranza-Torres y Corkum (2002), corregida de Balmer;
  - **iterados con F**, porque σ′n = N′/l depende de F. Es lo que hacen cSlope, OGR y Slide2;
  - **no** un ajuste Mohr-Coulomb equivalente en un rango de σ3;
  - qué hacer con σ′n ≤ 0 (tracción) lo fija el prototipo contra el oráculo;
  - el aviso de Hoek (1990) va en la Ayuda y en `limitaciones.md`: la cohesión tangente puede ser una cota superior
    y dar resultados optimistas.
- **D4, búsqueda no circular por refinamiento local** (se confirma con X24 y X29):
  - parte de los mejores círculos de la búsqueda circular, convertidos en polilíneas;
  - mueve los vértices por variación alterna (Celestino y Duncan, 1981), como cSlope;
  - es determinista: semilla fija y desempate por (FS, índice);
  - **Bishop no se ofrece en polilíneas** (F3.6 sigue vigente). La búsqueda minimiza Spencer, Morgenstern-Price o
    Janbu;
  - path search, recocido simulado o enjambre de partículas quedan para después, salvo que X24 muestre que algún caso
    publicado los necesita.
- **D5, ruteo de agentes (decisión del usuario, 2026-11-27):**

  | Rol | Agente | Modelo |
  |---|---|---|
  | Exploración y prototipos, solo lectura | Haiku | `anthropic` / `claude-haiku-5-5` |
  | Código, tests y fixtures | Terra | `openai-codex` / `gpt-6.1-terra` |
  | Revisión adversarial | Antigravity | `agy --mode plan`, `gemini-4-neon-high` |
  | Plan, contrato, arbitraje, gates e integración | coordinador | Claude Opus |

  - Las tres rutas se comprobaron el 2026-11-27 con una respuesta real: Terra y `agy` respondieron «OK».
  - Terra reemplaza a Sonnet como escritor en este bloque.
  - Coordinador (Claude), escritores (GPT) y revisor (Gemini) quedan en tres familias distintas, así que la revisión
    sigue siendo independiente.
- **D6, publicación.** Ningún push, tag ni Release sin el «sube» explícito del usuario para la v0.5.0.

## 2. Qué desbloquea

Cifras preliminares. **X23 las mide** con el oráculo y las reemplaza.

| Capacidad | Casos que hoy no entran | Fuente |
|---|---|---|
| Búsqueda no circular | V001, V034a, V034b, V036a, V036c, V036d y otros con `nonCircularOptimization` | `verification/pending/F3/INDEX.md`, «Checks descartados» |
| SHANSEP | V105a a V105d. Estaban bloqueados por agua embalsada, que ya existe desde la v0.4.0, y por `waternet` o `earlierStage` | X10 §Resumen |
| Hoek-Brown | Hammah et al. (2005b), ejemplo 1 (GSI 5, mi 2, D 0, σci 30 MPa, 10 m a 45°; SSR 1,15; Bishop 1,153 y Spencer 1,152 por fuente secundaria) | X10 §Resumen |
| Hoek-Brown, diferencial | Modelos sintéticos de rajo con Hoek-Brown, ogs contra cSlope en búsqueda y en círculo fijo (bloque D43 en adelante) | nuevo |

cSlope no tiene casos de verificación de equilibrio límite con Hoek-Brown (X13 §Resumen). Por eso Hoek-Brown se
verifica con tres piezas:
1. el caso publicado de Hammah;
2. la batería diferencial contra el oráculo;
3. identidades propias:
   - con `a = 0,5` y `s = 1`, Hoek-Brown se reduce al criterio original de Hoek-Brown (1980);
   - c y φ instantáneos reproducen la envolvente en cada σ′n;
   - el resultado es simétrico en espejo.

## 3. Física (se congela con X25, X26, X28 y X29)

- **Hoek-Brown generalizado** (Hoek et al., 2002):
  - `mb = mi·exp((GSI − 100)/(28 − 14D))`, `s = exp((GSI − 100)/(9 − 3D))`,
    `a = 1/2 + (e^(−GSI/15) − e^(−20/3))/6`;
  - c y φ instantáneos en σ′n, por la fórmula cerrada con su número de ecuación tomado de la fuente primaria;
  - una iteración de punto fijo en F con la ley de resistencia actualizada por dovela. Su tolerancia y la regla de
    promedio las mide X28 contra cSlope (X13 dice 30 pasadas, tolerancia 1e-4 y promedio de c y tanφ);
  - σci en `ucs`, en la unidad de esfuerzo del modelo (kPa o psf). La web convierte desde MPa.
- **SHANSEP:**
  - `Su = S·σ′v·OCR^m`, con `σ′v = (W + cargas)/b − u` en la base;
  - las fuentes de OCR y su prioridad están en X11 §1.3: `pop`, `yield_stress`, `ocr_by_elevation` y `ocr`;
  - `su_min` como piso;
  - qué subconjunto entra en el formato lo decide X26.
- **Búsqueda no circular:**
  - las semillas son los N mejores círculos;
  - la conversión a polilínea, el número de vértices y los pasos los fija X29;
  - la admisibilidad es la misma que la de las polilíneas fijas (F3.6 y E13l), más lo que X24 encuentre sobre
    cinemática, como una base que se vuelve sobre sí misma.
- **Criterios de aceptación** de cada capacidad nueva (`slope-stability-lem-engine` §3):
  - neutralidad;
  - equilibrio global con residuo menor que 1e-6;
  - oráculo dentro de 0,1 % en círculo fijo;
  - espejo;
  - monotonía.

  Para la búsqueda no circular se agregan:
  - `FS_ogs ≤ 1,01·FS_cSlope`;
  - los publicados dentro de su tolerancia, con un 2 % como mínimo en búsqueda;
  - el FS refinado nunca es mayor que el de su semilla.

## 4. Olas

| Ola | Contenido | Agentes |
|---|---|---|
| **X** | Exploración en paralelo, un archivo de hallazgos por tema:<br>**X23**, oráculo y casos;<br>**X24**, búsqueda no circular;<br>**X25**, Hoek-Brown;<br>**X26**, SHANSEP;<br>**X27**, motor, formato y web. Brief: `briefs/F3B_exploracion.md`. | 5 Haiku |
| **XP** | Prototipos contra el oráculo, sobre las dovelas del motor, con las filas de aceptación (entrada JSON y cifra del oráculo):<br>**X28**, Hoek-Brown;<br>**X29**, refinamiento no circular.<br>Corren en paralelo con B0. | 2 Haiku |
| **Contrato** | `briefs/05_CONTRATOS_FASE3B.md` (E16). Las secciones de física quedan `[condicional X28/X29]` hasta que lleguen los prototipos. | coordinador |
| **B0** | Tipos y esquema 0.6, regla de versión mínima, despacho de materiales con stubs (`todo!()` solo con el campo presente), stub de la búsqueda no circular y tests RED a partir de las filas de X28 y X29. Va a `f3b-integracion`, nunca a `main`. | 1 Terra |
| **B1** | **M-HB:** `hoek_brown.rs` y la actualización de la resistencia por iteración en `methods/`.<br>**M-SH:** `shansep.rs` y σ′v en el slicer.<br>**M-NC:** el refinamiento no circular (módulo propio) y su enganche en `search.rs`.<br>**V:** el conversor, la importación a `pending/F3B`, el caso de Hammah y el bloque diferencial con Hoek-Brown.<br>**W1:** el panel de materiales (Hoek-Brown con la calculadora de mb, s y a; SHANSEP), las opciones de búsqueda, la entrada y salida, y la validación.<br>**W2:** el lienzo (la polilínea crítica y sus semillas), el informe PDF, el CSV, la Ayuda y los avisos. | 6 Terra |
| **B2** | Integración: promoción de casos, identidad contra la v0.4.0, la documentación con las cifras medidas, el CHANGELOG consolidado por el coordinador, todos los gates y la regresión completa de Chrome. | 2 Terra |
| **R15** | Revisión adversarial en dos lentes:<br>**A**, matemática, datos y contratos;<br>**B**, propagación de errores a la web, el PDF, el CSV y Python, más la lente de quien firma un informe de rajo con la herramienta.<br>Después, las olas de corrección y las revisiones de cierre R16 en adelante hasta el APTO. | 2 `agy` + Terra |
| **v0.5.0** | Commit de versión con todos los gates en verde. **Se espera el «sube»** antes de cualquier push. | 1 Terra + coordinador |

Reglas de las olas (las de `delegated-codebase-orchestration` y `slope-stability-lem-engine`):
- un worktree por escritor en `~/archivos/opengeoslide-wt/`, con su lista de archivos propios y protegidos, su commit
  y la prohibición de push;
- ningún escritor edita `CHANGELOG.md`; cada uno propone sus líneas en el informe;
- un solo dueño para el manifiesto y el lockfile de la web;
- puertos: 5182 a 5187 para los escritores que necesiten `vite preview`, 5188 y 5189 para la revisión, y 5180 para
  el coordinador;
- un escritor que no logra un criterio se detiene y lo informa con cifras; no ajusta tolerancias ni cambia casos;
- todo hallazgo CRITICAL o HIGH del revisor lo reproduce el coordinador con el binario y lo arbitra contra el oráculo
  antes de escribir la enmienda.

## 5. Gates

Después de cada merge en `f3b-integracion`, y otra vez en el commit de versión:
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`, y la aceptación con
  `--nocapture`;
- el harness contra el oráculo y la batería diferencial;
- la identidad contra el binario de la v0.4.0 con `--normalize-version --include-reinforced`, con 0 diferencias;
- `pytest -q verification` y los tests de `ogs-py`;
- `pnpm test` con y sin `OGS_BIN`, `tsc --noEmit` y `pnpm build`;
- la regresión completa de Chrome (`full_regression.sh`) cuando cambia la web.

Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| La iteración de Hoek-Brown no converge, o converge a raíces distintas según el método | X28 la prototipa sobre las dovelas del motor antes del contrato. El contrato fija el estado `NotConverged` y su código. |
| σ′n ≤ 0 en dovelas de la cresta, donde Hoek-Brown no está definido en tracción | Regla medida contra el oráculo en X28, con aviso. Nunca un FS convergido con resistencia no finita. |
| La búsqueda no circular encuentra superficies cinemáticamente inadmisibles con un FS bajo | Admisibilidad de E13l más los hallazgos de X24, y la lente B de R15 dedicada a eso. |
| No hay casos publicados de equilibrio límite con Hoek-Brown, salvo Hammah | Batería diferencial contra cSlope e identidades propias, declaradas en `verificacion.md`. |
| Las unidades de σci (MPa en la práctica, kPa en el modelo) dan un error de 1000× | La web convierte y muestra la unidad. La validación avisa si σci queda fuera del rango típico para la unidad del modelo. |
| La búsqueda no circular se alarga | D2: sale en una versión propia sin frenar la v0.5.0. |

## 7. Preguntas abiertas para la exploración

- ¿Qué hace cSlope con σ′n ≤ 0 en Hoek-Brown, y qué hacen Slide2 y OGR? (X25)
- ¿Qué subconjunto de SHANSEP entra (OCR constante, por cota, POP, `yield_stress`, `su_min`), y lo desbloquea algún
  caso publicado? (X23 y X26)
- ¿Cuántos vértices, qué pasos y cuántas semillas usa cSlope en `nonCircularOptimization`, y alcanzan para los
  publicados dentro de tolerancia? (X24 y X29)
- ¿Necesita alguno de los publicados una búsqueda no circular global (path o bloque) en vez de un refinamiento?
  (X23 y X24)
- ¿Tiene datos primarios completos el caso de Hammah et al. (2005b), y hay otros casos publicados de equilibrio límite
  con Hoek-Brown, como los problemas de verificación de Slide2? (X23 y X25)
