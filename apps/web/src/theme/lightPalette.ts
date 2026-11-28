// Paleta CLARA por defecto del Canvas 2D cuando no hay DOM (pruebas en Node). Son los valores claros de
// `--canvas-*` en styles/tokens.css: `theme/lightPalette.test.ts` comprueba que no se desincronizan. Es, junto con
// tokens.css y report/palette.ts, uno de los pocos archivos donde se permiten colores literales.

import type { SectionPalette } from './sectionPalette';

export const LIGHT_SECTION_PALETTE: SectionPalette = {
  bg: '#f6f7f9',
  grid: '#e6e9ed',
  axis: '#55606c',
  axisText: '#475569',
  halo: '#f6f7f9',
  regionEdge: '#1f2933',
  surface: '#b42318',
  surfaceUnconverged: '#9a3412',
  piezo: '#1e40af',
  pond: '#bfdbfe',
  reinforcement: '#0f5132',
  sliceFill: 'rgb(31 41 51 / 0.06)',
  sliceEdge: 'rgb(31 41 51 / 0.62)',
  materialUnknown: '#cbd5e1',
  materials: ['#d8b77a', '#9cc29a', '#9fb9d9', '#dba5a5', '#c2a8d8', '#e3cf86', '#a9d4d0'],
};
