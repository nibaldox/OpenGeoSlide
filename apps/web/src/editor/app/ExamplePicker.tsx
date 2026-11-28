// Selector de ejemplos del menú «Archivo» (CM-WA, X35 §3 punto 4). Sustituye al `<select>` de 168 opciones sin filtro:
//   1. «Ejemplos destacados»: 7 casos representativos, a un clic;
//   2. un campo de filtro por id o por título (con etiqueta, conteo en una región viva y teclado);
//   3. el `<select>` con todos los casos, agrupados por tipo (`<optgroup>`). Conserva el nombre accesible
//      «Abrir un caso publicado como modelo», que usan varios guiones e2e.
// Es un `<select>` nativo (no un listbox propio) para mantener el comportamiento móvil y el nombre accesible.

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { CaseEntry } from '../../cases';
import type { Model } from '../../engine/types';
import { exampleTitles } from '../../examples/exampleTitles';
import './ExamplePicker.css';

/** Nombre accesible del control que elige el caso (lo usan los guiones e2e: no cambiarlo). */
export const EXAMPLE_SELECT_LABEL = 'Abrir un caso publicado como modelo';
/** Etiqueta del campo de filtro (RCM-B-11). */
export const FILTER_LABEL = 'Filtrar ejemplos por id o título';

// ───────────────────────── Destacados ─────────────────────────

export interface FeaturedExample {
  /** Id del caso en `verification/cases`. */
  id: string;
  /** Rasgo que lo hace representativo, en pocas palabras (primera línea del botón). */
  tag: string;
}

/**
 * Los casos destacados. Se eligieron de `verification/cases` por ser los más simples de su clase (una región o pocas, pocos
 * materiales), con checks publicados que el motor reproduce, y por cubrir lo que un usuario nuevo suele probar primero:
 *  - V001: talud homogéneo de 20 m, 1,5H:1V (Arai y Tagyo): el ejemplo de la primera tarea del protocolo de la compuerta;
 *  - V003: el mismo tipo de talud, con nivel freático (agua);
 *  - V002: tres estratos con una capa media débil;
 *  - V037: relleno reforzado con geomallas, una sola región (refuerzo);
 *  - HAM1: el único caso con Hoek-Brown (resistencia no lineal);
 *  - V001-nc: el talud de V001 con búsqueda no circular, para comparar con el círculo;
 *  - V048: ACADS 1(b), con grieta de tracción llena de agua.
 * Si un id deja de existir en el catálogo, su botón simplemente no se muestra.
 */
export const FEATURED_EXAMPLES: readonly FeaturedExample[] = [
  { id: 'V001', tag: 'Talud homogéneo' },
  { id: 'V003', tag: 'Con agua' },
  { id: 'V002', tag: 'Con capa débil' },
  { id: 'V037', tag: 'Con refuerzo' },
  { id: 'HAM1', tag: 'Con Hoek-Brown' },
  { id: 'V001-nc', tag: 'No circular' },
  { id: 'V048', tag: 'Con grieta de tracción' },
];

// ───────────────────────── Tipos y grupos ─────────────────────────

/** Tipo de un caso, por su rasgo principal. Se evalúan en este orden: el primero que cumple, gana. */
export const EXAMPLE_KINDS = [
  { id: 'reinforced', label: 'Con refuerzos o pilotes' },
  { id: 'nonlinear', label: 'Hoek-Brown o SHANSEP' },
  { id: 'noncircular', label: 'Superficie no circular' },
  { id: 'crack', label: 'Con grieta de tracción' },
  { id: 'seismic', label: 'Con sismo o sobrecargas' },
  { id: 'undrained', label: 'Arcilla no drenada' },
  { id: 'water', label: 'Con agua' },
  { id: 'layered', label: 'Varias capas' },
  { id: 'homogeneous', label: 'Talud homogéneo' },
] as const;
export type ExampleKindId = (typeof EXAMPLE_KINDS)[number]['id'];

