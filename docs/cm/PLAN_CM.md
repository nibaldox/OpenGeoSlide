# Plan del bloque CM: cierre del MVP

Plan del coordinador, escrito el 2026-11-27 sobre `main` `1d1d097` (v0.5.1 publicada). Rama de integración
`cm-integracion`, worktree `~/archivos/opengeoslide-wt/cm-int`.

## 0. Por qué este bloque

`docs/propuesta.md` §6 define el MVP (fase 1 de la hoja de ruta) con estos entregables y compuertas. Tras la v0.5.1
quedan abiertos:

| Ítem del MVP | Estado en v0.5.1 | Qué falta |
|---|---|---|
| Búsqueda no circular «path + recocido simulado» | Solo hay un refinamiento local (variación alterna de Celestino y Duncan) desde 3 círculos, sin pulido final (`limitaciones.md` §«Búsqueda no circular (v0.6)») | Una búsqueda **global** no circular y el pulido final |
| Compuerta «primer FS de un usuario nuevo en < 5 min» | Nunca se midió. Existe la guía de primera visita (`src/onboarding/`) | Un protocolo y una medición |
| Calidad de la web | Known issues de la 0.5.0 (borradores) y de la 0.5.1 (pantallas ≤ 640 px, HUD a 800 × 600, 2 guiones e2e en rojo) | Corregirlos |
| Harness «contra cSlope/xslope» (fase 0) | Solo cSlope | Evaluar xslope e integrarlo si es viable |

Además hay 10 checks no circulares del corpus de cSlope, en 8 casos, que **nunca se midieron**: V036c, V036d, V039
(2), V041a, V041b, V051, V053 y V098 (`verification/pending/F3B/INDEX.md` §«Otros casos con búsqueda no circular»).
Son la vara principal de la búsqueda global.

## 1. Decisiones

Son propuestas del coordinador y se pueden cambiar sin costo hasta que se congele el contrato.

- **D1, dos frentes con un solo destino.**
  - **Frente W (web y compuerta):** borradores, pantallas bajas, HUD, guiones e2e y la medición de los 5 minutos. No
    depende del motor y arranca apenas termine X34.
  - **Frente NC (búsqueda global no circular):** exploración, prototipo, contrato, olas y revisión.
  - Los dos se integran en `cm-integracion`. **Si NC no pasa sus compuertas, W sale solo** como parche (`0.5.2`) y NC
    tendrá su propia versión, la misma regla de D2 en `PLAN_FASE3B.md`.
- **D2, formato y versión.** Si la búsqueda global necesita campos nuevos, van en el **formato v0.7** y la versión es
  `0.6.0`.
  - Los campos nuevos exigen `"version": "0.7"`, y el motor sigue aceptando de 0.1 a 0.6.
  - **Identidad:** un modelo sin campos nuevos da la misma salida, byte a byte, que la v0.5.1, con la versión
    normalizada. Si aparece una excepción, se declara en `identity_exceptions.json` con su enmienda.
  - El usuario elige el número al publicar.
- **D3, la búsqueda global no circular.** Se confirma con X31, X32, X33 y el prototipo X37.
  - **Genera superficies candidatas no circulares**, por ejemplo con path search, recocido simulado o una búsqueda de
    bloque sobre capas débiles. Las mejores pasan por el refinamiento existente y por un **pulido final**.
  - **Determinista:** un generador pseudoaleatorio con semilla fija, el mismo resultado con y sin `parallel`, y
    desempate por (FS, índice).
  - **Nunca empeora al refinamiento actual:** los círculos de hoy siguen como semillas, así que el FS global es ≤ el
    del refinamiento local en el mismo modelo.
  - **Bishop no se ofrece en polilíneas** (F3.6 sigue vigente).
  - **Compuertas:**
    - los 10 checks no medidos y los 15 promovidos en F3B, con el criterio de un solo lado
      (`FS_ogs ≤ publicado·(1 + tol)`, y el publicado dentro de su banda como cota inferior);
    - contra cSlope, `FS_ogs ≤ 1,01·FS_cSlope`;
    - `evaluated > 0` en un barrido de taludes simples;
    - costo medido en evaluaciones del motor y en tiempo de WASM en Chrome.
