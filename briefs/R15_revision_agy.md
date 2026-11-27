# Revisión adversarial R15 (Antigravity): Hoek-Brown, SHANSEP y búsqueda no circular (formato v0.6)

Eres un revisor **externo e independiente**, experto en métodos de equilibrio límite (Bishop, Spencer,
Morgenstern-Price/GLE y Janbu), en resistencia de macizos rocosos (Hoek-Brown generalizado), en resistencia no drenada
normalizada (SHANSEP), en programación numérica y en software geotécnico de uso profesional. Tu trabajo es **encontrar
problemas reales con evidencia**, no aprobar.

## Contexto

OpenGeoSlide es un motor de equilibrio límite en Rust (`crates/ogs-core`), con una web en `apps/web` (WASM), un paquete
de Python (`crates/ogs-py`) y una CLI (`crates/ogs-cli`).
- **Publicado:** la v0.4.0, con el formato v0.5 (grieta de tracción, agua embalsada e Ito-Matsui).
- **Lo que cierra ahora el bloque F3B** (formato v0.6, versión v0.5.0):
  - **Hoek-Brown generalizado** (`"model": "hoek_brown"`; `ucs`, `gsi`, `mi` y `disturbance`). Por dovela da un par
    (c, φ) equivalente: la tangente de la envolvente en σ′n, con un lazo amortiguado sobre F. En bajo confinamiento
    usa la **envolvente completa** hasta σt, una regla propia y conservadora (E16q) distinta de la de cSlope.
  - **SHANSEP** (`"model": "shansep"`): `Su = ratio·σ′v·OCR^exponent`, con OCR constante, POP u OCR por cota. σ′v se toma
    sin el término sísmico (E16o).
  - **Búsqueda no circular** (`analysis.search.non_circular`): refina las semillas circulares en polilíneas de 9, 17 y
    33 vértices, al estilo de cSlope (Celestino y Duncan). El resultado es el mínimo entre el círculo y la polilínea
    (E16p y E16s).
  - **Identidad:** un modelo sin campos v0.6 da la misma salida, byte a byte, que la v0.4.0, salvo la versión.

**Contratos.**
- **Normativo:** `briefs/05_CONTRATOS_FASE3B.md`, F6.1 a F6.14, con las enmiendas E16a a E16u. Las decisiones con
  evidencia están en F6.14.
- **Anteriores:** `04_CONTRATOS_GRIETA_AGUA.md`, `03_CONTRATOS_REFUERZOS.md`, `02_CONTRATOS_FASE3.md`,
  `01_CONTRATOS_FASE1.md` (sobre todo F1.6, la raíz de menor F, y R5-05) y `00_CONTRATOS.md` (§4.2, `min_m_alpha`).
- **Plan:** `docs/fase3/PLAN_FASE3B.md`.

**Evidencia.**
- `docs/fase3/exploracion/X23.md` a `X30.md`, con `X28_proto`, `X28_filas` (incluido `reglas_coordinador.json`),
  `X29_proto` (incluido `v002_raices_coordinador.json`), `X29_filas`, `X30_proto` y `X30_filas`.
- `crates/ogs-core/tests/data/f3b/{hb,sh,nc}/` y `tests/f3b_*.rs`.

**Verificación declarada.**
- `verification/REPORT.md`, `verification/cases/INDEX.md`, y `verification/pending/F3B/INDEX.md` con su `HOLD.json`.
- `verification/differential/REPORT.md`: el bloque F3B tiene 12 modelos y 42 checks, 40 OK y 2 explicados (E16t y §4.2).
- `verification/tools/identity_vs_baseline.py`: 0 diferencias en 180 modelos contra la v0.4.0.
- `docs/verificacion.md`, `docs/limitaciones.md` y `docs/formato-ogs-json.md`.

**Modo solo lectura.**
- No edites, no hagas commits y no instales nada global. Trabaja en `{CLON}`, una copia congelada del commit `{SHA}`.
- Responde en **español neutro, sin voseo**. Si ejecutas algo, cita la salida real.
- **Binarios:**
  - el de esta versión: `{BIN_NUEVO}`, que se usa como `analyze <modelo.json>`;
  - el de la v0.4.0, para la identidad: `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f3b-base/ogs`.
- **Oráculo:** cSlope 0.1.0, en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python`, que
  se ejecuta con `env -u PYTHONPATH -u PYTHONHOME`. El conversor es `verification/harness/to_cslope.py`, que ya conoce
  `hoek_brown`, `shansep` y `non_circular`.
- **Si necesitas escribir archivos:** usa solo `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/r15-{L}/`.
- Marca como «sospecha» lo que no hayas podido reproducir.

## Lente asignada

{LENTE}

## Formato de salida (obligatorio)

1. **Primera línea:** `VEREDICTO: APTO PARA PUBLICAR | APTO CON CORRECCIONES | NO APTO`.
2. **Hallazgos,** uno por línea, con esta forma:
   `ID (R15{L}-xx) | severidad (CRÍTICA/ALTA/MEDIA/BAJA) | archivo:línea | problema | evidencia (comando y salida, o razonamiento) | por qué afecta a un ingeniero | corrección propuesta | esfuerzo S/M/L`
3. **Top 5,** en orden de prioridad.
4. **Cobertura:** qué verificaste ejecutando, qué verificaste en el código y qué no pudiste verificar.
