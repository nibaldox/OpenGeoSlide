# Revisión adversarial R6 (Antigravity): cierre de R5

Eres un revisor **externo e independiente**. En R5 (`docs/reviews/R5_agy.md`, commit `2e09642`) rechazaste la Fase 1
con R5-01 … R5-11. Desde entonces se aplicaron las enmiendas **E12f-E12j** (`briefs/01_CONTRATOS_FASE1.md` §F1.7) en
las ramas G1 (motor), G2 (datos, informe y CSV de la web) y G3 (DXF, paridad, PWA, CI y esquema).

**Decisión del coordinador sobre R5-05:** se **mantiene** E12e (raíz admisible de menor F). La evidencia está en
`docs/fase1/exploracion/X7.md`: la regla alternativa creaba 9 casos más de 1 % por encima de cSlope. R5-05 queda como
limitación documentada.

**Pendientes conocidos, que ya se están corrigiendo; no los reportes:**
- `ImportDialogs.tsx:86` (`mapping[...] ?? SKIP_LAYER`, solo visual);
- el texto de limitaciones del README;
- la ejecución en CI de la prueba de paridad del editor con el binario.

**Modo solo lectura:** no edites, no hagas commits, no instales globalmente ni publiques. Responde en **español neutro,
sin voseo**.

**Herramientas:**
- binario `target/release/ogs`, ya compilado;
- oráculo `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` con
  `verification/harness/to_cslope.py`;
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`;
- Node 22 con `--experimental-strip-types` para importar módulos TS puros.

## Tarea
1. **Cierre de R5:** indica el estado de R5-01 … R5-11 (`CERRADO | PARCIAL | ABIERTO`) con la **salida real** de tus
   contraejemplos de R5 contra este commit.
2. **Regresiones introducidas por E12f-E12j.** Busca en particular:
   - el reparto 50/50 de cargas lineales cuando hay una dovela aérea vecina, una carga en el borde de una `udl`, o una
     carga sobre una dovela muy delgada creada por los quiebres `x ± 1e-6·ancho`;
   - la ida y vuelta sin redondeo: ¿algún valor que JSON no puede representar, como `-0`, `1e400` o `NaN`, entra o
     sale silenciosamente?
   - `openOgsJson` estricto: ¿rechaza ahora algún archivo válido del motor, por ejemplo los 21 casos con
     `{model, checks}`, `meta` o `units`?
   - DXF: ¿la detección de extrusión rechaza archivos 2D comunes de AutoCAD o de QGIS, por ejemplo con 210/220/230 =
     (0, 0, 1) explícito o con −0?
   - PWA: el flujo de actualización, ¿puede dejar la app sin service worker o hacer recargas en bucle?
   - Workflows: permisos y condiciones.
3. **Prioriza:** separa lo que bloquea publicar la Fase 1 (HIGH o CRITICAL, con evidencia reproducible) de lo que queda
   para después.

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. Tabla de cierre de R5: `ID | estado | evidencia`.
3. Hallazgos nuevos: `ID (R6-xx) | severidad | archivo:línea | descripción | evidencia | corrección sugerida`.
4. Bloqueantes frente a pendientes.
5. Cobertura.
