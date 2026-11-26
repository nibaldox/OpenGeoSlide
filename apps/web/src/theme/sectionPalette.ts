// Paleta del Canvas 2D (vista de Casos). El lienzo no entiende `var()`: se resuelven los tokens `--canvas-*` con
// getComputedStyle y se vuelve a dibujar cuando cambia el tema. Fuera del navegador (pruebas en Node) se usa la paleta
// clara de lightPalette.ts (sincronizada con tokens.css por una prueba).

import { MATERIAL_SLOTS } from '../render/scene';
import { LIGHT_SECTION_PALETTE } from './lightPalette';

export interface SectionPalette {
  bg: string;
  grid: string;
  axis: string;
  axisText: string;
  halo: string;
  regionEdge: string;
  surface: string;
  /** Superficie evaluada de un método que no convergió (trazo discontinuo): `--canvas-surface-unconverged`. */
  surfaceUnconverged: string;
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
  surfaceUnconverged: '--canvas-surface-unconverged',
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

/** Paleta clara por defecto (sin DOM). */
export function defaultSectionPalette(): SectionPalette {
  return LIGHT_SECTION_PALETTE;
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
