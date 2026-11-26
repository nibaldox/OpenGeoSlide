// Tabla de acuerdo de los refuerzos v0.4 (F4.2, E14m-3): documentos que el motor y la web deben aceptar o rechazar igual.
// Es la transcripción de `V04_TABLE` y `V04_ENGINE_ONLY_TABLE` de `verification/tools/test_schema.py`, con un cambio por E14m-3:
// `pile` y `sheet_pile` ya no llevan `location` (la web y el esquema lo rechazan como campo desconocido). Solo para tests.

export type Json = Record<string, unknown>;
export type Mutation = (model: Json) => void;

/** Marca de «quitar la clave». */
export const DEL = Symbol('del');

export interface ParityRow {
  name: string;
  mutate: Mutation;
  accepted: boolean;
  /** Fila cuyo veredicto del motor depende de `location`: mientras el motor de la base aún lo exige, no se compara con él. */
  locationRow?: boolean;
  /** Rechazo que solo declara el motor (el esquema JSON no lo expresa): el rechazo debe nombrar `reinforcements[`. */
  engineOnly?: boolean;
}

function setPath(model: Json, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = model;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Json;
  cur[keys[keys.length - 1] as string] = value;
}

const set =
  (path: string, value: unknown): Mutation =>
  (m) =>
    setPath(m, path, value);
const both =
  (...ms: Mutation[]): Mutation =>
  (m) => {
    for (const f of ms) f(m);
  };

function item(base: Json, fields: Record<string, unknown>): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(fields)) {
    if (v === DEL) delete out[k];
    else out[k] = v;
  }
  return out;
}

const anchor = (f: Record<string, unknown> = {}): Json =>
  item({ id: 'a1', type: 'anchor', x1: 44, y1: 12, x2: 30, y2: 8, tensile_capacity: 100, application: 'active', direction: 'axial' }, f);
const pile = (f: Record<string, unknown> = {}): Json =>
  item({ id: 'p1', type: 'pile', x1: 40, y1: 12, x2: 40, y2: 2, application: 'passive', force: 60, spacing: 1.5, direction: 'angle', angle: 0 }, f);
const sheet = (f: Record<string, unknown> = {}): Json =>
  item({ id: 's1', type: 'sheet_pile', x1: 40, y1: 12.5, x2: 40, y2: 0.5, application: 'active', force: 120, direction: 'perpendicular' }, f);
const reinf =
  (...items: Json[]): Mutation =>
  (m) => {
    m.reinforcements = items;
  };
const pull = (f: Record<string, unknown>): Json => anchor({ pullout: f });

const BOND = { model: 'bond', strength: 30 };
const IFACE = { model: 'interface', adhesion: 10, friction_angle: 20, coverage: 0.8 };
const DEVEL = { model: 'development', length1: 3, length2: 4 };
/** Un documento 0.1 no admite cargas ni sismo. */
const OLD: Mutation[] = [set('loads', []), set('analysis.seismic', null)];

const row = (name: string, mutate: Mutation, accepted: boolean, extra: Partial<ParityRow> = {}): ParityRow => ({ name, mutate, accepted, ...extra });

