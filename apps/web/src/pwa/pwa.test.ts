import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { pwaPrecache } from '../../build/pwa-plugin';
import { registerOptions } from './register';
import { showUpdatePrompt, UPDATE_PROMPT_ID } from './updatePrompt';
import { SKIP_WAITING_MESSAGE, watchForUpdates, type ContainerLike, type RegistrationLike, type WorkerLike } from './updateFlow';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

// Objetos simulados de ServiceWorker, registro y contenedor.
class FakeWorker implements WorkerLike {
  state = 'installing';
  sent: unknown[] = [];
  private listeners: (() => void)[] = [];
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
  addEventListener(_t: 'statechange', l: () => void): void {
    this.listeners.push(l);
  }
  setState(s: string): void {
    this.state = s;
    this.listeners.forEach((l) => l());
  }
}
class FakeRegistration implements RegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  private onFound: (() => void)[] = [];
  addEventListener(_t: 'updatefound', l: () => void): void {
    this.onFound.push(l);
  }
  found(w: FakeWorker): void {
    this.installing = w;
    this.onFound.forEach((l) => l());
  }
}
class FakeContainer implements ContainerLike {
  controller: unknown = {};
  private onChange: (() => void)[] = [];
  addEventListener(_t: 'controllerchange', l: () => void): void {
    this.onChange.push(l);
  }
  change(): void {
    this.onChange.forEach((l) => l());
  }
}

function setup(opts: { controller?: boolean; waiting?: boolean } = {}) {
  const reg = new FakeRegistration();
  const container = new FakeContainer();
  if (opts.controller === false) container.controller = null;
  const waiting = new FakeWorker();
  if (opts.waiting) {
    waiting.state = 'installed';
    reg.waiting = waiting;
  }
  const offers: (() => void)[] = [];
  const reload = vi.fn();
  watchForUpdates(reg, container, { onUpdateReady: (apply) => offers.push(apply), reload });
  return { reg, container, waiting, offers, reload };
}

