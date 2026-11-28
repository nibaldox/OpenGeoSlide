// Íconos SVG lineales de la suite (DISENO_B §2.8: 16-18 px, `currentColor`, `aria-hidden`). Los nombres y la firma son
// contrato (briefs/UA_CONTRATO.md §4.4). Cuadrícula de 24 × 24, trazo de 1,8 con remates redondeados. Los dibujos salen
// de la maqueta de la suite (`src/ogs-mock.js`); «Instalar», «Advertencia» y «Cerrar» están dibujados a mano.

import type { ReactElement } from 'react';

export interface IconProps {
  /** Lado en px (por defecto 18). */
  size?: number;
}

/** Dibuja un ícono a partir de sus trazos SVG (los hijos de `<svg>`); `name` queda en `data-icon` para pruebas. */
function icon(name: string, shapes: ReactElement): (props: IconProps) => ReactElement {
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
      {shapes}
    </svg>
  );
  C.displayName = `Icon(${name})`;
  return C;
}

// Herramientas del lienzo
export const IconSelect = icon('select', <path d="M5 3l14 8-6 1.5L10 19z" />);
export const IconAddVertex = icon(
  'add-vertex',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
  </>,
);
export const IconDrawRegion = icon('draw-region', <path d="M4 18l4-11 7 3 5-5v13z" />);
export const IconSplitRegion = icon(
  'split-region',
  <>
    <path d="M4 18l4-11 7 3 5-5v13z" />
    <path d="M3 12h18" strokeDasharray="2 2.5" />
  </>,
);
export const IconReinforce = icon(
  'reinforce',
  <>
    <path d="M4 6l16 12" />
    <circle cx="4" cy="6" r="1.8" />
    <path d="M17 14l3 4-4.6.8" />
  </>,
);
export const IconPan = icon(
  'pan',
  <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
);
// Vista
export const IconZoomIn = icon(
  'zoom-in',
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5M8.5 11h5M11 8.5v5" />
  </>,
);
export const IconZoomOut = icon(
  'zoom-out',
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5M8.5 11h5" />
  </>,
);
export const IconFit = icon('fit', <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
// Edición y cabecera
export const IconUndo = icon(
  'undo',
  <>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
  </>,
);
export const IconRedo = icon(
  'redo',
  <>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 000 12h3" />
  </>,
);
export const IconHelp = icon(
  'help',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2.2M12 17h.01" />
  </>,
);
export const IconSun = icon(
  'sun',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const IconMoon = icon('moon', <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />);
export const IconFile = icon(
  'file',
  <>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </>,
);
export const IconExport = icon(
  'export',
  <>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 15v5h14v-5" />
  </>,
);
export const IconInstall = icon(
  'install',
  <>
    <path d="M12 4v11M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </>,
);
// Navegación y estado
export const IconChevronDown = icon('chevron-down', <path d="M6 9l6 6 6-6" />);
export const IconCollapse = icon('collapse', <path d="M15 6l-6 6 6 6" />);
export const IconCheck = icon('check', <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconWarning = icon(
  'warning',
  <>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 10v4.5M12 17.5h.01" />
  </>,
);
export const IconClose = icon('close', <path d="M6 6l12 12M18 6L6 18" />);
// Vistas
export const IconCanvas = icon(
  'canvas',
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M6 16l4-6 3 3 2-2 3 5" />
  </>,
);
export const IconTable = icon(
  'table',
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16" />
  </>,
);
export const IconShield = icon(
  'shield',
  <>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </>,
);
export const IconDoc = icon(
  'doc',
  <>
    <path d="M6 3h12v18H6z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </>,
);
// Acciones
export const IconPlay = icon('play', <path d="M7 5l12 7-12 7z" />);
export const IconPdf = icon(
  'pdf',
  <>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 13h6M9 17h4" />
  </>,
);