export const PARITY_TABLE: ParityRow[] = [
  // aceptados
  row('anchor', reinf(anchor()), true),
  row('empty list in 0.4', reinf(), true),
  row('no reinforcements in 0.4', set('version', '0.4'), true),
  row('nail with every optional field', reinf(anchor({ type: 'nail', end1_capacity: 5, end2_capacity: 7, spacing: 2.5, direction: 'bisector' })), true),
  row('geosynthetic tangent, application passive', reinf(anchor({ type: 'geosynthetic', direction: 'tangent', application: 'passive' })), true),
  row('null optionals', reinf(anchor({ end1_capacity: null, end2_capacity: null, spacing: null, pullout: null })), true),
  row('tensile_capacity 0', reinf(anchor({ tensile_capacity: 0 })), true),
  row('pullout bond', reinf(anchor({ pullout: BOND })), true),
  row('pullout bond strength 0', reinf(pull({ ...BOND, strength: 0 })), true),
  row('pullout bond with bonded_length 5', reinf(pull({ ...BOND, bonded_length: 5 })), true),
  row('pullout bond with bonded_length=null', reinf(pull({ ...BOND, bonded_length: null })), true),
  row('pullout interface', reinf(anchor({ pullout: IFACE })), true),
  row('pullout interface, coverage 1, friction 0, adhesion 0', reinf(pull({ ...IFACE, coverage: 1, friction_angle: 0, adhesion: 0 })), true),
  row('pullout development', reinf(anchor({ pullout: DEVEL })), true),
  row('pullout development 0 and 0', reinf(pull({ model: 'development', length1: 0, length2: 0 })), true),
  row('pile, direction angle 0', reinf(pile()), true),
  row('pile, angle 89.99', reinf(pile({ angle: 89.99 })), true),
  row('pile, angle -89.99', reinf(pile({ angle: -89.99 })), true),
  row('pile tangent without angle', reinf(pile({ direction: 'tangent', angle: DEL })), true),
  row('pile perpendicular with angle=null', reinf(pile({ direction: 'perpendicular', angle: null })), true),
  row('pile without spacing', reinf(pile({ spacing: DEL })), true),
  row('pile force 0', reinf(pile({ force: 0 })), true),
  row('sheet_pile', reinf(sheet()), true),
  row('sheet_pile with direction angle', reinf(sheet({ direction: 'angle', angle: -20 })), true),
  row('the five types', reinf(anchor(), anchor({ id: 'n', type: 'nail' }), anchor({ id: 'g', type: 'geosynthetic' }), pile(), sheet()), true),
  // compuerta de versión (F4.1)
  row('reinforcements in version 0.3', both(set('version', '0.3'), reinf(anchor())), false),
  row('reinforcements in version 0.2', both(set('version', '0.2'), reinf(anchor())), false),
  row('reinforcements in version 0.1', both(set('version', '0.1'), ...OLD, reinf(anchor())), false),
  row('empty reinforcements in version 0.3', both(set('version', '0.3'), reinf()), true),
  row('empty reinforcements in version 0.1', both(set('version', '0.1'), ...OLD, reinf()), true),
  row('reinforcements=null', set('reinforcements', null), false),
  row('reinforcements=null in version 0.3', both(set('version', '0.3'), set('reinforcements', null)), false),
  row('reinforcements that is not a list', set('reinforcements', { type: 'anchor' }), false),
  row('version 0.5', both(set('version', '0.5'), reinf(anchor())), false),
  // la etiqueta, los campos y las enumeraciones
  row('unknown type', reinf(anchor({ type: 'strut' })), false),
  row('without type', reinf(anchor({ type: DEL })), false),
  row('unknown field (prestress)', reinf(anchor({ prestress: 50 })), false),
  row('unknown field in a pile', reinf(pile({ diameter: 0.6 })), false),
  row('without id', reinf(anchor({ id: DEL })), false),
  row('without application', reinf(anchor({ application: DEL })), false),
  row('application null', reinf(anchor({ application: null })), false),
  row('application=both', reinf(anchor({ application: 'both' })), false),
  row('without direction', reinf(anchor({ direction: DEL })), false),
  row('direction=angle in an anchor', reinf(anchor({ direction: 'angle' })), false),
  row('direction=axial in a pile', reinf(pile({ direction: 'axial', angle: DEL })), false),
  row('without tensile_capacity', reinf(anchor({ tensile_capacity: DEL })), false),
  row('without x2', reinf(anchor({ x2: DEL })), false),
  row('x1 as a string', reinf(anchor({ x1: '44' })), false),
  row('anchor with force', reinf(anchor({ force: 5 })), false),
  row('pile with tensile_capacity', reinf(pile({ tensile_capacity: 5 })), false),
  // E14m-3: `location` ya no existe en la v0.4
  row('pile with location', reinf(pile({ location: 'slip_surface' })), false, { locationRow: true }),
  row('sheet_pile with location', reinf(sheet({ location: 'centroid' })), false, { locationRow: true }),
  row('pile without force', reinf(pile({ force: DEL })), false),
  row('sheet_pile with spacing', reinf(sheet({ spacing: 1 })), false),
  // rangos
  row('empty id', reinf(anchor({ id: '' })), false),
  row('tensile_capacity=-1', reinf(anchor({ tensile_capacity: -1 })), false),
  row('end1_capacity=-0.5', reinf(anchor({ end1_capacity: -0.5 })), false),
  row('end2_capacity=-0.5', reinf(anchor({ end2_capacity: -0.5 })), false),
  row('spacing=0', reinf(anchor({ spacing: 0 })), false),
  row('spacing=-1', reinf(pile({ spacing: -1 })), false),
  row('force=-1 in a pile', reinf(pile({ force: -1 })), false),
  row('force=-1 in a sheet_pile', reinf(sheet({ force: -1 })), false),
  row('pullout without model', reinf(pull({ strength: 30 })), false),
  row('pullout model=grout', reinf(pull({ model: 'grout' })), false),
  row('pullout bond without strength', reinf(anchor({ pullout: { model: 'bond' } })), false),
  row('pullout bond strength=-1', reinf(pull({ ...BOND, strength: -1 })), false),
  row('pullout bond bonded_length=0', reinf(pull({ ...BOND, bonded_length: 0 })), false),
  row('pullout bond bonded_length=-1', reinf(pull({ ...BOND, bonded_length: -1 })), false),
  row('pullout bond with adhesion', reinf(pull({ ...BOND, adhesion: 1 })), false),
  row('pullout interface coverage=0', reinf(pull({ ...IFACE, coverage: 0 })), false),
  row('pullout interface coverage=1.0001', reinf(pull({ ...IFACE, coverage: 1.0001 })), false),
  row('pullout interface friction_angle=90', reinf(pull({ ...IFACE, friction_angle: 90 })), false),
  row('pullout interface friction_angle=-0.1', reinf(pull({ ...IFACE, friction_angle: -0.1 })), false),
  row('pullout interface adhesion=-1', reinf(pull({ ...IFACE, adhesion: -1 })), false),
  row('pullout interface without coverage', reinf(anchor({ pullout: { model: 'interface', adhesion: 10, friction_angle: 20 } })), false),
  row('pullout development length1=-1', reinf(pull({ ...DEVEL, length1: -1 })), false),
  row('pullout development length2=-1', reinf(pull({ ...DEVEL, length2: -1 })), false),
  row('pullout development without length2', reinf(anchor({ pullout: { model: 'development', length1: 1 } })), false),
  // ángulo (F4.2): obligatorio solo con direction «angle», en (−90, 90)
  row('pile angle required with direction angle', reinf(pile({ angle: DEL })), false),
  row('pile angle null with direction angle', reinf(pile({ angle: null })), false),
  row('pile angle with tangent', reinf(pile({ direction: 'tangent', angle: 10 })), false),
  row('pile angle with perpendicular', reinf(pile({ direction: 'perpendicular', angle: 10 })), false),
  row('pile angle=90', reinf(pile({ angle: 90 })), false),
  row('pile angle=-90', reinf(pile({ angle: -90 })), false),
  row('pile angle=95', reinf(pile({ angle: 95 })), false),
  row('sheet_pile angle required with direction angle', reinf(sheet({ direction: 'angle' })), false),
  row('sheet_pile angle with tangent', reinf(sheet({ direction: 'tangent', angle: 10 })), false),
  row('sheet_pile angle=90', reinf(sheet({ direction: 'angle', angle: 90 })), false),
  // reglas que solo declara el motor (el esquema JSON las acepta)
  row('repeated id', reinf(anchor(), pile({ id: 'a1' })), false, { engineOnly: true }),
  row('repeated id between two anchors', reinf(anchor(), anchor()), false, { engineOnly: true }),
  row('anchor with length 0', reinf(anchor({ x2: 44, y2: 12 })), false, { engineOnly: true }),
  row('pile with length 0', reinf(pile({ y2: 12 })), false, { engineOnly: true }),
  row('inclined sheet_pile', reinf(sheet({ x2: 41 })), false, { engineOnly: true }),
  row('sheet_pile with x1 != x2 by 1e-9', reinf(sheet({ x2: 40.000000001 })), false, { engineOnly: true }),
  row('bonded_length > L', reinf(pull({ ...BOND, bonded_length: 15 })), false, { engineOnly: true }),
];

