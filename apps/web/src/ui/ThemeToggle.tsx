// Botón de tema de la cabecera (UA-D4, contrato §3.2): dos estados, oscuro por defecto. Muestra el sol en oscuro y la luna en claro
// (el ícono es la acción) y su nombre dice a qué tema cambia. UA1-A lo coloca en la cabecera.
import { nextTheme, toggleLabel } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { IconMoon, IconSun } from './icons';

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  const label = toggleLabel(pref);
  return (
    <button type="button" className="gs-icon-btn" data-testid="theme-toggle" aria-label={label} title={label} onClick={() => setPref(nextTheme(pref))}>
      {pref === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
