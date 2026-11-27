# Comprobación de cierre R14 (Antigravity): correcciones de R13 del bloque F3G (v0.4.0)

Eres un revisor **externo e independiente**, experto en equilibrio límite y en software geotécnico profesional. Esta es
una comprobación **acotada**. Lo que tienes que confirmar:
- que las correcciones de la revisión R13 cierran sus hallazgos;
- que esas correcciones no introdujeron defectos nuevos.

No hace falta repetir revisiones anteriores, salvo cuando un cambio las afecte.

## Contexto

OpenGeoSlide es un motor de equilibrio límite en Rust (`crates/ogs-core`), con una web en `apps/web` (WASM), un paquete
de Python (`crates/ogs-py`) y una CLI. El bloque F3G trae el formato v0.5:
- grieta de tracción;
- agua embalsada;
- Ito-Matsui.

**R13** (`docs/reviews/R13_agy_A.md` y `R13_agy_B.md`) dio «APTO CON CORRECCIONES».

**El arbitraje** está en `briefs/04_CONTRATOS_GRIETA_AGUA.md` §F5.13, con las enmiendas E15m-1 a E15m-15. E15m-15 revisa
E15l-2 después de compararlo con el oráculo:
- la grieta sobre una discontinuidad toma la profundidad y el agua de `d(x_c)`, como cSlope;
- el informe agrega `tension_crack.face_height` cuando la cara cortada difiere de la profundidad.

**Reproducciones:**
- `docs/fase3/r13/repro/` (`a01_arm_null`, `a02_paramento_dx0`, `a02_paramento_dx1e-12`, `a03_escalon_fija`,
  `a03_escalon_auto`);
- `docs/fase3/r12/repro/` (`a04_udl` y otros).

**Cambios declarados:** en `CHANGELOG.md` [Unreleased]. Hay tres excepciones a la identidad con la v0.3.0:
- el agua embalsada;
- V019;
- el γw por defecto en imperial, con el aviso `water_unit_weight_default`.

**Estado declarado:**
- verificación con 327/327 checks en 151 casos;
- diferencial v0.5 con 58 OK, 2 explicados y 0 fallas;
- identidad con 0 diferencias en 150 modelos;
- web con 3761 tests;
- regresión de Chrome con 50 guiones, 1231 OK y 0 FAIL.

## Modo de trabajo: solo lectura

- No edites, no hagas commits y no instales nada global.
- Responde en **español neutro, sin voseo**. Si ejecutas algo, cita la salida real.
- **Binarios.**
  - El de este commit se compila con `cargo build --release -p ogs-cli` y queda en `target/release/ogs`.
  - El de la v0.3.0 está en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f3g-base-target/release/ogs`.
  - El anterior a R12 está en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/pre-r12-target/release/ogs`.
- **Oráculo.** Es cSlope 0.1.0, en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python`.
  Se corre con `env -u PYTHONPATH -u PYTHONHOME` y el conversor `verification/harness/to_cslope.py`. Hay un script de
  ejemplo, que imprime Bishop y Spencer en superficie fija:
  `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/r13-coord-oracle.py <modelo.json>`, desde la raíz.
- Marca como «sospecha» lo que no hayas podido reproducir.

## Qué revisar

1. **Cierre de R13.** Repite las reproducciones de R13A-01 a R13A-07 y de R13B-01 a R13B-06, y clasifica cada una.
2. **E15m-15:**
   - ¿La regla `d(x_c)` coincide con cSlope en otras discontinuidades? Prueba:
     - una UDL en otra posición;
     - un cambio lateral de material;
     - un escalón que baja;
     - el espejo `x → −x`.
   - ¿`face_height` es correcto y se omite cuando corresponde?
   - ¿Hay algún caso en que el informe diga «sin grieta» o «corte sin grieta» y no sea cierto?
3. **Regresiones de E15m-2 a E15m-8.**
   - El paramento ampliado en `wall_tol`, con la condición del lado alto:
     - ¿puede asignar un paramento a una dovela equivocada en un modelo con dos paramentos cercanos?
     - ¿qué pasa con el espejo?
   - Los vértices de la piezométrica en el barrido.
   - El atajo de la entrada evaluado hacia dentro, en los dos sentidos.
   - El aviso `water_unit_weight_default`: ¿falsos positivos (SI, γw explícito, sin agua) o falsos negativos?
4. **La web en las áreas tocadas:**
   - la nota de γw en imperial, que ya no bloquea;
   - las áreas de acierto de la información emergente: ¿interceptan alguna edición, con tiradores, herramientas, teclado
     o táctil?
   - «Sin grieta» y «Corte…» en Casos y en el PDF.

   Si hace falta, usa Vite SSR o Chrome.
5. **Documentación.** ¿Las cifras de E15m (CHANGELOG, `limitaciones.md`, `formato-ogs-json.md`, `verificacion.md` y
   ogs-py) coinciden con el binario? Comprueba al menos 8.
6. **Juicio.** ¿Se puede publicar como v0.4.0?

## Formato de salida (obligatorio)

1. **Primera línea:** `VEREDICTO: APTO PARA PUBLICAR | APTO CON CORRECCIONES | NO APTO`.
2. **Tabla de cierre de R13:** una fila por hallazgo, con estado `CERRADO | PARCIAL | ABIERTO` y la evidencia en una
   línea.
3. **Hallazgos nuevos,** uno por línea, con esta forma:
   `ID (R14-xx) | severidad (CRÍTICA/ALTA/MEDIA/BAJA) | archivo:línea | problema | evidencia | por qué afecta | corrección | esfuerzo S/M/L`
4. **Cobertura:** qué ejecutaste, qué revisaste en el código y qué no pudiste verificar.