export function exampleKind(model: Model): ExampleKindId {
  const a = model.analysis ?? {};
  const models = new Set(model.materials.map((m) => m.model));
  if ((model.reinforcements?.length ?? 0) > 0) return 'reinforced';
  if (models.has('hoek_brown') || models.has('shansep')) return 'nonlinear';
  if (a.search?.non_circular || a.surface?.type === 'polyline') return 'noncircular';
  if (a.tension_crack) return 'crack';
  if (a.seismic || (model.loads?.length ?? 0) > 0) return 'seismic';
  if (models.has('undrained')) return 'undrained';
  if (model.water || model.materials.some((m) => m.ru)) return 'water';
  if (model.regions.length > 1 || model.materials.length > 1) return 'layered';
  return 'homogeneous';
}

export interface ExampleGroup {
  kind: ExampleKindId;
  label: string;
  entries: CaseEntry[];
}

/** Agrupa por tipo, en el orden de `EXAMPLE_KINDS`, sin grupos vacíos y conservando el orden de entrada dentro de cada grupo. */
export function groupExamples(entries: readonly CaseEntry[]): ExampleGroup[] {
  const by = new Map<ExampleKindId, CaseEntry[]>();
  for (const e of entries) {
    const k = exampleKind(e.caseData.model);
    by.set(k, [...(by.get(k) ?? []), e]);
  }
  return EXAMPLE_KINDS.flatMap((k) => {
    const list = by.get(k.id);
    return list && list.length > 0 ? [{ kind: k.id, label: k.label, entries: list }] : [];
  });
}

// ───────────────────────── Filtro ─────────────────────────

