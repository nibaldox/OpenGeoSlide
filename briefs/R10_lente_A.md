**Lente A: matemática, datos y contratos.**

1. **Morgenstern-Price (E13d, E13j-8):**
   - ¿Las cinco funciones y ξ coinciden con el contrato y con cSlope?
   - ¿El residuo de momento generalizado reduce exactamente a Spencer con f ≡ 1?
   - ¿El barrido sobre λ·f̄ puede perder raíces?
   - ¿f congelada en los tramos aéreos conserva el equilibrio?
   - Prueba funciones asimétricas y `data_points` raros: con f casi nula, con picos o con un solo punto interior.
2. **Janbu (E13e, E13j-2, E13j-4, E13j-7):**
   - ¿F₀ es la raíz correcta del cierre de fuerzas?
   - ¿f₀, d, L y b₁ siguen a Janbu (1973) y a cSlope?
   - ¿Qué pasa con d ≤ 0, con superficies cóncavas hacia arriba o con un bloque de una sola dovela?
3. **Polilínea (E13c, E13j-5):**
   - ajuste al terreno: prolongación, recorte y primer cruce;
   - admisibilidad;
   - nodos obligatorios;
   - dirección de deslizamiento;
   - casos límite: dos puntos, vértice exactamente sobre el terreno o sobre un vértice del terreno, tramos casi
     verticales, x casi repetidas y polilíneas que cruzan una interfaz de materiales en un vértice.
4. **No drenado (E13b):**
   - Su(y) en el punto medio de la base;
   - el límite con gradiente negativo;
   - la identidad con Mohr-Coulomb con φ = 0;
   - la interacción con `ru`, la piezométrica y `unit_weight_sat`.
5. **Escala E13j-6:**
   - ¿`max(ΣW, ΣW*)` puede **ocultar** un cierre malo en un modelo con cargas grandes?
   - ¿La clasificación E7d con esa escala puede degradar a «nota» una tracción real?
6. **E13k:**
   - ¿`r_v` está bien definido, con las caras, E′ y el agua?
   - ¿El umbral 3 deja pasar soluciones no físicas? Busca contraejemplos con FS ≫ Janbu sin aviso.
7. **Verificación:**
   - ¿los 213 checks y la batería prueban lo que dicen?
   - ¿algún caso promovido tiene datos convertidos mal, como el sentido de deslizamiento, el agua o los métodos?
   - Reproduce al menos 5 casos v0.3 con ogs y con cSlope.
8. **Contrato frente a código:** ¿hay alguna enmienda E13 que el código no cumpla, o algún comportamiento del código
   que el contrato no declare?
