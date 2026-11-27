// Alias de transición: App.tsx (UA1-A) todavía importa `ThemeSelect`. El selector de tres estados desapareció (UA-D4); este
// archivo se puede borrar cuando App.tsx importe `ThemeToggle`.
export { ThemeToggle as ThemeSelect } from './ThemeToggle';
