# Brief F2-R: rediseño del README (skill `beautify-github-readme`, **modo README**) — un escritor Sonnet

Responde en **español neutro, sin voseo**.

Antes de empezar, lee completa la skill
`/home/xodla/.hermes/profiles/open-geoslide/skills/beautify-github-readme/SKILL.md` y **todas** sus referencias en
`references/`: `content-architecture`, `github-readme-canvas`, `project-native-hero`, `svg-production` y
`visual-direction`. Las de motion y showcase no aplican. Síguelas; esta tarea se juzga con su «Quality bar».

**Modo:** README completo, autorizado por el usuario. **Sin animación**: solo SVG estático y capturas PNG o WebP.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f2r`, rama `f2r-readme`, desde `main`.

## Historia del proyecto (fijada por el coordinador)
```text
Audience: ingenieros geotécnicos (minería a rajo abierto, botaderos, obras civiles), docentes y estudiantes, investigadores.
One-sentence value: estabilidad de taludes 2D por equilibrio límite, libre y verificada, en el navegador o en tu equipo.
Primary proof: (1) la app real calculando: sección con estratos, piezométrica, círculo crítico y FS; (2) verificación
  reproducible: 51/51 checks contra valores publicados en 21 casos, y 28/28 + 28/28 frente a cSlope (búsqueda y
  superficie fija). Es la batería real de verification/.
First successful action: abrir https://nibaldox.github.io/OpenGeoSlide/ (sin instalar) y pulsar «Comprobar» en un ejemplo.
Visual theme: la sección transversal de un informe geotécnico: estratos, nivel freático, círculo de falla con dovelas
  y la anotación del FS.
```

## Dirección visual (punto de partida; ajústala según `visual-direction.md`)
- **Paleta:** tonos tierra para los estratos (ocre, arcilla, limo gris), azul agua para la piezométrica discontinua,
  **rojo de ingeniería** solo para la superficie crítica, y tinta azul-gris oscura para el texto. Inspecciona los
  colores reales de la app (`apps/web/src/**/*.css` y el ícono `apps/web/public/icons/icon.svg`) para que el README y la
  app se vean como el mismo producto.
- **Tipografía:** sans de sistema para los títulos; mono de sistema para cifras como FS, kh o coordenadas.
- **Motivo recurrente:** el arco de falla con dovelas. Puede aparecer en el hero y, en pequeño, en los encabezados de
  sección o en el diagrama.
- **Composición:** sobria, técnica, de informe de ingeniería. Nada de neón, gradientes de moda ni rejillas genéricas.
- **Modo claro y oscuro:** cada SVG lleva su propio contenedor con fondo y radio, para que se lea bien en los dos
  temas de GitHub.

## Material obligatorio y real (nada inventado)
1. **Hero SVG** (`assets/readme/hero.svg`), compuesto **con datos reales**:
   - la geometría de un caso de `verification/cases` o de `examples/`, por ejemplo ACADS 1a o V047a;
   - el **círculo crítico y las dovelas que devuelve el motor**: ejecuta `cargo build --release -p ogs-cli` y
     `target/release/ogs analyze <caso>`, y toma de la salida `xc`, `yc`, `r`, las dovelas y el FS;
   - las cifras del hero deben coincidir con la salida real. Guarda el comando y la salida en el resumen.
   - **Anatomía:** contexto («Estabilidad de taludes 2D · equilibrio límite»), el nombre «OpenGeoSlide», una
     descripción concreta y metadatos pequeños (Bishop · Spencer · sismo · cargas · Apache-2.0).
2. **Captura real de la app** (`assets/readme/app-editor.png` o `.webp`, menos de 400 kB):
   - se toma en `https://nibaldox.github.io/OpenGeoSlide/` con Chrome headless (`playwright-core` del scratch
     `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1c-e2e`, `executablePath /usr/bin/google-chrome-stable`);
   - debe mostrar un ejemplo calculado: superficie crítica, tabla de FS y, si queda legible, el panel de sismo;
   - opcional: una segunda captura de la primera página del informe PDF, convertida a PNG, si aporta.
