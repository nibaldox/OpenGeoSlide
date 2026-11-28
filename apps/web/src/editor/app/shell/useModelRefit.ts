// CM-WB: monta `attachModelRefit` sobre el store del editor (ver `modelRefit.ts`). Los ganchos se leen por referencia: el lienzo no
// vuelve a suscribirse cuando cambian sus funciones.

import { useEffect, useRef } from 'react';
import type { EditorStore } from '../../types';
import { attachModelRefit, type ModelRefitHooks } from './modelRefit';

export function useModelRefit(store: Pick<EditorStore, 'getState' | 'subscribe'>, hooks: ModelRefitHooks): void {
  const ref = useRef(hooks);
  ref.current = hooks;
  useEffect(
    () =>
      attachModelRefit(store, {
        isAuto: () => ref.current.isAuto(),
        refit: () => ref.current.refit(),
        isBusy: () => ref.current.isBusy?.() === true,
      }),
    [store],
  );
}