- **D4, la compuerta de los 5 minutos.** Se mide de tres maneras y se informa cada una por separado:
  1. **Ruta mínima guionada:** Playwright cuenta las acciones de tres tareas y estima el tiempo con el modelo KLM.
  2. **Usuario nuevo simulado:** un agente que no conoce el repo, solo con la URL y el enunciado, cronometrado, con el
     conteo de desvíos.
  3. **Protocolo humano:** una planilla para que el usuario o un colega lo midan. Es la medición que cierra la
     compuerta de verdad; las dos primeras son aproximaciones.
- **D5, xslope.** X36 decide si es viable. Si lo es, entra como tercera columna del harness en el subconjunto que
  pueda correr. Si no, `propuesta.md` y el README dicen por qué.
- **D6, ruteo de agentes:**

  | Rol | Agente | Modelo |
  |---|---|---|
  | Exploración y prototipos, solo lectura | Haiku | `anthropic` / `claude-haiku-5-5` |
  | Código del motor | Terra | `openai-codex` / `gpt-6.1-terra` |
  | Código de la web, la verificación y la documentación | Sonnet | `anthropic` / `claude-sonnet-5-5` |
  | Usuario nuevo simulado | Haiku, sin acceso al repo | `anthropic` / `claude-haiku-5-5` |
  | Revisión adversarial | Antigravity | `agy`, Gemini |
  | Lente cruzada | Terra o Sonnet, solo lectura | la familia que no escribió el código |
  | Plan, contrato, arbitraje, gates e integración | coordinador | Claude Opus |

  Las rutas se comprobaron el 2026-11-27 con una respuesta real («OK»). Si una se corta por cuota, la tarea pasa a
  Sonnet con una nota de relevo.

## 2. Olas

| Ola | Contenido | Agentes |
|---|---|---|
| CX | Exploración X31-X36 en paralelo | 6 × Haiku |
| W1 | Correcciones web (a partir de X34) | 2 × Sonnet |
| X37 | Prototipo de la búsqueda global sobre las dovelas del motor, con las filas de aceptación | Haiku |
| C0 | Tipos, esquema 0.7, ganchos y tests RED | Terra |
| C1 | Motor (búsqueda global y pulido), verificación (casos, batería, xslope) y web (panel y salidas) | Terra y 2 × Sonnet |
| C2 | Cierre: promoción de casos, documentación, cifras y regresión completa | 2 × Sonnet |
| RCM | Revisión adversarial con dos lentes en un clon congelado, olas correctivas y revisión de cierre | Antigravity y la lente cruzada |
| Medición | La compuerta de los 5 minutos sobre el candidato a versión | Playwright y Haiku a ciegas |
| Versión | Commit de versión, gates y la espera del «sube» del usuario | coordinador |

## 3. Reglas del bloque

- El contrato es `briefs/06_CONTRATOS_CM.md`, con las enmiendas **E17**. Lo escribe solo el coordinador, después de
  la exploración.
- Ningún escritor edita `CHANGELOG.md`; cada uno propone sus líneas en el informe.
- Cada escritor trabaja en su propio worktree, con su `CARGO_TARGET_DIR`, y no hace push.
- Línea base de identidad: el binario de la v0.5.1 en `$TMPDIR/cm-base/ogs`.
- La publicación espera el «sube» explícito del usuario.

## 4. Preguntas abiertas para la exploración

1. ¿Cuántos de los 10 checks no medidos alcanza el refinamiento actual, y cuáles necesitan una búsqueda global? (X32)
2. ¿Qué algoritmo global conviene: path, recocido, bloque o una combinación? ¿Con qué presupuesto y qué determinismo?
   (X31)
3. ¿Qué campos necesita el formato, y dónde se engancha la búsqueda en el motor y en la web? (X33)
4. ¿Hay un oráculo ejecutable para una búsqueda global (OGR Slip2D, xslope)? Si no hay, ¿qué casos publicados la
   validan? (X31, X32, X36)
5. ¿Cuál es hoy el tiempo hasta el primer FS, y qué lo alarga? (X35)
