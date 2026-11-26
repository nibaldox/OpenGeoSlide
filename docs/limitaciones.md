# Limitaciones

OpenGeoSlide v0.1.0 es software en desarrollo y no es una herramienta certificada. Esta página reúne lo que **no** hace
la versión actual, los avisos que muestra la aplicación y las limitaciones numéricas conocidas del motor. El resumen
está en el [README](../README.md#limitaciones-conocidas), y la aplicación lo enlaza desde su Ayuda.

## Alcance: lo que la versión actual no hace

- **Solo equilibrio límite en 2D** con **Bishop simplificado** y **Spencer**. No calcula deformaciones, ni análisis en
  tres dimensiones, ni flujo de agua: el agua entra como línea piezométrica o como coeficiente `ru`.
- **Solo superficies de falla circulares**, fijas o encontradas por la búsqueda de entrada y salida.
- **Solo el modelo Mohr-Coulomb** (peso unitario, cohesión y ángulo de fricción), con `unit_weight_sat` y `ru` opcionales.
- **Sin refuerzos.** No hay geosintéticos, anclajes ni pernos en el formato ni en el motor. OpenGeoSlide **no sirve para
  diseñar muros de tierra mecánicamente estabilizada (TEM) ni otras estructuras de contención**: solo para revisar la
  estabilidad global con el muro modelado como una región de suelo con sus propiedades equivalentes.
- **Sismo solo pseudoestático** (`kh` y `kv`, aplicados al peso del suelo, nunca a las cargas) y **cargas solo `udl` y
  `line`**. No hay análisis dinámico ni de desplazamientos.
- **No está en PyPI ni en crates.io**: se instala desde la web, desde el código fuente o desde los assets del
  [GitHub Release](https://github.com/nibaldox/OpenGeoSlide/releases).

## Avisos geotécnicos de la aplicación

Estos casos están cubiertos por avisos en «Diagnósticos» y en el informe PDF:

- **`unit_weight_sat` (γsat) no está verificado frente a otro programa.** Ninguno de los 21 casos de verificación lo
  usa. Cada modelo que lo usa lleva un aviso en Diagnósticos y en el informe.
- **La piezométrica se prolonga en horizontal hasta los bordes del modelo** cuando no cubre todo su ancho, con el nivel
  de su extremo más cercano. Se dibuja punteada y la leyenda dice «Piezométrica (extrapolada)».
- **`ru` tiene precedencia sobre la piezométrica:** si un material tiene `ru` y el modelo también tiene línea
  piezométrica, ese material usa `ru` y la piezométrica no se aplica.
- **Unidades imperiales con piezométrica:** el peso unitario del agua (γw) debe ser explícito y no menor que 20 pcf
  (se usa 62,4 pcf). Un valor como 9,81 es de kN/m³ y bloquea el cálculo, tanto en el editor como en «Casos».
  El motor nunca convierte unidades: interpreta los números en las unidades declaradas. Al cambiar de sistema, la web
  ofrece convertir los valores del modelo (el FS no cambia) o cambiar solo la etiqueta.
- **Convenciones de signo:** `kh` positivo va en el sentido del deslizamiento y `kv` positivo hacia abajo; el ángulo de
  la carga lineal se mide desde la vertical, positivo hacia +x. Otros programas pueden usar el signo contrario para
  `kv`: compare con cuidado. El informe PDF repite las convenciones.
- **Cargas puntuales o lineales:** pueden generar círculos diminutos con FS muy bajo bajo ellas. Fije un «ancho mínimo»
  de búsqueda y revise aparte la capacidad de soporte local.

## Limitaciones numéricas conocidas del motor

Limitaciones que las revisiones adversariales ([`docs/reviews/`](reviews/)) dejaron abiertas, más las que dejó la
verificación de la ola B. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (51/51)
ni la batería diferencial (28/28 + 28/28 en D01-D14).

- **R4-01, selección de la raíz de λ en Spencer (resuelto por E12e):** entre varias raíces admisibles, Spencer elige
  la de menor F (conservadora), y a igualdad la de menor |λ|. Con la selección anterior (menor |λ|) 47 de 1008 casos
  bicapa diferían más de 1 % de cSlope. Aviso: `multiple_admissible_roots` (nota) cuando hay más de una raíz admisible.
  Residual: cuando cSlope sigue otra raíz, ogs puede quedar por debajo de cSlope (caso R4-01 (2): −7,08 %), por
  elegir la raíz de menor F, y con la nota `multiple_admissible_roots`.
- **R5-05, Spencer con tracción (decidido tras X7: se mantiene E12e):** cuando aparecen juntas las notas
  `multiple_admissible_roots` y `negative_effective_normal_major`, el FS de Spencer puede corresponder a una rama con
  tracción y quedar por debajo de Bishop (hasta −14,30 % frente a cSlope en la familia bicapa de superficie fija de X7;
  −13,9 % en R5-2). Se recomienda revisar Bishop y la distribución de N′. La alternativa evaluada (descartar las raíces con N′
  mayor si hay otra admisible) corrige 49 de 67 casos por debajo de cSlope, pero crea 9 por encima (hasta +10,13 % en
  superficie fija y +7,50 % en búsqueda), lo que contradice el criterio conservador. Evidencia:
  [`docs/fase1/exploracion/X7.md`](fase1/exploracion/X7.md). Aviso: `multiple_admissible_roots`,
  `negative_lambda` y `negative_effective_normal_major`.
- **E12f, cargas lineales fuera del bloque analizado:** una carga lineal que cae a más de `1e-9·ancho` del modelo fuera
  del bloque de suelo analizado no actúa, aunque esté muy cerca del pie de la superficie. Dentro de esa tolerancia, y en
  las fronteras de dovela o los extremos del bloque, sí actúa (reparto 50/50 entre dovelas compartidas). Aviso:
  `load_outside_mass`.
- **Cargas lineales y superficies locales (D13):** una carga puntual o lineal puede generar bajo ella círculos
  diminutos con m_α < `min_m_alpha` (en D13, un círculo de 0,67 m con FS 0,614 en cSlope, que avisa `low-m-alpha`).
  ogs los rechaza (E4b). Conviene fijar `search.min_width` (D13 usa 5 m, y entonces ogs y cSlope coinciden en
  +0,03 %) y revisar aparte la capacidad de soporte local bajo la carga: un análisis de estabilidad global no la cubre.
- **R4-02, paso fijo de 0,05 en el barrido de λ:** dos raíces admisibles dentro del mismo paso no se detectan y el
  resultado es `no_lambda_root`, aunque cSlope converge (p. ej., c_top = 74,05: cSlope 1,914138 y ogs sin FS).
  Aviso: `no_lambda_root`, con estado `not_converged` y sin FS.
- **R4-03a, avisos de búsqueda:** `truncated_driving_mass` solo se evalúa en la superficie final. Si el círculo crítico
  ganador no está truncado, el aviso de un bloque descartado motriz de un candidato truncado se pierde.
  Aviso: ninguno en ese caso.
- **Frontera de `min_width` (E11d′):** la búsqueda no alcanza la frontera ancho = `min_width`. En el botadero de
  dos bancos con `min_width = 10`, ogs da 0,855 frente a 1,142 de cSlope (conservador). Aviso:
  `effective_width_below_min` y `truncated_mass`.
- **Bloques descartados que salen por una pared lateral (E11e′):** no se pueden clasificar, así que solo reciben la
  nota `truncated_mass`, aunque sean motrices. Aviso: `truncated_mass`.
- **`unit_weight_sat` sin cobertura:** ninguno de los 21 casos de verificación (los 5 de la ola B tampoco) usa
  `unit_weight_sat`. La ruta de peso saturado bajo la piezométrica no está verificada frente a cSlope. Aviso: ninguno.
