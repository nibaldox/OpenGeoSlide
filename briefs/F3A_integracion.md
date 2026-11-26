# Brief F3A-I: integración de la Fase 3a, dos integradores Sonnet en paralelo

Responde en **español neutro, sin voseo**.

**Lee primero, completos:**
- `briefs/02_CONTRATOS_FASE3.md`, normativo, incluido **F3.10 (E13j)**;
- `briefs/F3A_ola0.md` y `briefs/F3A_ola1.md`, cuyas reglas siguen vigentes;
- las notas de `docs/fase3/{w0a,w1a,w1b,w1e,w1f,w1v}/`.

**Base:** la rama `f3a-integracion`, en `a342be7`. Contiene las olas 0 y 1 integradas, más W1v. El coordinador ya
comprobó:
- motor: 282 tests y 0 fallas, `f3_oracle` incluido;
- aceptación: 120 checks y 0 fallas;
- identidad byte a byte en los 36 modelos;
- web: 121 archivos de test, 2293 tests en verde con `OGS_BIN`.

**Medición del coordinador sobre `verification/pending/F3`** (48 casos, 123 checks), con
`verification/harness/run.py` y el binario actual, copiando solo los `V*.json` a un directorio aparte:
- **ogs:** 117 OK, 0 FALLA, 2 «sin dato» y 4 «no convergido»;
- **cSlope:** 123 de 123.
- Los 6 checks pendientes son:
  - V018: Spencer fijo «sin dato», y M-P fijo «no convergido» con publicados 1,009 y 1,017;
  - V068: Bishop fijo «sin dato»;
  - V077: Spencer fijo «no convergido»;
  - V078: M-P fijo «no convergido».
- En la cabecera del informe aparece un error `analysis.interslice requiere el método "morgenstern_price"`, que hace
  sospechar del conversor o del harness.

**Reglas:**
- **Nunca relajes tolerancias, umbrales ni datos.** Si algo no se puede cumplir, repórtalo con números.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- Al final, borra los worktrees y servidores temporales, estos últimos por su PID.

---

## I-M: motor y verificación (worktree `f3im`, rama `f3im-motor`)

**Archivos tuyos:**
- `crates/**`;
- `verification/**`;
- `docs/limitaciones.md`, `docs/formato-ogs-json.md` y `docs/verificacion.md`;
- `schema/**`;
- `CHANGELOG.md`.

**Tareas**, por prioridad:
1. **Los 6 checks de `pending/F3`.** Para cada uno, identifica la causa con números (publicado, ogs, cSlope,
   estado, motivo y dovelas) y distingue:
   - un error del conversor o del harness: corrígelo, por ejemplo si pasa `interslice` a un check que no es de M-P;
   - un caso no convergido del motor en una polilínea donde cSlope converge. Es una robustez real: Spencer y M-P en
     polilínea arrancan desde Janbu, según E13f.
     - Prueba si hay raíces admisibles en el barrido de λ y en qué parte falla.
     - Corrígelo **dentro del contrato**, sin tocar guardas ni umbrales.
     - Si exige cambiar el contrato, detente y repórtalo.
   - Cada corrección del motor lleva su test RED y la identidad byte a byte de los 36 modelos.
2. **Promoción.** Los checks de `pending/F3` que cumplan pasan a `verification/cases/` con el importador, de modo que
   todo siga siendo regenerable:
   - actualiza los índices;
   - la aceptación debe dar 0 fallas;
   - regenera `verification/REPORT.md` y `report.json`;
   - lo que no cumpla queda en `pending/` con su diagnóstico.
3. **Retenidos del lote 0:**
   - **V026:** agrega `DIRECTION_OVERRIDES` con el motivo documentado, como en V063 y V077, y promuévelo si cumple.
   - **V027 y V028:** quedan retenidos. Mide `f = Σ|N'<0|/ΣW` y la fracción de la longitud de base, y repórtalos.
   - **V032a:** diagnostica por qué la búsqueda encuentra un círculo casi plano con FS 1,1706, entre 3 y 5 % bajo el
     publicado y bajo cSlope.
     - ¿Es admisible?
     - ¿Sus extremos efectivos caen dentro de los rangos?
     - ¿Qué FS da cSlope sobre **ese mismo** círculo fijo?
     - ¿Es un mínimo real, más conservador, o una superficie que no debería competir?

     Repórtalo con números; no lo corrijas sin consultar.
4. **E13j-4, raíz de F₀ en Janbu.**
   - Mide, en los casos, en la batería y en `pending/F3`, si «la menor raíz admisible» y «la más cercana a Fellenius»
     difieren alguna vez.
   - Si nunca difieren, adopta la menor admisible, con la nota `multiple_admissible_roots`, y deja un test.
   - Si difieren, reporta el caso y no cambies nada.
