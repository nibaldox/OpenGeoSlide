import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_KEY,
  TOUR_STEPS,
  autoOpenTour,
  hasSeenTour,
  initialTour,
  markTourSeen,
  matchesTarget,
  placePopover,
  ringRect,
  stepProgress,
  tourReducer,
  type StorageLike,
} from './tour';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const brokenStorage: StorageLike = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('TOUR_STEPS', () => {
  it('son 5 pasos, con identificador único, título, texto y destino', () => {
    expect(TOUR_STEPS).toHaveLength(5);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(5);
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.body.length).toBeGreaterThan(20);
      expect(s.target.selector.length).toBeGreaterThan(0);
    }
  });
  it('siguen el flujo del brief: ejemplo, materiales y agua, Comprobar, FS y avisos, informe', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['open', 'materials', 'check', 'results', 'report']);
  });
  it('la guía conoce la herramienta «Dibujar región» (tecla R) y las pestañas Geometría y Proyecto', () => {
    const open = TOUR_STEPS.find((s) => s.id === 'open')!;
    const tabs = TOUR_STEPS.find((s) => s.id === 'materials')!;
    expect(open.body).toContain('Dibujar región');
    expect(open.body).toContain('tecla R');
    expect(tabs.title.toLowerCase()).toContain('geometría');
    expect(tabs.body.toLowerCase()).toContain('geometría');
    expect(tabs.body.toLowerCase()).toContain('proyecto');
  });
  it('el texto no usa voseo', () => {
    const text = TOUR_STEPS.map((s) => `${s.title} ${s.body}`).join(' ');
    expect(text).not.toMatch(/\b(pod[eé]s|ten[eé]s|hac[eé]s|abr[ií]|pulsá|elegí)\b/i);
  });
});

describe('tourReducer', () => {
  it('empieza cerrada', () => {
    expect(initialTour()).toEqual({ open: false, index: 0 });
  });
  it('abrir va al primer paso', () => {
    expect(tourReducer({ open: false, index: 3 }, { type: 'open' })).toEqual({ open: true, index: 0 });
  });
  it('siguiente avanza y anterior retrocede', () => {
    let s = tourReducer(initialTour(), { type: 'open' });
    s = tourReducer(s, { type: 'next' });
    s = tourReducer(s, { type: 'next' });
    expect(s).toEqual({ open: true, index: 2 });
    s = tourReducer(s, { type: 'prev' });
    expect(s.index).toBe(1);
  });
  it('anterior en el primer paso no baja de cero', () => {
    expect(tourReducer({ open: true, index: 0 }, { type: 'prev' })).toEqual({ open: true, index: 0 });
  });
  it('siguiente en el último paso termina el recorrido', () => {
    expect(tourReducer({ open: true, index: TOUR_STEPS.length - 1 }, { type: 'next' })).toEqual({ open: false, index: 0 });
  });
  it('omitir cierra desde cualquier paso', () => {
    expect(tourReducer({ open: true, index: 2 }, { type: 'skip' })).toEqual({ open: false, index: 0 });
  });
  it('con el recorrido cerrado, siguiente y anterior no abren nada', () => {
    expect(tourReducer(initialTour(), { type: 'next' })).toEqual(initialTour());
    expect(tourReducer(initialTour(), { type: 'prev' })).toEqual(initialTour());
  });
  it('reabrir tras terminar vuelve a empezar desde el paso 1', () => {
    let s = tourReducer({ open: true, index: TOUR_STEPS.length - 1 }, { type: 'next' });
    s = tourReducer(s, { type: 'open' });
    expect(s).toEqual({ open: true, index: 0 });
  });
});

describe('stepProgress', () => {
  it('rotula «Paso n de N» y marca los extremos', () => {
    expect(stepProgress(0)).toEqual({ label: 'Paso 1 de 5', first: true, last: false });
    expect(stepProgress(4)).toEqual({ label: 'Paso 5 de 5', first: false, last: true });
  });
});

