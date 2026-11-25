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
  V016a: { title: 'Muro de gaviones escalonado, cohesión equivalente', source: 'Cao et al., 2016; Grodecki, 2017' },
  V019: { title: 'Talud homogéneo de 11 m', source: 'Cheng et al., 2007' },
  V025: { title: 'Talud homogéneo 2H:1V con línea piezométrica', source: 'Duncan y Wright, fig. 6.38' },
  V030: { title: 'Relleno sin cohesión sobre arcilla no drenada', source: 'Duncan y Wright, fig. 14.4' },
  V033: { title: 'Relleno sobre arena con nivel freático', source: 'Duncan y Wright, fig. 14.20a' },
  V044: { title: 'Talud homogéneo 2H:1V de 40 ft, seco', source: 'Fredlund y Krahn, 1977' },
  V044b: { title: 'Talud homogéneo 2H:1V con ru = 0,25', source: 'Fredlund y Krahn, 1977' },
  V045: { title: 'Talud homogéneo 2H:1V con nivel freático', source: 'Fredlund y Krahn, 1977' },
  V047a: { title: 'ACADS 1(a): talud homogéneo seco', source: 'Giam y Donald, 1989' },
  V049: { title: 'ACADS 1(c): talud de tres estratos', source: 'Giam y Donald, 1989' },
  V063: { title: 'Presa de tierra homogénea, seca', source: 'Huang y Jia, 2009' },
  V081a: { title: 'Talud de arena de 45° con sobrecarga, sin refuerzo', source: 'Sharma, 1996' },
  V081b: { title: 'Talud de arena con zona reforzada (φ = 54,93°)', source: 'Sharma, 1996' },
  V093: { title: 'Talud homogéneo 2H:1V de 5 m', source: 'Yamagami y Ueta, 1988' },
  V097a: { title: 'Corte en arcilla con sobrecarga (Eurocódigo 7)', source: 'manual de verificación de un programa comercial' },
  V101: { title: 'Talud homogéneo 1H:1V con ru = 0,2', source: 'Li y Lumb, 1987' },
  V102a: { title: 'Talud 3H:1V en su coeficiente sísmico crítico, seco', source: 'Loukidis et al., 2003' },
  V102b: { title: 'Talud 3H:1V en su coeficiente sísmico crítico, ru = 0,5', source: 'Loukidis et al., 2003' },
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
