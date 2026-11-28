// Herramientas del lienzo y su rotulado (paleta flotante y barra de estado). Lógica pura.

import type { Tool } from '../../types';

export type ToolIconKey = 'select' | 'add_vertex' | 'draw_region' | 'split_region' | 'reinforce' | 'pan';

export interface ToolDef {
  tool: Tool;
  /** Nombre accesible del botón (el de siempre). */
  label: string;
  /** Letra del atajo que se muestra en el tooltip, o `null`. */
  key: string | null;
  /** Valor de `aria-keyshortcuts`. */
  shortcuts: string | null;
  icon: ToolIconKey;
}

export const TOOLS: readonly ToolDef[] = [
  { tool: 'select', label: 'Seleccionar', key: 'V', shortcuts: 'V', icon: 'select' },
  { tool: 'add_vertex', label: 'Agregar vértice', key: 'A', shortcuts: 'A', icon: 'add_vertex' },
  { tool: 'draw_region', label: 'Dibujar región', key: 'R', shortcuts: 'R', icon: 'draw_region' },
  { tool: 'split_region', label: 'Dividir región', key: 'D', shortcuts: 'D', icon: 'split_region' },
  // «F» es la tecla que anuncia el tooltip (maqueta); «E» sigue activa y está en la ayuda.
  { tool: 'draw_reinforcement', label: 'Dibujar refuerzo', key: 'F', shortcuts: 'F E', icon: 'reinforce' },
  { tool: 'pan', label: 'Mover vista', key: 'H', shortcuts: 'H', icon: 'pan' },
];

export function toolDef(tool: Tool): ToolDef | undefined {
  return TOOLS.find((t) => t.tool === tool);
}

/** `title` del botón: la tecla, como hasta ahora («Tecla V»), o el nombre si no hay tecla. */
export function toolTitle(t: ToolDef): string {
  return t.key === null ? t.label : `Tecla ${t.key}`;
}

/** Texto de la barra de estado: «Herramienta: Seleccionar». */
export function toolStatusText(tool: Tool): string {
  return `Herramienta: ${toolDef(tool)?.label ?? tool}`;
}