5. **Spencer no drenado sin convergencia.** W1e reportó que Spencer no converge en un círculo fijo no drenado en la
   web ni en la CLI. Los fixtures están en `docs/fase3/w1e/` y en `apps/web/src/editor/state/units*.test.ts`.
   - Reprodúcelo.
   - Compáralo con el oráculo, que con M-P constante sobre el mismo círculo da el equivalente a Spencer.
   - Diagnostica la causa.
6. **Batería diferencial** con los métodos nuevos, ejecutada con el criterio de 0,5 %:
   ```
   uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/differential/run.py --ogs target/release/ogs --out <dir>
   ```
   Regenera `verification/differential/REPORT.md`.
7. **Documentación:**
   - `docs/formato-ogs-json.md`: el formato v0.3 completo, con ejemplos;
   - `docs/limitaciones.md`:
     - Bishop solo en círculos;
     - la búsqueda sigue siendo circular;
     - el ajuste al terreno por primer cruce;
     - ξ en la x del modelo y el espejo solo con f simétrica;
     - lo que queda para F3b;
   - `docs/verificacion.md`: cifras nuevas, leídas de los informes;
   - `CHANGELOG.md`.

**Gates:**
- los de F3.11;
- la identidad byte a byte de los 36 modelos tras cada cambio del motor;
- `uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification`.

**Presupuesto:** unas 100 iteraciones, con la prioridad indicada.

---

## I-W: web de extremo a extremo (worktree `f3iw`, rama `f3iw-web`, puertos 5186 y 5187)

**Archivos tuyos:**
- `apps/web/**`;
- `docs/fase3/{w1e,w1f}/**`;
- `docs/fase3/iw/**`, nuevo;
- `docs/fase2/ux/*-e2e/**`, solo para actualizar expectativas obsoletas, con un comentario del motivo.

**Tareas:**
1. **Extremo a extremo con el WASM real**, sobre `pnpm build && pnpm preview --port 5186 --strictPort --host 127.0.0.1`:
   - **a.** Abre el JSON de un caso de `verification/pending/F3` con polilínea, por ejemplo V006 o V046. Calcula con
     Spencer, M-P y Janbu corregido, y compara cada FS con `ogs analyze` del mismo archivo. Deben coincidir a 1e-9.
   - **b.** Crea un modelo desde cero en la web:
     - «Talud simple…» con un estrato inferior no drenado y Su variable con la cota;
     - superficie polilínea editada en el lienzo;
     - M-P medio seno y Janbu corregido.

     Calcula, guarda en 0.3, reabre y recalcula. Comprueba que se mantiene el mismo FS y que coincide con la CLI.
   - **c.** Bishop deshabilitado con polilínea, y el mensaje del motor si se fuerza por JSON.
   - **d.** Conversión SI → imperial del modelo b: el FS no cambia (tolerancia 1e-9 relativa).
   - **e.** Casos: un caso con polilínea dibujado con su superficie ajustada y sus dovelas.
   - **f.** PDF del modelo b, revisado como imagen con pymupdf y visión: polilínea, método, función, f₀ y tabla de Su.
   - **g.** CSV de superficie y de resultados leídos con `pandas.read_csv` sin opciones.
2. **Pendientes de W1f** (`docs/fase3/w1f/e2e/w1f_canvas.mjs`):
   - en el paso 32, quita el BOM antes de comparar;
   - pasos 37 a 41: la pestaña Casos es `role=tab`;
   - inventaría los usos que quedan del puente `circleSpec`/`reportCircle` y quita los que ya no hacen falta.
3. **Pendientes de W1e:** axe en oscuro en sus vistas.
4. **Regresión completa:** todos los guiones de `docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s,u6d,u6g,u6k}-e2e/` más
   `docs/fase3/{w1e,w1f}/e2e/`, contra `vite preview`. Se omiten `lib.mjs`, `*explore*` y `make_fixtures`.
   - **El montaje** está documentado en la skill `ogs-e2e-preview-integration`.
   - Cuenta las líneas `^FAIL` en los logs: los guiones salen con código 0 aunque fallen.
   - Distingue una regresión real, que corriges, de una expectativa obsoleta, que actualizas con un comentario.
   - **Entrega la tabla completa.**
5. **axe** en claro y oscuro en las vistas nuevas: materiales no drenados, análisis con M-P, polilínea en el lienzo y
   en Casos, y Ayuda. Debe dar 0 serious o critical.
6. **Gates:**
   - `tsc`;
   - `pnpm test` con `OGS_BIN`, sin omitidos;
   - `pnpm build`;
   - tests de tokens y AA.

**Presupuesto:** unas 100 iteraciones, con la prioridad indicada. Si se agota, deja registrado qué quedó pendiente.
