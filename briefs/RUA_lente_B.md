**Lente B: contrato, accesibilidad, presentación y un ingeniero que firma.** Comprueba que el producto cumple el
contrato (`briefs/UA_CONTRATO.md`, enmiendas incluidas) y que la interfaz no induce a error a un ingeniero geotécnico
que firma un informe con la herramienta.

Prioridad de pruebas:
1. **Lo que comunica el resultado.**
   - **FS mínimo:** que el HUD (`fs-min`) y el chip (`runStatus`) sean correctos con métodos que no convergen, con
     resultados parciales, con empates, con FS < 1 y con un resultado desactualizado.
   - **Lectura del chip:** ¿«Calculado · FS mín. 1,356» en tono «ok» (verde) se lee como «talud seguro»? Opina como
     ingeniero; el contrato UA-D8 dice que la app no juzga la aceptabilidad.
   - **Métodos en el HUD:** ¿el HUD oculta métodos o avisos que antes se veían en la franja de resultados?
   - **Avisos del cálculo:** ¿quedaron menos visibles en la vista Lienzo, ahora que la tabla y Diagnósticos están en
     otra vista?
2. **Resúmenes de los pasos** (`editor/app/shellModel.ts`):
   - con modelos reales de `verification/cases/` (imperial, con refuerzos, sismo, cargas, búsqueda no circular y
     agua);
   - unidades, coma decimal y redondeos;
   - un resumen que diga algo falso del modelo, como «Sin piezométrica» cuando la hay, o un área en la unidad
     equivocada.
3. **Vista Informe** (`reportContents`): ¿la lista coincide con las secciones que de verdad genera el PDF (`report/`)
   para cada modelo? Genera el PDF de 2-3 casos, rasterízalo y compara.
4. **Accesibilidad**, en los dos temas, en las 4 vistas y a 1440, 1024 y 390:
   - axe completo (no solo serias);
   - el orden del foco, el foco visible, `aria-describedby` de los pasos y el patrón de pestañas;
   - la regla `label-content-name-mismatch` (UA-E2);
   - el contraste de los textos sobre `--ui-accent-bg`, los chips y la leyenda translúcida sobre el lienzo con
     materiales oscuros, y las bandas de entrada y salida.
5. **Contrato visual** frente a la maqueta (`~/archivos/geo-suite-design/src/flujo.html` y su captura):
   - medidas de §2 y tokens de §3;
   - ningún color literal fuera de `tokens.css`;
   - fuentes en la precarga de la PWA (`dist/sw.js`) y sin peticiones de red externas;
   - el ícono de la app.

   Marca las desviaciones visibles con una captura.
6. **Compatibilidad hacia atrás.** Los `data-testid` y nombres accesibles de §5 que desaparecieron o cambiaron sin que
   el contrato lo diga, la clave `ogs.theme.v1` con un valor antiguo, y el borrador recuperado de la versión anterior.
