// CM-WA: selector de ejemplos (ExamplePicker). Lógica pura con el catálogo real de `verification/cases` y el componente
// sobre el renderizador mínimo de `panels/hookHarness.ts` (estado y eventos de verdad, sin DOM).
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../panels/hookHarness')).hookOverrides }));

import { loadBuiltinCases } from '../../cases';
import { changeEvent, mount, type HostNode } from '../panels/hookHarness';
import {
  EXAMPLE_KINDS,
  EXAMPLE_SELECT_LABEL,
  ExamplePicker,
  FEATURED_EXAMPLES,
  enterAction,
  exampleKind,
  featuredEntries,
  filterExamples,
  groupExamples,
  normalizeText,
  resultCountText,
} from './ExamplePicker';

const cases = loadBuiltinCases();
const byId = (id: string) => cases.find((c) => c.caseData.id === id)!;

describe('catálogo y tipos', () => {
  it('cada caso cae en exactamente un grupo, en el orden de los tipos y sin grupos vacíos', () => {
    const groups = groupExamples(cases);
    const all = groups.flatMap((g) => g.entries.map((e) => e.key));
    expect(all).toHaveLength(cases.length);
    expect(new Set(all).size).toBe(cases.length);
    expect(groups.every((g) => g.entries.length > 0)).toBe(true);
    const order = EXAMPLE_KINDS.map((k) => k.id as string);
    const idx = groups.map((g) => order.indexOf(g.kind));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    // Dentro de un grupo se conserva el orden del catálogo.
    for (const g of groups) expect(g.entries.map((e) => e.key)).toEqual(cases.filter((c) => g.entries.includes(c)).map((c) => c.key));
  });

  it('clasifica por el rasgo principal', () => {
    expect(exampleKind(byId('V001').caseData.model)).toBe('homogeneous');
    expect(exampleKind(byId('V003').caseData.model)).toBe('water');
    expect(exampleKind(byId('V002').caseData.model)).toBe('layered');
    expect(exampleKind(byId('V037').caseData.model)).toBe('reinforced');
    expect(exampleKind(byId('HAM1').caseData.model)).toBe('nonlinear');
    expect(exampleKind(byId('V001-nc').caseData.model)).toBe('noncircular');
    expect(exampleKind(byId('V048').caseData.model)).toBe('crack');
  });
});

describe('ejemplos destacados', () => {
  it('son de 6 a 8, existen en el catálogo, sin repetir, y cubren las clases pedidas', () => {
    expect(FEATURED_EXAMPLES.length).toBeGreaterThanOrEqual(6);
    expect(FEATURED_EXAMPLES.length).toBeLessThanOrEqual(8);
    const ids = FEATURED_EXAMPLES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const found = featuredEntries(cases);
    expect(found.map((f) => f.entry.caseData.id)).toEqual(ids);
    const kinds = new Set(found.map((f) => exampleKind(f.entry.caseData.model)));
    for (const k of ['homogeneous', 'water', 'layered', 'reinforced', 'nonlinear', 'noncircular']) expect(kinds.has(k as never)).toBe(true);
    expect(found.every((f) => f.title.length > 0 && f.tag.length > 0)).toBe(true);
  });

  it('un id que no está en el catálogo no genera botón', () => {
    expect(featuredEntries(cases.filter((c) => c.caseData.id !== 'HAM1')).map((f) => f.entry.caseData.id)).not.toContain('HAM1');
  });
});

describe('filtro', () => {
  it('sin texto, todos; con texto, por id o título, sin distinguir mayúsculas ni acentos', () => {
    expect(filterExamples(cases, '')).toHaveLength(cases.length);
    expect(filterExamples(cases, '   ')).toHaveLength(cases.length);
    expect(filterExamples(cases, 'v001').map((c) => c.caseData.id)).toEqual(expect.arrayContaining(['V001', 'V001-nc']));
    expect(filterExamples(cases, 'TRACCION').map((c) => c.caseData.id)).toContain('V048');
    expect(filterExamples(cases, 'freático').map((c) => c.caseData.id)).toContain('V003');
    expect(filterExamples(cases, 'freatico').map((c) => c.caseData.id)).toContain('V003');
  });

  it('varias palabras: todas deben aparecer', () => {
    const r = filterExamples(cases, 'talud nivel freático');
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThan(cases.length);
    expect(filterExamples(cases, 'V001 xyzzy')).toHaveLength(0);
  });

  it('normalizeText y el texto del conteo', () => {
    expect(normalizeText('Tracción ÁÉ')).toBe('traccion ae');
    // El total sale del catálogo real, que a su vez es el de verification/cases/INDEX.md: no hay un literal que fijar.
    const n = cases.length;
    expect(resultCountText(n, n)).toBe(`${n} ejemplos`);
    expect(resultCountText(3, n)).toBe(`3 de ${n} ejemplos`);
    expect(resultCountText(0, n)).toBe('Ningún ejemplo coincide con el filtro.');
  });

  it('Intro: abre el único resultado, pasa a la lista si hay varios y no hace nada sin resultados', () => {
    expect(enterAction([byId('V001')])).toEqual({ kind: 'open', key: byId('V001').key });
    expect(enterAction([byId('V001'), byId('V002')])).toEqual({ kind: 'list' });
    expect(enterAction([])).toEqual({ kind: 'none' });
  });
});