describe('persistencia (ogs.onboarding.v1)', () => {
  it('la clave es la del brief', () => {
    expect(ONBOARDING_KEY).toBe('ogs.onboarding.v1');
  });
  it('la primera visita no la ha visto', () => {
    expect(hasSeenTour(memoryStorage())).toBe(false);
  });
  it('marcar como vista persiste y la segunda visita la ve como vista', () => {
    const s = memoryStorage();
    markTourSeen(s);
    expect(s.data.has(ONBOARDING_KEY)).toBe(true);
    expect(hasSeenTour(s)).toBe(true);
  });
  it('cualquier valor presente cuenta como visto (p. ej., lo fija un recorrido de prueba)', () => {
    expect(hasSeenTour(memoryStorage({ [ONBOARDING_KEY]: '1' }))).toBe(true);
    expect(hasSeenTour(memoryStorage({ [ONBOARDING_KEY]: 'seen' }))).toBe(true);
  });
  it('sin almacenamiento utilizable no se insiste: se da por vista y no falla', () => {
    expect(hasSeenTour(brokenStorage)).toBe(true);
    expect(() => markTourSeen(brokenStorage)).not.toThrow();
    expect(hasSeenTour(null)).toBe(true);
  });
});

describe('autoOpenTour', () => {
  it('abre en la primera visita y la deja marcada como vista', () => {
    const s = memoryStorage();
    expect(autoOpenTour(s, { editing: true })).toBe(true);
    expect(hasSeenTour(s)).toBe(true);
  });
  it('la segunda visita no la abre', () => {
    const s = memoryStorage();
    autoOpenTour(s, { editing: true });
    expect(autoOpenTour(s, { editing: true })).toBe(false);
  });
  it('fuera del modo Editar no abre ni gasta la primera visita', () => {
    const s = memoryStorage();
    expect(autoOpenTour(s, { editing: false })).toBe(false);
    expect(hasSeenTour(s)).toBe(false);
  });
});

describe('matchesTarget', () => {
  it('sin texto basta el selector', () => {
    expect(matchesTarget({ selector: 'x' }, 'lo que sea')).toBe(true);
  });
  it('con texto se compara como expresión regular sobre el texto del elemento', () => {
    const t = { selector: '.dd-trigger', text: '^Archivo' };
    expect(matchesTarget(t, 'Archivo ▾')).toBe(true);
    expect(matchesTarget(t, 'Exportar ▾')).toBe(false);
  });
});

describe('placePopover', () => {
  const vp = { width: 1440, height: 900 };
  const pop = { width: 340, height: 180 };

  it('prefiere debajo del control, centrado y dentro del viewport', () => {
    const p = placePopover({ x: 100, y: 20, width: 80, height: 32 }, pop, vp);
    expect(p.placement).toBe('below');
    expect(p.top).toBeGreaterThanOrEqual(52);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + pop.width).toBeLessThanOrEqual(vp.width - 8);
  });

  it('si no cabe debajo, va encima', () => {
    const p = placePopover({ x: 600, y: 820, width: 80, height: 32 }, pop, vp);
    expect(p.placement).toBe('above');
    expect(p.top + pop.height).toBeLessThanOrEqual(820);
  });

  it('nunca tapa el control destacado', () => {
    const target = { x: 600, y: 400, width: 200, height: 40 };
    const p = placePopover(target, pop, vp);
    const overlapX = p.left < target.x + target.width && p.left + pop.width > target.x;
    const overlapY = p.top < target.y + target.height && p.top + pop.height > target.y;
    expect(overlapX && overlapY).toBe(false);
  });

  it('un control en el borde derecho no saca el cuadro del viewport', () => {
    const p = placePopover({ x: 1380, y: 10, width: 50, height: 30 }, pop, vp);
    expect(p.left + pop.width).toBeLessThanOrEqual(vp.width - 8);
  });

  it('en móvil (390 px) el cuadro cabe a lo ancho', () => {
    const p = placePopover({ x: 10, y: 60, width: 60, height: 32 }, { width: 374, height: 200 }, { width: 390, height: 844 });
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + 374).toBeLessThanOrEqual(390 - 8);
  });

  it('un control que ocupa casi toda la pantalla deja el cuadro flotando, siempre dentro del viewport', () => {
    const p = placePopover({ x: 20, y: 80, width: 1400, height: 760 }, pop, vp);
    expect(p.placement).toBe('floating');
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + pop.height).toBeLessThanOrEqual(vp.height - 8);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + pop.width).toBeLessThanOrEqual(vp.width - 8);
  });

  it('sin control (oculto o inexistente) se coloca abajo y centrado', () => {
    const p = placePopover(null, pop, vp);
    expect(p.placement).toBe('center');
    expect(p.left).toBe((vp.width - pop.width) / 2);
    expect(p.top + pop.height).toBeLessThanOrEqual(vp.height - 8);
  });
});

describe('ringRect', () => {
  it('infla el control con un margen para que el anillo no lo tape', () => {
    expect(ringRect({ x: 10, y: 20, width: 100, height: 30 })).toEqual({ x: 6, y: 16, width: 108, height: 38 });
  });
});
