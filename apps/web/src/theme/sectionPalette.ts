// Paleta del Canvas 2D (vista de Casos). El lienzo no entiende `var()`: se resuelven los tokens `--canvas-*` con
// getComputedStyle y se vuelve a dibujar cuando cambia el tema. Fuera del navegador (pruebas en Node) se usa la paleta
// clara, leída del propio tokens.css para no duplicar valores.

import { MATERIAL_SLOTS } from '../render/scene';
import tokensCss from '../styles/tokens.css?raw';

export interface SectionPalette {
  bg: string;
  grid: string;
  axis: string;
  axisText: string;
  halo: string;
  regionEdge: string;
  surface: string;
  piezo: string;
  sliceFill: string;
  sliceEdge: string;
  /** `canvas-mat-0` a `canvas-mat-6`, por índice de material módulo 7. */
  materials: string[];
  materialUnknown: string;
}

/** Token CSS de cada campo escalar de la paleta. */
const SCALARS: Record<Exclude<keyof SectionPalette, 'materials'>, string> = {
  bg: '--canvas-bg',
  grid: '--canvas-grid',
  axis: '--canvas-axis',
  axisText: '--canvas-axis-text',
  halo: '--canvas-halo',
  regionEdge: '--canvas-region-edge',
  surface: '--canvas-surface',
  piezo: '--canvas-piezo',
  sliceFill: '--canvas-slice-fill',
  sliceEdge: '--canvas-slice-edge',
  materialUnknown: '--canvas-mat-unknown',
};

const materialToken = (i: number): string => `--canvas-mat-${i}`;

function build(read: (token: string) => string): SectionPalette {
  const scalars = Object.fromEntries(Object.entries(SCALARS).map(([key, token]) => [key, read(token)])) as Omit<SectionPalette, 'materials'>;
  return { ...scalars, materials: Array.from({ length: MATERIAL_SLOTS }, (_, i) => read(materialToken(i))) };
}

/** Valores del tema claro de `:root` en tokens.css (el primer bloque, sin light-dark()). */
export function parseLightTokens(css: string): Record<string, string> {
  const end = css.indexOf('\n@media');
  const out: Record<string, string> = {};
  for (const m of css.slice(0, end < 0 ? undefined : end).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

let lightDefault: SectionPalette | null = null;

/** Paleta clara por defecto (sin DOM). */
export function defaultSectionPalette(): SectionPalette {
  lightDefault ??= (() => {
    const light = parseLightTokens(tokensCss);
    return build((token) => light[token] ?? '');
  })();
  return lightDefault;
}

/**
 * Resuelve los tokens con el tema vigente. Una propiedad personalizada con `light-dark()` se guarda sin resolver, de
 * modo que cada token se lee a través de `color: var(--token)` en un elemento sonda, que sí devuelve el color calculado.
 */
export function resolveSectionPalette(doc: Document = document): SectionPalette {
  const host = doc.body ?? doc.documentElement;
  const probe = doc.createElement('span');
  probe.style.display = 'none';
  host.appendChild(probe);
  try {
    return build((token) => {
      probe.style.color = '';
      probe.style.color = `var(${token})`;
      return doc.defaultView?.getComputedStyle(probe).color || '';
    });
  } finally {
    probe.remove();
  }
}
