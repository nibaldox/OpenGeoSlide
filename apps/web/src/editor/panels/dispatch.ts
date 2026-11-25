import type { EditorCommand, EditorStore } from '../types';

/**
 * Aplica una lista de comandos como una sola entrada de historial: uno solo se despacha tal cual; varios van dentro
 * de un gesto (`beginGesture`/`endGesture`), de modo que un solo Ctrl+Z los deshace todos.
 */
export function applyCommands(store: EditorStore, label: string, commands: readonly EditorCommand[]): void {
  if (commands.length === 0) return;
  if (commands.length === 1) {
    store.dispatch(commands[0]);
    return;
  }
  store.beginGesture(label);
  try {
    for (const command of commands) store.dispatch(command);
  } finally {
    store.endGesture();
  }
}