/** Evento de teclado con `preventDefault` y `stopPropagation` registrados. */
const kev = (key: string) => {
  const e = { key, ctrlKey: false, metaKey: false, defaultPrevented: false, stopped: false, preventDefault() { e.defaultPrevented = true; }, stopPropagation() { e.stopped = true; } };
  return e;
};

describe('componente', () => {
  const find = (m: ReturnType<typeof mount>, pred: (n: HostNode) => boolean): HostNode[] => m.nodes.filter(pred);
  const select = (m: ReturnType<typeof mount>) => m.byLabel(EXAMPLE_SELECT_LABEL);
  const filter = (m: ReturnType<typeof mount>) => m.nodes.find((n) => n.type === 'input')!;
  const options = (n: HostNode): HostNode[] => {
    const out: HostNode[] = [];
    const walk = (x: HostNode | string): void => {
      if (typeof x === 'string') return;
      if (x.type === 'option') out.push(x);
      x.children.forEach(walk);
    };
    walk(n);
    return out;
  };

  it('conserva el nombre accesible del control, con todos los casos una sola vez (más la opción vacía) y agrupados', () => {
    const m = mount(() => createElement(ExamplePicker as never, { cases, onOpen: () => undefined }));
    const sel = select(m);
    expect(sel.type).toBe('select');
    expect(options(sel)).toHaveLength(cases.length + 1);
    const groups = find(m, (n) => n.type === 'optgroup');
    expect(groups.length).toBeGreaterThan(3);
    expect(groups[0]!.props.label).toMatch(/^Con refuerzos o pilotes \(\d+\)$/);
    expect(m.text()).toContain('Ejemplos destacados');
    expect(find(m, (n) => n.type === 'button')).toHaveLength(FEATURED_EXAMPLES.length);
    expect(m.text()).toContain(`${cases.length} ejemplos`);
  });

  it('el campo de filtro tiene etiqueta, está enlazado a la lista y al conteo (región viva)', () => {
    const m = mount(() => createElement(ExamplePicker as never, { cases, onOpen: () => undefined }));
    const input = filter(m);
    const label = m.nodes.find((n) => n.type === 'label')!;
    expect(label.props.htmlFor).toBe(input.props.id);
    expect(input.props.role).toBe('searchbox');
    expect(input.props['aria-controls']).toBe(select(m).props.id);
    const count = m.nodes.find((n) => n.props['data-testid'] === 'example-count')!;
    expect(count.props.role).toBe('status');
    expect(count.props['aria-live']).toBe('polite');
    expect(input.props['aria-describedby']).toContain(count.props.id);
  });

  it('al escribir, filtra la lista, actualiza el conteo y oculta los destacados', () => {
    const m = mount(() => createElement(ExamplePicker as never, { cases, onOpen: () => undefined }));
    m.act(() => filter(m).props.onChange(changeEvent('freático')));
    const expected = filterExamples(cases, 'freático');
    expect(options(select(m))).toHaveLength(expected.length + 1);
    expect(m.text()).toContain(`${expected.length} de ${cases.length} ejemplos`);
    expect(m.text()).not.toContain('Ejemplos destacados');
    m.act(() => filter(m).props.onChange(changeEvent('zzzz')));
    expect(m.text()).toContain('Ningún ejemplo coincide con el filtro.');
    expect(select(m).props.disabled).toBe(true);
  });

  it('un botón destacado y la lista llaman a onOpen con la clave del caso y borran el filtro', () => {
    const opened: string[] = [];
    const m = mount(() => createElement(ExamplePicker as never, { cases, onOpen: (k: string) => void opened.push(k) }));
    m.act(() => m.byLabel(`Con agua: V003, ${featuredEntries(cases).find((f) => f.entry.caseData.id === 'V003')!.title}`).props.onClick());
    expect(opened).toEqual([byId('V003').key]);
    m.act(() => filter(m).props.onChange(changeEvent('V002')));
    m.act(() => select(m).props.onChange(changeEvent(byId('V002').key)));
    expect(opened).toEqual([byId('V003').key, byId('V002').key]);
    expect(filter(m).props.value).toBe('');
    m.act(() => select(m).props.onChange(changeEvent(''))); // la opción vacía no abre nada
    expect(opened).toHaveLength(2);
  });

  it('teclado en el filtro: Intro abre el único resultado; las flechas no llegan al menú; Esc borra el texto', () => {
    const opened: string[] = [];
    const m = mount(() => createElement(ExamplePicker as never, { cases, onOpen: (k: string) => void opened.push(k) }));
    const only = cases.find((c) => filterExamples(cases, c.caseData.id).length === 1)!;
    m.act(() => filter(m).props.onChange(changeEvent(only.caseData.id)));
    const enter = kev('Enter');
    m.act(() => filter(m).props.onKeyDown(enter));
    expect(opened).toEqual([only.key]);
    expect(enter.defaultPrevented).toBe(true);
    expect(enter.stopped).toBe(true);

    m.act(() => filter(m).props.onChange(changeEvent('talud')));
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      const e = kev(key);
      m.act(() => filter(m).props.onKeyDown(e));
      expect(e.stopped, key).toBe(true);
    }
    const esc = kev('Escape');
    m.act(() => filter(m).props.onKeyDown(esc));
    expect(filter(m).props.value).toBe('');
    expect(esc.stopped).toBe(true);
    // Con el campo vacío, Esc no se detiene: cierra el menú como siempre.
    const esc2 = kev('Escape');
    m.act(() => filter(m).props.onKeyDown(esc2));
    expect(esc2.stopped).toBe(false);
  });
});