/** El modelo completo v0.2 de `test_schema.py::_base_v02` (V097a con una carga lineal y el sismo), declarado 0.4 y sin refuerzos. */
export function baseV04(v097a: Json): Json {
  const model = JSON.parse(JSON.stringify(v097a)) as Json;
  model.loads = [
    { type: 'udl', id: 'u1', x1: 52, x2: 62, q: 35 },
    { type: 'line', id: 'l1', x: 40, p: 20, angle: 10 },
  ];
  (model.analysis as Json).seismic = { kh: 0.1, kv: 0 };
  model.version = '0.4';
  return model;
}

/** Los rechazos con el puntero del motor (`test_schema.py::test_the_engine_errors_carry_the_json_path_of_the_field`). */
export const ENGINE_PATH_ROWS: { mutate: Mutation; enginePath: string; localPath: string }[] = [
  { mutate: reinf(anchor(), pile({ id: 'p' }), anchor({ id: 'a3', pullout: { ...IFACE, coverage: 0 } })), enginePath: 'reinforcements[2].pullout.coverage', localPath: '/reinforcements/2/pullout/coverage' },
  { mutate: reinf(anchor({ tensile_capacity: -1 })), enginePath: 'reinforcements[0].tensile_capacity', localPath: '/reinforcements/0/tensile_capacity' },
  { mutate: reinf(pile({ direction: 'tangent', angle: 10 })), enginePath: 'reinforcements[0].angle', localPath: '/reinforcements/0/angle' },
  { mutate: reinf(sheet({ x2: 41 })), enginePath: 'reinforcements[0].x2', localPath: '/reinforcements/0/x2' },
  { mutate: reinf(pull({ ...BOND, bonded_length: 15 })), enginePath: 'reinforcements[0].pullout.bonded_length', localPath: '/reinforcements/0/pullout/bonded_length' },
];