/** Minúsculas y sin acentos: «grieta» encuentra «Grieta» y «tracción» encuentra «traccion». */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Casos cuyo id, título (en español y el original) o fuente contienen todas las palabras de `query`. Sin texto, todos. */
export function filterExamples(entries: readonly CaseEntry[], query: string): CaseEntry[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter((e) => {
    const hay = normalizeText(`${e.caseData.id} ${e.label} ${e.caseData.title}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Texto del conteo de resultados (región viva). */
export function resultCountText(shown: number, total: number): string {
  if (shown === 0) return 'Ningún ejemplo coincide con el filtro.';
  if (shown === total) return `${total} ejemplos`;
  return `${shown} de ${total} ejemplos`;
}

/** Los destacados presentes en el catálogo, en el orden de `FEATURED_EXAMPLES`, con su título corto en español. */
export function featuredEntries(entries: readonly CaseEntry[]): Array<{ entry: CaseEntry; tag: string; title: string }> {
  return FEATURED_EXAMPLES.flatMap((f) => {
    const entry = entries.find((e) => e.caseData.id === f.id);
    return entry ? [{ entry, tag: f.tag, title: exampleTitles[f.id]?.title ?? entry.caseData.title }] : [];
  });
}

/** Qué hace Intro en el filtro: abrir el único resultado, o pasar a la lista cuando quedan varios. */
export function enterAction(results: readonly CaseEntry[]): { kind: 'open'; key: string } | { kind: 'list' } | { kind: 'none' } {
  if (results.length === 1) return { kind: 'open', key: results[0]!.key };
  return results.length > 1 ? { kind: 'list' } : { kind: 'none' };
}

// ───────────────────────── Componente ─────────────────────────

export function ExamplePicker({ cases, onOpen }: { cases: readonly CaseEntry[]; onOpen: (key: string) => void }) {
  const base = useId();
  const featuredId = `${base}-featured`;
  const allId = `${base}-all`;
  const filterId = `${base}-filter`;
  const countId = `${base}-count`;
  const hintId = `${base}-hint`;
  const selectId = `${base}-select`;
  const selectRef = useRef<HTMLSelectElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const results = filterExamples(cases, query);
  const groups = groupExamples(results);
  const filtering = query.trim() !== '';
  const featured = featuredEntries(cases);

  const open = (key: string): void => {
    setQuery('');
    onOpen(key);
  };
  /** Intro en el filtro abre el caso sin pasar por un botón del menú (que se cierra solo): se cierra aquí y el foco vuelve a «Archivo». */
  const closeMenu = (): void => {
    const menu = filterRef.current?.closest<HTMLElement>('[popover]');
    if (!menu) return;
    const trigger = document.querySelector<HTMLElement>(`[aria-controls="${menu.id}"]`);
    try {
      menu.hidePopover();
    } catch {
      /* ya estaba cerrado */
    }
    trigger?.focus();
  };
  const toList = (): void => {
    const select = selectRef.current;
    if (!select) return;
    select.focus();
    try {
      select.showPicker();
    } catch {
      /* sin showPicker (o sin gesto del usuario): queda enfocada la lista */
    }
  };
  const onFilterKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    // El menú recorre sus botones con las flechas, Inicio y Fin: dentro del campo esas teclas son del texto.
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (results.length > 0) toList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const action = enterAction(results);
      if (action.kind === 'open') {
        open(action.key);
        closeMenu();
      }
      else if (action.kind === 'list') toList();
    } else if (e.key === 'Escape' && query !== '') {
      // Con texto, Esc lo borra; con el campo vacío, Esc cierra el menú como siempre.
      e.preventDefault();
      e.stopPropagation();
      setQuery('');
    } else if (e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.stopPropagation();
    }
  };

  return (
    <div className="ex-picker">
      {featured.length > 0 && !filtering ? (
        <div role="group" aria-labelledby={featuredId} className="ex-featured">
          <span id={featuredId} className="ex-heading">
            Ejemplos destacados
          </span>
          {featured.map(({ entry, tag, title }) => (
            // RCM-B-02 (WCAG 2.5.3): sin `aria-label`. El nombre accesible sale del contenido visible, así que lo contiene entero
            // (etiqueta, id y título); el espacio entre los dos <span> separa las palabras en el nombre calculado.
            <button key={entry.key} type="button" className="ex-feat" onClick={() => open(entry.key)}>
              <span className="ex-feat-tag">{tag}</span>{' '}
              <span className="ex-feat-title">
                {entry.caseData.id} · {title}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <div role="group" aria-labelledby={allId} className="ex-all">
        {/* RCM-B-11: «Todos los ejemplos, por tipo» es el encabezado del bloque; el filtro tiene su propia etiqueta (oculta: el
            marcador de posición ya la dice a la vista y el menú no gana altura). */}
        <span id={allId} className="ex-heading">
          Todos los ejemplos, por tipo
        </span>
        <label htmlFor={filterId} className="visually-hidden">
          {FILTER_LABEL}
        </label>
        <input
          ref={filterRef}
          id={filterId}
          type="text"
          role="searchbox"
          className="ex-filter"
          value={query}
          placeholder="Filtrar por id o título (V001, agua, talud…)"
          autoComplete="off"
          spellCheck={false}
          aria-controls={selectId}
          aria-describedby={`${countId} ${hintId}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFilterKeyDown}
        />
        <span id={hintId} className="visually-hidden">
          Intro abre el ejemplo si queda uno; con varios, pasa a la lista. La flecha abajo pasa a la lista. Esc borra el filtro.
        </span>
        <p id={countId} className="ex-count muted small" role="status" aria-live="polite" aria-atomic="true" data-testid="example-count">
          {resultCountText(results.length, cases.length)}
        </p>
        <select
          ref={selectRef}
          id={selectId}
          aria-label={EXAMPLE_SELECT_LABEL}
          className="ex-select"
          value=""
          disabled={results.length === 0}
          onChange={(e) => {
            if (e.target.value) open(e.target.value);
          }}
        >
          <option value="">Elegir un ejemplo…</option>
          {groups.map((g) => (
            <optgroup key={g.kind} label={`${g.label} (${g.entries.length})`}>
              {g.entries.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
