// Anuncios para las regiones vivas persistentes. El texto se escribe con un pequeño retraso: así no choca con el
// cambio de foco ni con un diálogo que se cierra (una región dentro de un fondo inerte no se anuncia).

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextAnnouncement } from './resultSummary';

const DELAY_MS = 150;

export interface Announcer {
  polite: string;
  alert: string;
  announce: (message: string) => void;
  announceError: (message: string) => void;
}

export function useAnnouncer(): Announcer {
  const [polite, setPolite] = useState('');
  const [alert, setAlert] = useState('');
  const timers = useRef(new Set<number>());

  const later = useCallback((fn: () => void): void => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, DELAY_MS);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const announce = useCallback((message: string) => later(() => setPolite((p) => nextAnnouncement(p, message))), [later]);
  const announceError = useCallback((message: string) => later(() => setAlert((p) => nextAnnouncement(p, message))), [later]);
  return { polite, alert, announce, announceError };
}
