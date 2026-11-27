// Grupo «Herramienta del lienzo»: los seis botones de siempre, que el lienzo coloca en su paleta flotante (`paletteTools`,
// contrato UA §4.2). Cada botón: `gs-tool ec-tool ea-tool`, `aria-pressed`, ícono, `aria-label` con el nombre de siempre y un tooltip
// (`gs-tip`, `aria-hidden`) con la tecla.

import type { ComponentType } from 'react';
import { IconAddVertex, IconDrawRegion, IconPan, IconReinforce, IconSelect, IconSplitRegion, type IconProps } from '../../../ui/icons';
import type { Tool } from '../../types';
import { TOOLS, type ToolIconKey } from './tools';

const ICONS: Record<ToolIconKey, ComponentType<IconProps>> = {
  select: IconSelect,
  add_vertex: IconAddVertex,
  draw_region: IconDrawRegion,
  split_region: IconSplitRegion,
  reinforce: IconReinforce,
  pan: IconPan,
};

export function PaletteTools({ tool, onSelect }: { tool: Tool; onSelect: (tool: Tool) => void }) {
  return (
    <div className="ea-tools" role="group" aria-label="Herramienta del lienzo">
      {TOOLS.map((t) => {
        const Icon = ICONS[t.icon];
        const pressed = tool === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            className={pressed ? 'gs-tool ec-tool ea-tool ea-tool-active' : 'gs-tool ec-tool ea-tool'}
            aria-pressed={pressed}
            aria-label={t.label}
            aria-keyshortcuts={t.shortcuts ?? undefined}
            onClick={() => onSelect(t.tool)}
          >
            <Icon size={18} />
            <span className="gs-tip" aria-hidden="true">
              {t.label}
              {t.key ? <kbd className="gs-kbd">{t.key}</kbd> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
