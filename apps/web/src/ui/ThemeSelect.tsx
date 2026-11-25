import { THEME_PREFS, optionLabel, parsePref } from '../theme/theme';
import { useTheme } from '../theme/useTheme';

/** Selector de tema de 3 estados (Sistema / Claro / Oscuro). «Sistema» muestra el tema resuelto. */
export function ThemeSelect() {
  const { pref, systemDark, setPref } = useTheme();
  return (
    <label className="theme-select">
      <span>Tema</span>
      <select value={pref} onChange={(e) => setPref(parsePref(e.target.value))}>
        {THEME_PREFS.map((p) => (
          <option key={p} value={p}>
            {optionLabel(p, systemDark)}
          </option>
        ))}
      </select>
    </label>
  );
}
