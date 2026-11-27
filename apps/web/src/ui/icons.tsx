// UA0 (congelado por el coordinador): íconos SVG lineales de la suite (DISENO_B §2.8: 16-18 px, `currentColor`,
// `aria-hidden`). Los nombres y la firma son contrato (briefs/UA_CONTRATO.md §4.4). El escritor UA1-S reemplaza los
// trazos provisionales por los de la lámina de la suite; los demás escritores solo importan.

import type { ReactElement } from 'react';

export interface IconProps {
  /** Lado en px (por defecto 18). */
  size?: number;
}

function placeholder(name: string) {
  const C = ({ size = 18 }: IconProps): ReactElement => (
    <svg
      className="gs-icon"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
  C.displayName = `Icon(${name})`;
  return C;
}

// Herramientas del lienzo
export const IconSelect = placeholder('select');
export const IconAddVertex = placeholder('add-vertex');
export const IconDrawRegion = placeholder('draw-region');
export const IconSplitRegion = placeholder('split-region');
export const IconReinforce = placeholder('reinforce');
export const IconPan = placeholder('pan');
// Vista
export const IconZoomIn = placeholder('zoom-in');
export const IconZoomOut = placeholder('zoom-out');
export const IconFit = placeholder('fit');
// Edición y cabecera
export const IconUndo = placeholder('undo');
export const IconRedo = placeholder('redo');
export const IconHelp = placeholder('help');
export const IconSun = placeholder('sun');
export const IconMoon = placeholder('moon');
export const IconFile = placeholder('file');
export const IconExport = placeholder('export');
export const IconInstall = placeholder('install');
// Navegación y estado
export const IconChevronDown = placeholder('chevron-down');
export const IconCollapse = placeholder('collapse');
export const IconCheck = placeholder('check');
export const IconWarning = placeholder('warning');
export const IconClose = placeholder('close');
// Vistas
export const IconCanvas = placeholder('canvas');
export const IconTable = placeholder('table');
export const IconShield = placeholder('shield');
export const IconDoc = placeholder('doc');
// Acciones
export const IconPlay = placeholder('play');
export const IconPdf = placeholder('pdf');
