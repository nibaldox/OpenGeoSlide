# Revisión adversarial R5 (Antigravity): Fase 1 de OpenGeoSlide

Eres un revisor **externo e independiente**. En R4 (`docs/reviews/R4_agy.md`) aprobaste con reservas la Fase 0. Desde
entonces, la Fase 1 agregó lo siguiente, con contrato normativo en `briefs/01_CONTRATOS_FASE1.md` (E12a-E12e) sobre la
base de `briefs/00_CONTRATOS.md`:
- **Esquema `.ogs.json` v0.2:** sismo pseudoestático (`kh`, `kv`) y cargas `udl` y `line` (E12a). Ecuaciones en
  Bishop y en Spencer (E12b).
- **Validación de regiones:** auto-intersección, solape y orden de la piezométrica (E12c).
- **Selección de raíz de Spencer:** ahora se elige la **raíz admisible de menor F** (E12e), que reemplaza a la de
  «menor |λ|». Evidencia en `docs/fase1/exploracion/X5.md`.
- **Verificación:** 21 casos publicados (51 checks), entre ellos Loukidis con sismo (V102a/b) y casos con `udl`, y una
  batería diferencial D01-D14 con sismo y cargas frente a cSlope.
- **Editor web:** estado, lienzo SVG y paneles; abrir y guardar `.ogs.json`; importación de DXF y CSV; informe PDF;
  borrador local.
- **Publicación sin red:** workflows en `.github/workflows`, PWA con service worker y metadatos de los crates y del
  wheel.

**Modo solo lectura:** no edites archivos, no hagas commits, no instales globalmente ni publiques.
Responde en **español neutro, sin voseo**.

**Herramientas disponibles:**
- binario: `cargo build --release -p ogs-cli`, después `target/release/ogs analyze <archivo|/dev/stdin>`;
- oráculo: `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` (`import cslope`), con el
  conversor `verification/harness/to_cslope.py`;
- **Python:** ejecútalo siempre con `env -u PYTHONPATH -u PYTHONHOME`.

## Lente A: matemática, datos y contratos
1. **E12b:**
   - ¿Hay casos con sismo o cargas donde Bishop o Spencer se alejen de cSlope más de 1 % en **superficie fija**?
     Prueba geometrías `ltr` y `rtl`, cargas en el borde de una dovela, cargas en dovelas aéreas o en bloques
     descartados (E10a), `kv` negativo grande y `kh` alto (0,3-0,5).
   - ¿Se cumple el equilibrio global?
   - Al acercarse a `kh` crítico, ¿Spencer reporta un FS espurio, sin cierre o sin admisibilidad?
2. **E12e (menor F admisible):**
   - ¿Puede elegir una raíz «admisible» físicamente inválida (tracción generalizada o un punto cercano a un polo) que
     haga el resultado **anticonservador** o absurdamente bajo, de modo que esa superficie gane la búsqueda?
   - Compara con Bishop en el mismo círculo y con cSlope.
   - ¿La vía rápida de Newton para la raíz de F (ver `spencer.rs`) puede converger a una raíz de cierre distinta de la
     del barrido?
3. **E12c:** ¿falsos positivos (modelos válidos rechazados, por ejemplo con vértices colineales, regiones que se
   tocan en un punto o en uniones en T) o falsos negativos (solapes que pasan)? Compara también con
   `apps/web/src/editor/state/validateLocal.ts`: ¿el editor y el motor aplican la misma regla?
4. **Neutralidad:** ¿un modelo v0.1 da exactamente lo mismo que antes?

## Lente B: propagación, entradas y entrega
1. **Resultados obsoletos o inválidos en el informe y en la UI:**
   - ¿El informe PDF puede mostrar un FS que no corresponde al modelo actual, de un método `not_converged` o
     `invalid`, o sin sus avisos?
   - ¿El CSV exportado puede omitir el estado?
2. **Entradas hostiles:**
   - DXF: tamaño, número de entidades, bulge, 3D, coordenadas no finitas, capas con nombres raros y unidades;
   - CSV: inyección de fórmulas y coma decimal ambigua;
   - `.ogs.json`: campos desconocidos, versión 0.1 con campos nuevos y valores límite.

   ¿Algo produce un modelo silenciosamente distinto del que el usuario cree haber importado?
3. **Ida y vuelta:** abrir un `.ogs.json` y guardarlo con `saveOgsJson`, ¿cambia el resultado del motor? Mira el
   redondeo a 6 decimales y la `tolerance`.
4. **PWA y despliegue:**
   - ¿El service worker puede servir un WASM o JS **antiguo** después de una actualización? Si es así, ¿cómo se
     invalida?
   - ¿La versión del motor queda en el informe?
   - Revisa `.github/workflows`: permisos mínimos, `pull_request` sin secrets ni deploy, publicación en PyPI y
     crates.io solo con tags o con un dispatch manual protegido.
5. **Verificación:**
   - ¿Algún check de aceptación o de la batería pasa por una razón equivocada (tolerancia, oráculo no convergido o
     caso trivial)?
   - Revisa D13, con `min_width` fijado, y su justificación.

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. **Hallazgos:** tabla `ID (R5-xx) | severidad | lente | archivo:línea | descripción | evidencia | corrección
   sugerida`. Un hallazgo CRITICAL o HIGH exige evidencia reproducible: comando y salida real.
3. Bloqueantes para publicar la Fase 1 frente a pendientes.
4. Cobertura: qué revisaste y qué no.
