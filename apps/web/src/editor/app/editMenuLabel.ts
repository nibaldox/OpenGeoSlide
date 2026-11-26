// Disparador del menú «Editar» con 480 px o menos (B-09, R9-11b): sin la barra de herramientas a la vista, el nombre del
// disparador dice cuál está activa, salvo «Seleccionar» (la de partida).

import type { Tool } from '../types';

export function editMenuLabel(tool: Tool, toolLabel: string | undefined): string {
  return tool === 'select' || !toolLabel ? 'Editar' : `Editar · ${toolLabel}`;
}
