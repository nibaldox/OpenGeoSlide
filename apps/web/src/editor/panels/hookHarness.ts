// Apoyo de pruebas (CM-WA): un renderizador mínimo, sin DOM, que ejecuta los paneles reales con estado de verdad (`useState`,
// efectos, `useSyncExternalStore`, contexto) para poder escribir en un campo, pulsar un botón y mirar el resultado.
// No importa `react` (solo tipos): una prueba lo pone en lugar de los hooks con
//   vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), ...(await import('./hookHarness')).hookOverrides }));
// y después monta el componente con `mount(...)`.

import type { ReactElement } from 'react';

type Cleanup = (() => void) | void;
interface EffectSlot {
  kind: 'effect';
  deps: readonly unknown[] | undefined;
  cleanup: Cleanup;
}
type Slot = { kind: 'state'; value: unknown } | { kind: 'memo'; deps: readonly unknown[] | undefined; value: unknown } | { kind: 'ref'; ref: { current: unknown } } | { kind: 'sync'; unsubscribe: () => void } | { kind: 'id'; id: string } | EffectSlot;

interface Fiber {
  slots: Slot[];
}

interface Runtime {
  fibers: Map<string, Fiber>;
  cursor: number;
  fiber: Fiber | null;
  contexts: Map<unknown, unknown[]>;
  dirty: boolean;
  pendingEffects: Array<() => void>;
  idCounter: number;
  /** Repinta (lo asigna `mount`); lo llaman los cambios externos del store fuera de `act`. */
  flush: () => void;
  busy: boolean;
}

let rt: Runtime | null = null;

function cur(): { rt: Runtime; fiber: Fiber } {
  if (!rt || !rt.fiber) throw new Error('hookHarness: un hook se llamó fuera de `mount`');
  return { rt, fiber: rt.fiber };
}

function slot<T extends Slot>(init: () => T): T {
  const { rt: r, fiber } = cur();
  const i = r.cursor++;
  if (!fiber.slots[i]) fiber.slots[i] = init();
  return fiber.slots[i] as T;
}

const sameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
  const s = slot<{ kind: 'state'; value: unknown }>(() => ({ kind: 'state', value: typeof initial === 'function' ? (initial as () => S)() : initial }));
  const r = cur().rt;
  return [
    s.value as S,
    (next) => {
      const value = typeof next === 'function' ? (next as (p: S) => S)(s.value as S) : next;
      if (Object.is(value, s.value)) return;
      s.value = value;
      r.dirty = true;
    },
  ];
}

function useEffect(effect: () => Cleanup, deps?: readonly unknown[]): void {
  const s = slot<EffectSlot>(() => ({ kind: 'effect', deps: undefined, cleanup: undefined }));
  const r = cur().rt;
  if (s.deps !== undefined && sameDeps(s.deps, deps)) return;
  r.pendingEffects.push(() => {
    if (typeof s.cleanup === 'function') s.cleanup();
    s.cleanup = effect();
  });
  s.deps = deps ?? [Symbol('siempre')];
}

function useMemo<T>(make: () => T, deps: readonly unknown[]): T {
  const s = slot<{ kind: 'memo'; deps: readonly unknown[] | undefined; value: unknown }>(() => ({ kind: 'memo', deps: undefined, value: undefined }));
  if (!sameDeps(s.deps, deps)) {
    s.value = make();
    s.deps = deps;
  }
  return s.value as T;
}

function useCallback<T>(fn: T, deps: readonly unknown[]): T {
  return useMemo(() => fn, deps);
}

function useRef<T>(initial: T): { current: T } {
  return slot<{ kind: 'ref'; ref: { current: unknown } }>(() => ({ kind: 'ref', ref: { current: initial } })).ref as { current: T };
}

function useId(): string {
  const r = cur().rt;
  return slot<{ kind: 'id'; id: string }>(() => ({ kind: 'id', id: `:h${r.idCounter++}:` })).id;
}

function useContext<T>(context: { _currentValue?: T }): T {
  const stack = cur().rt.contexts.get(context);
  return (stack && stack.length > 0 ? stack[stack.length - 1] : context._currentValue) as T;
}

function useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T {
  const r = cur().rt;
  slot<{ kind: 'sync'; unsubscribe: () => void }>(() => ({ kind: 'sync', unsubscribe: subscribe(() => {
      r.dirty = true;
      if (!r.busy) r.flush();
    }) }));
  return getSnapshot();
}

/** Los hooks de verdad se sustituyen por estos en la prueba. */
export const hookOverrides = { useState, useEffect, useLayoutEffect: useEffect, useMemo, useCallback, useRef, useId, useContext, useSyncExternalStore };

// ── Árbol ──

export interface HostNode {
  type: string;
  props: Record<string, any>;
  children: Array<HostNode | string>;
}

const FRAGMENT = Symbol.for('react.fragment');

