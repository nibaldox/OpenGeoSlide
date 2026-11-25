import { useSyncExternalStore } from 'react';
import { getInstallController, installButtonVisible } from '../pwa/installPrompt';

/** «Instalar app»: aparece solo cuando el navegador ofrece instalar la PWA y se oculta tras instalar o en modo independiente. */
export function InstallButton() {
  const controller = getInstallController();
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!installButtonVisible(state)) return null;
  return (
    <button type="button" className="install-button" data-testid="install-app" onClick={() => void controller.install()}>
      Instalar app
    </button>
  );
}
