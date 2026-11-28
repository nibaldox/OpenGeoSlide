// CM-C1W · F7.5: el formulario de la búsqueda global (`forms.ts`): valores por defecto sin escribir, ida y vuelta, rangos y mensajes.
import { describe, expect, it } from 'vitest';
import type { SearchSpec } from '../../engine/types';
import { GLOBAL_FORM_EMPTY, defaultSearch, methodDisabledReason, searchFromForm, searchToForm, searchesEqual, withoutGlobal, type SearchForm } from './forms';

const ctx = { xRange: null } as const;
const spec = (nc: unknown): SearchSpec => ({ ...defaultSearch(), non_circular: nc as never });
const out = (form: SearchForm) => searchFromForm(form, ctx);
const base = (): SearchForm => ({ ...searchToForm(spec({})), ...GLOBAL_FORM_EMPTY });

describe('searchToForm / searchFromForm con global', () => {
  it('global: {} da el formulario vacío y vuelve a {} (los valores por defecto no se escriben)', () => {
    const form = searchToForm(spec({ global: {} }));
    expect(form).toMatchObject({ non_circular: true, global: true, global_algorithm: '', global_generated: '', global_seed: '' });
    expect('global_polish' in form).toBe(false);
    const r = out(form);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.non_circular).toEqual({ global: {} });
  });

  it('sin global el formulario no trae campos globales y la salida es la de v0.6', () => {
    const form = searchToForm(spec({ seeds: 4, max_vertices: 17 }));
    expect(form.global).toBeUndefined();
    const r = out(form);
    expect(r.ok && r.value.non_circular).toEqual({ seeds: 4, max_vertices: 17 });
    expect(JSON.stringify(searchToForm(spec({})))).not.toContain('global');
    const nullGlobal = out(searchToForm(spec({ global: null })));
    expect(nullGlobal.ok && nullGlobal.value.non_circular).toEqual({});
  });

  it('los cuatro campos viajan en el formulario y de vuelta, en el orden del contrato', () => {
    const g = { algorithm: 'annealing', generated: 1200, seed: 9007199254740991, polish: false };
    const form = searchToForm(spec({ seeds: 2, global: g }));
    expect(form).toMatchObject({ global: true, global_algorithm: 'annealing', global_generated: '1200', global_polish: false });
    const r = out(form);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.non_circular).toEqual({ seeds: 2, global: g });
      expect(Object.keys(r.value.non_circular!.global!)).toEqual(['algorithm', 'generated', 'seed', 'polish']);
      expect(searchesEqual(r.value, spec({ seeds: 2, global: g }))).toBe(true);
    }
  });

  it('los valores explícitos iguales al valor por defecto se conservan (no se normalizan en silencio)', () => {
    const g = { algorithm: 'auto', generated: 500, seed: 0, polish: true };
    const r = out(searchToForm(spec({ global: g })));
    expect(r.ok && r.value.non_circular).toEqual({ global: g });
  });

  it('null dentro de global cuenta como ausente', () => {
    const r = out(searchToForm(spec({ global: { algorithm: null, generated: null, seed: null, polish: null } })));
    expect(r.ok && r.value.non_circular).toEqual({ global: {} });
  });

  it('casilla de non_circular desmarcada: no se escribe global aunque el formulario lo traiga', () => {
    const r = out({ ...base(), non_circular: false });
    expect(r.ok && 'non_circular' in r.value).toBe(false);
  });

  it('withoutGlobal quita los cinco campos', () => {
    const form = withoutGlobal({ ...base(), global_algorithm: 'block', global_polish: false });
    expect(Object.keys(form).filter((k) => k.startsWith('global'))).toEqual([]);
    expect(out(form).ok).toBe(true);
  });
});

describe('rangos de la búsqueda global (F7.1)', () => {
  const generated = (v: string) => out({ ...base(), global_generated: v });
  const seed = (v: string) => out({ ...base(), global_seed: v });

  it.each([['50'], ['500'], ['2000'], ['  120  ']])('candidatos %s es válido', (v) => {
    expect(generated(v).ok).toBe(true);
  });
  it.each([['49'], ['2001'], ['0'], ['-50']])('candidatos %s está fuera de rango', (v) => {
    const r = generated(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.global_generated).toBe('Candidatos: use un entero entre 50 y 2000');
  });
  it('candidatos no entero o no numérico, con el nombre del campo', () => {
    const a = generated('60,5');
    expect(!a.ok && a.errors.global_generated).toContain('Candidatos');
    expect(!a.ok && a.errors.global_generated).toContain('entero');
    const b = generated('abc');
    expect(!b.ok && b.errors.global_generated).toContain('Candidatos');
  });

  it.each([['0'], ['1'], ['9007199254740991']])('semilla %s es válida', (v) => {
    expect(seed(v).ok).toBe(true);
  });
  it.each([['-1'], ['9007199254740992'], ['1e300']])('semilla %s está fuera de rango', (v) => {
    const r = seed(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.global_seed).toBe('Semilla: use un entero entre 0 y 9007199254740991 (2^53 − 1)');
  });

  it('campos vacíos son válidos (valor por defecto) y no escriben nada', () => {
    const r = out(base());
    expect(r.ok && r.value.non_circular).toEqual({ global: {} });
  });
});

describe('searchesEqual con global', () => {
  it('distingue por campos de global y trata null y ausente como lo mismo', () => {
    expect(searchesEqual(spec({ global: {} }), spec({ global: {} }))).toBe(true);
    expect(searchesEqual(spec({ global: {} }), spec({}))).toBe(false);
    expect(searchesEqual(spec({ global: { seed: 1 } }), spec({ global: { seed: 2 } }))).toBe(false);
    expect(searchesEqual(spec({ global: { seed: null } }), spec({ global: {} }))).toBe(true);
    expect(searchesEqual(spec({ seeds: null }), spec({}))).toBe(true);
    expect(searchesEqual(spec({ global: { polish: false } }), spec({ global: {} }))).toBe(false);
    expect(searchesEqual(spec({ global: { algorithm: 'auto' } }), spec({ global: {} }))).toBe(false);
  });
});

describe('Bishop con global', () => {
  it('sigue deshabilitado con non_circular, también con global', () => {
    expect(methodDisabledReason('bishop', { search: spec({ global: {} }) })).toContain('no se admite');
    expect(methodDisabledReason('spencer', { search: spec({ global: {} }) })).toBeNull();
  });
});