function expand(node: unknown, path: string, r: Runtime): Array<HostNode | string> {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap((n, i) => expand(n, `${path}.${i}`, r));
  const el = node as ReactElement<any> & { key?: string | null };
  const type = el.type as any;
  const key = el.key !== null && el.key !== undefined ? `k${el.key}` : '';
  const here = `${path}${key ? `/${key}` : ''}`;
  const props = (el.props ?? {}) as Record<string, any>;
  if (typeof type === 'string') {
    return [{ type, props, children: expand(props.children, `${here}>`, r) }];
  }
  if (type === FRAGMENT) return expand(props.children, here, r);
  if (type && typeof type === 'object' && type.$$typeof === Symbol.for('react.context')) {
    const stack = r.contexts.get(type) ?? [];
    r.contexts.set(type, [...stack, props.value]);
    try {
      return expand(props.children, here, r);
    } finally {
      r.contexts.set(type, stack);
    }
  }
  if (typeof type === 'function') {
    const id = `${here}#${type.name || 'anon'}`;
    let fiber = r.fibers.get(id);
    if (!fiber) {
      fiber = { slots: [] };
      r.fibers.set(id, fiber);
    }
    const prev = { cursor: r.cursor, fiber: r.fiber };
    r.cursor = 0;
    r.fiber = fiber;
    let out: unknown;
    try {
      out = type(props);
    } finally {
      r.cursor = prev.cursor;
      r.fiber = prev.fiber;
    }
    return expand(out, id, r);
  }
  return [];
}

export interface Mounted {
  /** Nodos de host de la última pasada. */
  readonly nodes: HostNode[];
  find(pred: (n: HostNode) => boolean): HostNode | undefined;
  /** Elemento por su `aria-label` exacto. */
  byLabel(label: string): HostNode;
  byPath(path: string): HostNode;
  /** Botón (o cualquier host) cuyo texto es `text`. */
  byText(tag: string, text: string): HostNode;
  /** Ejecuta `fn` y repinta hasta que no queden cambios. */
  act(fn: () => void): void;
  text(): string;
  unmount(): void;
}

const flat = (nodes: Array<HostNode | string>): HostNode[] => nodes.flatMap((n) => (typeof n === 'string' ? [] : [n, ...flat(n.children)]));
const textOf = (n: HostNode | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));

/** Monta un elemento con contextos iniciales opcionales (`[contexto, valor]`). Cambie `setRoot` para repintar con otras props. */
export function mount(make: () => ReactElement, opts: { contexts?: Array<[unknown, unknown]> } = {}): Mounted & { setRoot(make: () => ReactElement): void } {
  const r: Runtime = { fibers: new Map(), cursor: 0, fiber: null, contexts: new Map(), dirty: false, pendingEffects: [], idCounter: 0, flush: () => undefined, busy: false };
  for (const [ctx, value] of opts.contexts ?? []) r.contexts.set(ctx, [value]);
  let build = make;
  let tree: Array<HostNode | string> = [];
  const render = (): void => {
    rt = r;
    r.busy = true;
    try {
      for (let pass = 0; pass < 30; pass++) {
        r.dirty = false;
        r.idCounter = 0;
        tree = expand(build(), 'r', r);
        const effects = r.pendingEffects;
        r.pendingEffects = [];
        for (const run of effects) run();
        if (!r.dirty) return;
      }
      throw new Error('hookHarness: el árbol no se estabiliza (¿bucle de render?)');
    } finally {
      rt = null;
      r.busy = false;
    }
  };
  r.flush = render;
  render();
  const m = {
    get nodes() {
      return flat(tree);
    },
    find: (pred: (n: HostNode) => boolean) => flat(tree).find(pred),
    byLabel(label: string) {
      const n = flat(tree).find((x) => x.props['aria-label'] === label);
      if (!n) throw new Error(`sin elemento con aria-label «${label}»`);
      return n;
    },
    byPath(path: string) {
      const n = flat(tree).find((x) => x.props['data-path'] === path);
      if (!n) throw new Error(`sin elemento con data-path «${path}»`);
      return n;
    },
    byText(tag: string, text: string) {
      const n = flat(tree).find((x) => x.type === tag && textOf(x).trim() === text);
      if (!n) throw new Error(`sin <${tag}> con el texto «${text}»`);
      return n;
    },
    act(fn: () => void) {
      rt = r;
      r.busy = true;
      try {
        fn();
      } finally {
        rt = null;
        r.busy = false;
      }
      render();
    },
    text: () => tree.map(textOf).join(' '),
    setRoot(next: () => ReactElement) {
      build = next;
      render();
    },
    unmount() {
      for (const f of r.fibers.values()) {
        for (const s of f.slots) {
          if (s.kind === 'effect' && typeof s.cleanup === 'function') s.cleanup();
          if (s.kind === 'sync') s.unsubscribe();
        }
      }
    },
  };
  return m;
}

/** Eventos mínimos para las props de los campos. */
export const changeEvent = (value: string) => ({ target: { value } });
export const keyEvent = (key: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) => {
  const e = { key, ctrlKey: false, metaKey: false, ...mods, defaultPrevented: false, preventDefault() { e.defaultPrevented = true; } };
  return e;
};
