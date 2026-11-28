# CM-C3 · Documentación final del bloque CM y CHANGELOG

Base: `cm-integracion` en `b0044ce`, con el bloque completo integrado:
- W1, W2 y W3A/W3B (la web, incluidas las correcciones de la revisión RCM, lente B);
- CM-V (xslope);
- CM-M y CM-M2 (el motor v0.7, con las correcciones de la lente A);
- CM-C1W (la web de la búsqueda global);
- CM-C2V (los casos) y CM-C2D (la primera versión de los documentos).

El contrato es `briefs/06_CONTRATOS_CM.md`, con las enmiendas **E17a a E17f**, que mandan sobre el texto original. Las
reglas comunes son las de `briefs/CM_W1_tareas.md` §«Reglas comunes»; los commits llevan el mensaje `CM-C3: …`.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **CM-C3** | `opengeoslide-wt/cm-c3d` / `cm-c3d` | 5183 | `README.md`, `CHANGELOG.md` (solo la sección `[Unreleased]`), `docs/formato-ogs-json.md`, `docs/limitaciones.md`, `docs/verificacion.md`, `docs/desarrollo.md`, `docs/cm/CIERRE_CM.md` y `assets/readme/app-editor-{light,dark}.png` |

No toques las versiones (`Cargo.toml`, `package.json`, `CITATION.cff` y `__init__.py`): el número lo elige el usuario y
el commit de versión es del coordinador. Escribe «v0.7 del formato» y «la próxima versión», sin número.

## Qué hacer

1. **E17e y E17f en los documentos.** Hoy describen E17d, que E17e reemplazó en su §1.
   - **`formato-ogs-json.md`:**
     - la elección de la capa con la resistencia efectiva en σ′v = γ·z·(1 − ru), en la que compiten Mohr-Coulomb,
       `undrained`, Hoek-Brown y SHANSEP, y `auto` decide por las aristas de la capa elegida;
     - `refined` vale 0 o 1;
     - `tension_rejected` cuenta solo la generación, y la nota cubre toda la etapa global;
     - `max_vertices` también acota la etapa global;
     - `global` solo admite un objeto;
     - los enteros escritos como `50.0` son inválidos, y un enum con el tipo equivocado da `Json`, como en la v0.6;
     - la versión en memoria de la web es un piso, y al archivo va siempre `minimalVersion` (E17f §4);
     - el presupuesto típico es de unas 5700 evaluaciones (E17c y E17e), no 8000.

     Los ejemplos y sus salidas se vuelven a medir con el binario de tu worktree: el validador da la cifra.
   - **`limitaciones.md`:**
     - se quita «HB y SHANSEP no compiten»;
     - en la web, quita lo que corrigió W3 (los hallazgos RCM-B de `$TMPDIR/rcm-B/RCM_B.md`) y deja lo abierto:
       - en V051 los rótulos `q = …` del lienzo se apilan unos sobre otros (el PDF ya no);
       - la versión en memoria (RCM-B-14);
       - los mensajes de enum con el tipo equivocado (RCM-A-09).
   - **`verificacion.md` §«Búsqueda global no circular (v0.7)»:** la tabla de compuertas con las cifras actuales de
     `verification/global/REPORT.md`, que regeneró CM-M2:
     - A4, 38 ganadores;
     - A5, 57 de 57, con 21 victorias;
     - A6, 55 de 55;
     - A7, máximo 3,81 y mediana 1,56, con el margen del peor caso;
     - A10, 827 tests y 356 checks;
     - A7 en Chrome real, de `verification/global/a7_chrome.json`: V053 2,83 veces y S2 1,94 veces, con el FS igual al
       nativo a 1,8e-14 o menos;
     - una línea por cada reproductor de RCM-A (`verification/global/repro/`), con el antes y el después.
