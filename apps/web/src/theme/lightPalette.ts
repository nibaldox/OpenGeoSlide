// Paleta CLARA por defecto del Canvas 2D cuando no hay DOM (pruebas en Node). Son los valores claros de
// `--canvas-*` en styles/tokens.css: `theme/lightPalette.test.ts` comprueba que no se desincronizan. Es, junto con
// tokens.css y report/palette.ts, uno de los pocos archivos donde se permiten colores literales.

import type { SectionPalette } from './sectionPalette';

export const LIGHT_SECTION_PALETTE: SectionPalette = {
  bg: '#ffffff',
  grid: '#e2e8f0',
  axis: '#334155',
  axisText: '#475569',
  halo: '#ffffff',
  regionEdge: '#1f2937',
  surface: '#a31515',
  surfaceUnconverged: '#9a3412',
  piezo: '#1e40af',
  sliceFill: 'rgb(71 85 105 / 0.16)',
  sliceEdge: 'rgb(30 41 59 / 0.65)',
  materialUnknown: '#cbd5e1',
  materials: ['#d8b77a', '#9cc29a', '#9fb9d9', '#dba5a5', '#c2a8d8', '#e3cf86', '#a9d4d0'],
};