describe('flujo de actualización (R5-08)', () => {
  it('worker ya en espera al cargar: ofrece la actualización; «Actualizar» envía SKIP_WAITING', () => {
    const { waiting, offers } = setup({ waiting: true });
    expect(offers).toHaveLength(1);
    expect(waiting.sent).toEqual([]);
    offers[0]?.();
    expect(waiting.sent).toEqual([SKIP_WAITING_MESSAGE]);
    expect(SKIP_WAITING_MESSAGE).toEqual({ type: 'SKIP_WAITING' });
  });

  it('versión nueva que llega con la página abierta: updatefound → installed → ofrece', () => {
    const { reg, offers } = setup();
    const next = new FakeWorker();
    reg.found(next);
    next.setState('installing');
    expect(offers).toHaveLength(0);
    next.setState('installed');
    expect(offers).toHaveLength(1);
    offers[0]?.();
    expect(next.sent).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it('primera instalación (sin controlador): no hay nada que actualizar ni se recarga', () => {
    const { reg, container, offers, reload } = setup({ controller: false });
    const first = new FakeWorker();
    reg.found(first);
    first.setState('installed');
    container.controller = {}; // clients.claim()
    container.change();
    expect(offers).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('controllerchange con controlador previo recarga una sola vez', () => {
    const { container, reload } = setup();
    container.change();
    container.change();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // R6-01: pestaña abierta en la primera visita; `clients.claim()` le da controlador y luego llega una versión nueva.
  it('R6-01: primera visita → claim v1 → llega v2 → «Actualizar» → controllerchange recarga una sola vez', () => {
    const { reg, container, offers, reload } = setup({ controller: false });
    const v1 = new FakeWorker();
    reg.found(v1);
    v1.setState('installed');
    container.controller = {}; // clients.claim() de v1
    container.change();
    expect(offers).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();

    const v2 = new FakeWorker();
    reg.found(v2);
    v2.setState('installed');
    expect(offers).toHaveLength(1);
    offers[0]?.();
    expect(v2.sent).toEqual([SKIP_WAITING_MESSAGE]);
    container.change(); // v2 toma el control tras SKIP_WAITING
    expect(reload).toHaveBeenCalledTimes(1);
    container.change();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('R6-01: tras la primera instalación, un controllerchange sin controlador nuevo no recarga más de una vez', () => {
    const { container, reload } = setup({ controller: false });
    container.controller = {};
    container.change(); // claim de la primera instalación
    container.change();
    container.change();
    expect(reload.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('sin cambios de versión no se ofrece nada', () => {
    const { offers, reload } = setup();
    expect(offers).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('aviso de actualización (R6-01)', () => {
  // DOM mínimo para el entorno `node`.
  class FakeEl {
    id = '';
    style: Record<string, string> = {};
    disabled = false;
    children: FakeEl[] = [];
    private click: (() => void)[] = [];
    setAttribute(): void {}
    append(...c: FakeEl[]): void {
      this.children.push(...c);
    }
    addEventListener(_t: string, l: () => void): void {
      this.click.push(l);
    }
    fire(): void {
      this.click.forEach((l) => l());
    }
  }
  function fakeDoc() {
    const body = new FakeEl();
    return {
      body,
      getElementById: (id: string) => body.children.find((c) => c.id === id) ?? null,
      createElement: () => new FakeEl(),
    } as unknown as Document & { body: FakeEl };
  }

  it('si llega otra versión con el aviso abierto y el botón ya pulsado, el botón se reactiva y aplica la nueva', () => {
    const doc = fakeDoc();
    const first = vi.fn();
    const second = vi.fn();
    const box = showUpdatePrompt(first, doc) as unknown as FakeEl;
    expect(box.id).toBe(UPDATE_PROMPT_ID);
    const button = box.children[1] as FakeEl;
    button.fire();
    expect(first).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    showUpdatePrompt(second, doc);
    expect(button.disabled).toBe(false);
    button.fire();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});

describe('registro del service worker', () => {
  it("usa updateViaCache: 'none' y el alcance de la base", () => {
    expect(registerOptions('/opengeoslide/')).toEqual({ scope: '/opengeoslide/', updateViaCache: 'none' });
    expect(registerOptions('/').updateViaCache).toBe('none');
  });
});

describe('sw-template.js', () => {
  const sw = read('../../build/sw-template.js');
  it('skipWaiting solo responde al mensaje SKIP_WAITING (no hay activación automática)', () => {
    expect(sw.match(/skipWaiting\(\)/g)).toHaveLength(1);
    expect(sw).toMatch(/addEventListener\('message'[\s\S]*?type === 'SKIP_WAITING'[\s\S]*?self\.skipWaiting\(\)/);
  });
  it('el caché de fuentes lleva la versión del build', () => {
    expect(sw).toContain('const RUNTIME = `ogs-runtime-${VERSION}`;');
    expect(sw).not.toContain("'ogs-runtime-v1'");
  });
});

describe('index.html', () => {
  const html = read('../../index.html');
  it('manifest e iconos usan %BASE_URL% (nada de rutas absolutas a la raíz)', () => {
    expect(html).not.toMatch(/(?:href)="\/(?!\/)/);
    for (const f of ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png']) {
      expect(html).toContain(`href="%BASE_URL%${f}"`);
    }
  });
});

describe('pwa-plugin: versión del build', () => {
  function build(files: Record<string, string>): { version: string; precache: string[]; sw: string } {
    const root = mkdtempSync(join(tmpdir(), 'ogs-pwa-'));
    try {
      const out = join(root, 'dist');
      for (const [name, body] of Object.entries(files)) {
        mkdirSync(dirname(join(out, name)), { recursive: true });
        writeFileSync(join(out, name), body);
      }
      const plugin = pwaPrecache();
      (plugin.configResolved as (c: unknown) => void)({ root, build: { outDir: 'dist' } });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      (plugin.closeBundle as () => void)();
      log.mockRestore();
      const sw = readFileSync(join(out, 'sw.js'), 'utf8');
      const version = /const VERSION = "([0-9a-f]+)"/.exec(sw)?.[1] ?? '';
      const list = /const ASSETS = (\[[\s\S]*?\]);/.exec(sw)?.[1] ?? '[]';
      return { version, precache: JSON.parse(list) as string[], sw };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  const base = { 'index.html': '<html>', 'assets/a.js': 'a', 'assets/m.wasm': 'wasm', 'fonts/f.ttf': 'font1' };

  it('las fuentes no se precachean pero cambian la versión (y con ella el caché de fuentes)', () => {
    const a = build(base);
    const b = build({ ...base, 'fonts/f.ttf': 'font2' });
    expect(a.precache).toEqual(['assets/a.js', 'assets/m.wasm', 'index.html']);
    expect(b.precache).toEqual(a.precache);
    expect(a.version).toMatch(/^[0-9a-f]{12}$/);
    expect(b.version).not.toBe(a.version);
  });
  it('un cambio en el WASM o en el JS cambia la versión; sin cambios es estable', () => {
    const a = build(base);
    expect(build(base).version).toBe(a.version);
    expect(build({ ...base, 'assets/m.wasm': 'wasm2' }).version).not.toBe(a.version);
    expect(build({ ...base, 'assets/a.js': 'a2' }).version).not.toBe(a.version);
    expect(a.sw).not.toContain('__VERSION__');
  });
});
