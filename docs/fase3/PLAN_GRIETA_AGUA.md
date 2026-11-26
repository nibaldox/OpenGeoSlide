# Plan del bloque F3G: grieta de tracción y agua embalsada (formato v0.5, versión v0.4.0)

Plan del coordinador, basado en la exploración:
- `docs/fase3/exploracion/X18.md`: oráculo y casos;
- `X19.md`: práctica y referencias, con la nota del coordinador sobre Slide2;
- `X20.md`: motor, formato y web;
- `X21.md`: prototipo contra el oráculo, en curso.

El contrato normativo será `briefs/04_CONTRATOS_GRIETA_AGUA.md`, con las enmiendas E15.

## 1. Decisiones ya tomadas

- **D1, agua embalsada automática en todas las versiones (decisión del usuario, 2026-11-26).**
  - **Qué pasa hoy.** Con la piezométrica sobre el terreno, el motor cuenta la presión de poros con la carga completa,
    pero ni el peso ni el empuje del agua. El FS sale muy bajo y el aviso `water_above_ground` no lo explica.
  - **Mediciones** en V047a con 2 m de agua al pie, medidas por X20 y reproducidas por el coordinador:

    | Caso | ogs hoy | cSlope con agua libre |
    |---|---:|---:|
    | Superficie fija | 0,848 | 0,939 |
    | Búsqueda | 0,132 | 0,924 |

  - **Regla nueva.** Slide2, SLOPE/W y cSlope crean el agua embalsada **automáticamente** entre la piezométrica y el
    terreno, con su peso y su empuje. OpenGeoSlide hará lo mismo en **todas** las versiones del formato.
  - **Excepción documentada a la identidad byte a byte** con la v0.3.0, como la de V065: cambian solo los modelos con
    agua sobre el terreno, que hoy llevan el aviso.
  - **No hay campo nuevo** para el agua embalsada.
- **D2, Ito-Matsui en una ola propia al final del bloque.** Va después del núcleo de grieta y agua, y no retrasa la
  publicación si se complica. Es la opción recomendada; el usuario no respondió y la decisión se puede cambiar sin
  costo.
- **D3, la grieta de tracción va en el formato v0.5 (`analysis.tension_crack`).** La forma exacta del campo depende de
  X21:
  - profundidad fija o automática;
  - agua en la grieta como fracción o como lleno o seco;
  - posición con `x` fija o, como cSlope, en el extremo de aguas arriba de cada superficie.

  La versión del producto será la **v0.4.0**.

## 2. Qué desbloquea

Fuente: X18 §3.1. Las cifras son checks con el oráculo dentro de la tolerancia de su fuente.

| Capacidad | Checks | Dentro de tolerancia | Casos |
|---|---:|---:|---:|
| Grieta seca | 31 | 31 | 11 |
| Grieta con agua, incluida la seca | 46 | 46 | 17 |
| Agua embalsada | 38 | 34 | 14 |
| **Las dos** | **86** | **81** | **33** |
| Ito-Matsui (ola propia) | 4 | 4 | 4 |

Los 5 checks fuera de tolerancia, en V009b, V086a, V087 y V092, quedan retenidos con su causa en `HOLD.json`, que
X18 ya diagnosticó. **No se relaja nada.**

## 3. Física (se congela con X21)

- **Agua embalsada.** Por cada dovela:
  - el peso vertical de la columna de agua, `γw·∫h dx`;
  - el empuje horizontal, igual a la pendiente del terreno por ese peso;
  - la presión de poros sin recortar en la base.

  Además:
  - La carga cubre **toda** el agua del modelo, no solo la de la masa (X20 §1.6).
  - El sismo **no** actúa sobre el agua; `kh` está medido y `kv` lo mide X21.
  - La interacción con `ru` y con el agua libre de `interface` (E14o-4) la mide X21.
- **Grieta de tracción:**
  - **profundidad:** `z = 2c/(γ·tan(45° − φ/2))`, o `2·Su/γ` con φ = 0 (USACE EM 1110-2-1902, ec. C-36), o un valor
    fijo;
  - **superficie:** termina en la base de la grieta, con una cara vertical;
  - **agua en la grieta:** `½·γw·hw²`, horizontal, en el sentido del deslizamiento, a `hw/3` sobre la base;
  - **en la búsqueda:** el trato de los candidatos que no alcanzan la grieta lo fija X21.

## 4. Olas

| Ola | Contenido |
|---|---|
| **G0** | Tipos y esquema 0.5, el stub y los tests RED. Un escritor. Mientras tanto, X21 cierra las secciones `[condicional X21]` del contrato. |
| **G1** | **M-agua:** `water.rs`, la carga automática.<br>**M-grieta:** `crack.rs`, el truncado de la superficie y la búsqueda.<br>**M-val:** la validación, el esquema y la versión mínima.<br>**V:** la verificación, que promueve los 33 casos.<br>**W1:** los paneles y la entrada y salida.<br>**W2:** el lienzo (relleno azul del agua y tirador de la grieta), el informe, el CSV y la Ayuda. |
| **G2** | Integración, identidad y regresión de Chrome completa. |
| **G3** | Ito-Matsui, en una ola propia. |
| **R12** | Revisión adversarial con Antigravity, en dos lentes, y su ola de correcciones. |
| **v0.4.0** | Gates completos, y se espera el **«sube»** del usuario antes del push. |
