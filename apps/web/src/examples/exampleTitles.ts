// Nombres en español de los casos de verificación publicados, para mostrarlos como ejemplos (UX9-04).
// Los archivos `verification/cases/*.json` y sus ids no cambian: solo se traduce lo que se muestra. Cada entrada lleva
// el nombre y, entre paréntesis en el listado, la fuente.

export interface ExampleTitle {
  /** Nombre para mostrar, en español. */
  title: string;
  /** Fuente corta, que el listado muestra entre paréntesis. */
  source: string;
}

export const exampleTitles: Readonly<Record<string, ExampleTitle>> = {
  V001: { title: 'Talud homogéneo de 20 m, 1,5H:1V', source: 'Arai y Tagyo, 1985, ejemplo 1' },
  V002: { title: 'Talud de tres estratos con una capa media débil', source: 'Arai y Tagyo, 1985, ejemplo 2' },
  V003: { title: 'Talud homogéneo con nivel freático', source: 'Arai y Tagyo, 1985, ejemplo 3' },
  V004a: { title: 'Talud 4H:1V, ajuste de Mohr-Coulomb', source: 'manual de verificación de un programa comercial' },
  V004b: { title: 'Talud de Baker (2003), ejemplo 2, parámetros iterados de Mohr-Coulomb', source: 'Baker, 2003; manual de un programa comercial' },
  V005: { title: 'Presa de Baker (1993) al fin de la construcción, cara de talud infinito', source: 'Baker, Frydman y Talesnick, 1993' },
  V007b: { title: 'Talud de Baker (2003), ejemplo 1, parámetros iterados de Mohr-Coulomb', source: 'Baker, 2003; manual de un programa comercial' },
  V008a: { title: 'Talud de Baker (2003), ejemplo 1, ajuste de Mohr-Coulomb', source: 'Baker, 2003, ejemplo 1' },
  V008b: { title: 'Talud de arcilla de Londres (Baker, 2003), ajuste de Mohr-Coulomb', source: 'Baker, 2003, ejemplo 3' },
  V013a: { title: 'Talud de Cai y Ugai (2000), sin pilote', source: 'Cai y Ugai, 2000' },
  V016a: { title: 'Muro de gaviones escalonado, cohesión equivalente', source: 'Cao et al., 2016; Grodecki, 2017' },
  V016c: { title: 'Muro de gaviones con juntas débiles', source: 'Cao et al., 2016; Grodecki, 2017' },
  V019: { title: 'Talud homogéneo de 11 m', source: 'Cheng et al., 2007' },
  V020: { title: 'Talud con bancos de Cheng et al., mínimo global', source: 'Cheng, Lansivaara y Wei, 2007' },
  V025: { title: 'Talud homogéneo 2H:1V con línea piezométrica', source: 'Duncan y Wright, fig. 6.38' },
  V027: { title: 'Arcilla no drenada de Duncan y Wright, fig. 14.3', source: 'Duncan y Wright, fig. 14.3' },
  V028: { title: 'Arcilla no drenada (fig. 14.3) sobre una cimentación de 46,5 ft', source: 'Duncan y Wright; manual de un programa comercial' },
  V029: { title: 'Arcilla no drenada (fig. 14.3) sobre una cimentación de 60 ft', source: 'Duncan y Wright; manual de un programa comercial' },
  V030: { title: 'Relleno sin cohesión sobre arcilla no drenada', source: 'Duncan y Wright, fig. 14.4' },
  V031a: { title: 'Duncan y Wright, fig. 14.5, R = 87 ft', source: 'Duncan y Wright, fig. 14.5' },
  V031b: { title: 'Duncan y Wright, fig. 14.5, R = 102 ft', source: 'Duncan y Wright, fig. 14.5' },
  V032b: { title: 'Duncan y Wright, fig. 14.7, mecanismo de talud infinito', source: 'Duncan y Wright, fig. 14.7' },
  V033: { title: 'Relleno sobre arena con nivel freático', source: 'Duncan y Wright, fig. 14.20a' },
  V044: { title: 'Talud homogéneo 2H:1V de 40 ft, seco', source: 'Fredlund y Krahn, 1977' },
  V044b: { title: 'Talud homogéneo 2H:1V con ru = 0,25', source: 'Fredlund y Krahn, 1977' },
  V045: { title: 'Talud homogéneo 2H:1V con nivel freático', source: 'Fredlund y Krahn, 1977' },
  V047a: { title: 'ACADS 1(a): talud homogéneo seco', source: 'Giam y Donald, 1989' },
  V049: { title: 'ACADS 1(c): talud de tres estratos', source: 'Giam y Donald, 1989' },
  V052a: { title: 'Presa Talbingo al fin de la construcción', source: 'Giam y Donald, 1989 (ACADS)' },
  V052b: { title: 'Presa Talbingo, círculo especificado', source: 'Giam y Donald, 1989 (ACADS)' },
  V054: { title: 'Greco (1996), ejemplo 5 / Chen y Shao (1988)', source: 'Greco, 1996; Chen y Shao, 1988' },
  V055: { title: 'Griffiths y Lane, ejemplo 2, talud con un estrato de cimentación', source: 'Griffiths y Lane, 1999' },
  V060a: { title: 'Presa Cannon al fin de la construcción, círculo crítico', source: 'Hassan y Wolff, 1999' },
  V060b: { title: 'Presa Cannon al fin de la construcción, confiabilidad sobre el círculo de β mínimo', source: 'Hassan y Wolff, 1999' },
  V062a: { title: 'Presa Clarence Cannon, superficie 7A', source: 'Hassan y Wolff, 1999' },
  V062b: { title: 'Presa Clarence Cannon, superficie 7B', source: 'Hassan y Wolff, 1999' },
  V062c: { title: 'Presa Clarence Cannon, superficie 7C', source: 'Hassan y Wolff, 1999' },
  V062d: { title: 'Presa Clarence Cannon, superficie 7D', source: 'Hassan y Wolff, 1999' },
  V062e: { title: 'Presa Clarence Cannon, superficie 7E', source: 'Hassan y Wolff, 1999' },
  V062f: { title: 'Presa Clarence Cannon, superficie 8B', source: 'Hassan y Wolff, 1999' },
  V062g: { title: 'Presa Clarence Cannon, superficie 8F', source: 'Hassan y Wolff, 1999' },
  V062h: { title: 'Presa Clarence Cannon, superficie 8G', source: 'Hassan y Wolff, 1999' },
  V062i: { title: 'Presa Clarence Cannon, superficie 8H', source: 'Hassan y Wolff, 1999' },
  V063: { title: 'Presa de tierra homogénea, seca', source: 'Huang y Jia, 2009' },
  V069a: { title: 'Vaciado rápido completo de Morgenstern, 3H:1V', source: 'Morgenstern, 1963' },
  V069b: { title: 'Vaciado rápido completo de Morgenstern, círculo de referencia', source: 'Morgenstern, 1963' },
  V071a: { title: 'Talud 1 de Pockoski y Duncan (2000)', source: 'Pockoski y Duncan, 2000' },
  V071b: { title: 'Talud 1 de Pockoski y Duncan, búsqueda circular', source: 'Pockoski y Duncan, 2000; manual de un programa comercial' },
  V081a: { title: 'Talud de arena de 45° con sobrecarga, sin refuerzo', source: 'Sharma, 1996' },
  V081b: { title: 'Talud de arena con zona reforzada (φ = 54,93°)', source: 'Sharma, 1996' },
  V090: { title: 'USACE EM 1110-2-1902, ejemplo F-5', source: 'USACE, 2003' },
  V093: { title: 'Talud homogéneo 2H:1V de 5 m', source: 'Yamagami y Ueta, 1988' },
  V095a: { title: 'Talud con micropilotes de Yamagami, sin pilote', source: 'Yamagami et al., 2000' },
  V096d: { title: 'Talud de Zhu y Lee, superficie 3 del artículo, seco', source: 'Zhu y Lee, 2002' },
  V096e: { title: 'Talud de Zhu y Lee, superficie 3 del artículo, con nivel freático', source: 'Zhu y Lee, 2002' },
  V097a: { title: 'Corte en arcilla con sobrecarga (Eurocódigo 7)', source: 'manual de verificación de un programa comercial' },
  V098: { title: 'Talud de ejemplo sin carga sísmica', source: 'manual de verificación de un programa comercial' },
  V101: { title: 'Talud homogéneo 1H:1V con ru = 0,2', source: 'Li y Lumb, 1987' },
  V102a: { title: 'Talud 3H:1V en su coeficiente sísmico crítico, seco', source: 'Loukidis et al., 2003' },
  V102b: { title: 'Talud 3H:1V en su coeficiente sísmico crítico, ru = 0,5', source: 'Loukidis et al., 2003' },
  V104a: { title: 'Terraplén sobre arcilla sin exceso de presión de poros (tutorial de B-barra, paso 1)', source: 'tutorial de un programa comercial' },
};

/** Nombre para mostrar de un caso: el de la tabla o, si el id no está (un archivo propio), el título original. */
export function exampleTitle(id: string, fallback: string): string {
  return exampleTitles[id]?.title ?? fallback;
}

/** Texto del listado de ejemplos: «V047a: ACADS 1(a): talud homogéneo seco (Giam y Donald, 1989)». */
export function exampleLabel(id: string, fallbackTitle: string): string {
  const entry = exampleTitles[id];
  return entry ? `${id}: ${entry.title} (${entry.source})` : `${id}: ${fallbackTitle}`;
}