2. **Las cifras de verificación actuales:** 175 casos y 356 checks; ogs 356/356, y cSlope reproduce 355 de 356 (V027
   no converge). Los 9 checks de F7.6 se promovieron todos; cuenta los retenidos con `verification/pending/INDEX.md`.
   - Busca «347», «167 casos», «⟨PROMOVIDOS⟩», «⟨RETENIDOS⟩» y los demás `⟨…⟩` en el README, en `verificacion.md` y en
     `limitaciones.md`.
   - Cambia solo lo que describe el estado actual. Lo histórico («la 0.5.1 daba 347 checks») se queda.
3. **`docs/cm/CIERRE_CM.md`:**
   - agrega la revisión RCM: lentes A y B, el veredicto «apto con correcciones» de las dos, el resumen de los hallazgos
     altos, las enmiendas E17e y E17f, y las olas CM-M2, CM-W3A y CM-W3B con sus cifras;
   - llena los `⟨…⟩` que puedas: ⟨CASOS⟩, ⟨CHECKS⟩, ⟨PROMOVIDOS⟩, ⟨A7-CHROME⟩ y ⟨RCM⟩;
   - deja ⟨CARGO⟩, ⟨PYTEST⟩, ⟨VITEST⟩ y ⟨E2E⟩, que el coordinador llena con las puertas finales;
   - la compuerta de los 5 minutos sigue pendiente del protocolo humano del usuario.
4. **`CHANGELOG.md`, la sección `[Unreleased]`,** con el formato de las entradas anteriores (Added, Changed, Fixed y
   Known issues). Arma las líneas desde:
   - las que propuso cada escritor en su informe:
     - `~/.hermes/profiles/open-geoslide/cache/delegation/live/deleg_27cad62b/task-0.log` (W2);
     - `deleg_a0ea382c/task-0.log` (CM-M);
     - `deleg_cca9f5d3/task-0.log` (CM-M2);
     - `deleg_0c7d33df/task-0.log` y `task-1.log` (W3A y W3B);
     - `deleg_113b08e2/task-0.log` (C2V);
     - la línea «Líneas propuestas» o «CHANGELOG» de cada informe, al final de cada registro;
   - `git log --first-parent 1d1d097..cm-integracion` y los briefs `CM_W1_tareas.md`, `CM_C1_web.md` y
     `CM_W2_tareas.md`, para W1, CM-V y CM-C1W.

   La entrada empieza con la frase de identidad: sin `global`, la salida es la de la 0.5.1 byte a byte, con 0
   diferencias en 202 modelos y la versión normalizada. En Known issues van los residuos abiertos del punto 1 y la
   compuerta humana de los 5 minutos. Las cifras de los tests «medidas en el commit de versión» las agrega el
   coordinador: déjalas como `⟨…⟩`.
5. **Las capturas del README** (`assets/readme/app-editor-{light,dark}.png`):
   - se regeneran con `assets/readme/src/capture-app.mjs` sobre tu build, servido en el 5183. Copia el script junto a
     un `node_modules` que tenga `playwright-core` (`$TMPDIR/f1c-e2e/node_modules`), porque Node lo resuelve desde la
     carpeta del script;
   - mismo tamaño que las PNG de ahora;
   - si la vista que captura el script cambió con W1, W2 y W3 (el selector, el rótulo y la línea global), ajusta el
     `alt` del README;
   - el script no cambia, salvo que ya no corra. Si no corre, explica por qué.
6. **Puertas:**
   - `docs/tools/validar_ejemplos.py --ogs target/release/ogs` en verde;
   - 0 enlaces o anclajes rotos en los archivos que toques;
   - el grep de higiene `git grep -nI "/home/xodla" -- . ':!briefs' ':!docs/reviews' ':!docs/fase1/exploracion'`
     sin salida. Si sale algo fuera de tus archivos, nómbralo en el informe sin tocarlo.

## Entorno

- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. El binario v0.7, con CM-M2, está en
  `target/release/ogs`; el WASM v0.7, en `apps/web/src/wasm`; y `node_modules`, en `apps/web`. Para construir la web:
  `cd apps/web && pnpm build`.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- Servidor: `python3 -m http.server 5183 --bind 127.0.0.1 -d <copia de dist>`, en segundo plano y matado por PID.
- Estilo: español latinoamericano neutro, sin voseo y con frases cortas, como los documentos que ya existen.