3. **Diagrama SVG** «un motor, cuatro entradas» (`assets/readme/engine.svg`): `ogs-core` (Rust) alimenta la web (WASM
   y PWA), Python (`opengeoslide`), la CLI (`ogs`) y el formato `.ogs.json`, con el mismo FS bit a bit en todas.
   Debe ser legible a 900 px y a 360 px; si no se lee en móvil, simplifícalo.
4. **Verificación:** va en **Markdown**, en una tabla breve, no en imagen. Enlaza a `verification/REPORT.md` y a
   `verification/differential/REPORT.md`.

## Contenido y orden (README más corto y claro; nada se pierde)
Orden sugerido, según la skill:
1. Hero.
2. Enlaces: «Abrir la app», Releases, Licencia y Citar, con badges sobrios.
3. Captura real.
4. Qué es.
5. Por qué es distinto. Explica el mecanismo, sin eslóganes: verificado contra publicados y contra cSlope, el mismo
   motor en web, Python y CLI, funciona sin conexión, libre.
6. Cómo usarlo: web, Python con el wheel del Release, CLI. Deben ser los comandos reales y probados.
7. Verificación.
8. Limitaciones: un resumen de 4 a 6 viñetas con enlace al detalle.
9. Contribuir, citar y licencia.
10. Advertencia profesional.
11. Un párrafo final breve **«In English»** con el valor y los enlaces.

Reglas:
- El detalle técnico que hoy está en el README se **mueve, no se borra**: estructura del repo, compilar y probar,
  formato v0.2 de sismo y cargas, limitaciones completas, verificación detallada. Va a `docs/desarrollo.md`,
  `docs/formato-ogs-json.md`, `docs/limitaciones.md` y, si corresponde, `docs/verificacion.md`, y el README los enlaza.
  Comprueba con un diff que cada sección eliminada del README aparezca en algún documento de `docs/`.
- No inventes adopción, usuarios ni benchmarks. Solo sirven cifras que estén en `verification/` y `bench/RESULTS.md`.
- Revisa que los enlaces relativos y absolutos funcionen. La app está en `https://nibaldox.github.io/OpenGeoSlide/` y
  el repo en `https://github.com/nibaldox/OpenGeoSlide`.

## Previsualización y verificación (obligatorias)
1. `python3 /home/xodla/.hermes/profiles/open-geoslide/skills/beautify-github-readme/scripts/audit_readme.py README.md`
   debe dar OK.
2. **Render tipo GitHub:**
   - genera el HTML con `gh api -X POST /markdown -f mode=gfm -f context=nibaldox/OpenGeoSlide -f text="$(cat README.md)"`.
     Es de solo lectura y no publica nada;
   - envuélvelo con `github-markdown-css` (instálalo con npm en el scratch, no en el repo) y sirve el worktree en el
     puerto **5188** (`python3 -m http.server 5188 --bind 127.0.0.1`);
   - captura con Chrome **4 imágenes**: claro a 900 px, oscuro a 900 px, claro a 360 px y el hero a 900 px. Guárdalas en
     `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f2r-preview/` y revísalas tú mismo con visión. Corrige
     el texto cortado, el contraste o la ilegibilidad antes de terminar. Al final libera el puerto 5188.
3. Los SVG no llevan scripts, `foreignObject`, fuentes remotas ni animación. Pesan menos de 60 kB cada uno.

## Cierre
- Commits con rutas explícitas. **Sin push.**
- **Resumen:**
  - archivos nuevos y movidos;
  - tabla «sección antigua → dónde quedó»;
  - salida real del `ogs analyze` usado en el hero;
  - las rutas de las 4 capturas de previsualización;
  - resultado del audit;
  - hashes.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
  No uses los puertos 5180 a 5187.
- **Presupuesto:** ~60 iteraciones.
