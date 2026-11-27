// UA0 (congelado por el coordinador, contrato §4.4): control de tema de la cabecera. El escritor UA1-T lo reemplaza
// por el botón de dos estados (oscuro por defecto). Hasta entonces delega en el selector de siempre.
import { ThemeSelect } from './ThemeSelect';

export function ThemeToggle() {
  return <ThemeSelect />;
}
