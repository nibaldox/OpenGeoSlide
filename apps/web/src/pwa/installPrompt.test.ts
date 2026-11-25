import { describe, expect, it, vi } from 'vitest';
import { createInstallController, installButtonVisible, isStandaloneDisplay, type InstallPromptEvent } from './installPrompt';

class FakeTarget extends EventTarget {}

function promptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): InstallPromptEvent & Event {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as InstallPromptEvent & Event;
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return e;
}

function setup(standalone = false) {
  const target = new FakeTarget();
  const controller = createInstallController({ target, isStandalone: () => standalone });
  return { target, controller };
}

describe('isStandaloneDisplay', () => {
  it('reconoce display-mode: standalone', () => {
    expect(isStandaloneDisplay({ matches: (q) => q === '(display-mode: standalone)' })).toBe(true);
  });
  it('reconoce el modo independiente de iOS (navigator.standalone)', () => {
    expect(isStandaloneDisplay({ matches: () => false, navigatorStandalone: true })).toBe(true);
  });
  it('en una pestaña normal no es independiente', () => {
    expect(isStandaloneDisplay({ matches: () => false })).toBe(false);
    expect(isStandaloneDisplay({ matches: () => false, navigatorStandalone: false })).toBe(false);
  });
});

describe('installButtonVisible', () => {
  it('solo se muestra con una oferta del navegador y sin estar instalada ni en modo independiente', () => {
    expect(installButtonVisible({ offered: true, installed: false, standalone: false })).toBe(true);
    expect(installButtonVisible({ offered: false, installed: false, standalone: false })).toBe(false);
    expect(installButtonVisible({ offered: true, installed: true, standalone: false })).toBe(false);
    expect(installButtonVisible({ offered: true, installed: false, standalone: true })).toBe(false);
  });
});

describe('createInstallController', () => {
  it('empieza oculto: el navegador aún no ofreció nada', () => {
    const { controller } = setup();
    expect(controller.getState()).toEqual({ offered: false, installed: false, standalone: false });
    expect(installButtonVisible(controller.getState())).toBe(false);
  });

  it('beforeinstallprompt muestra el botón y evita el mini aviso del navegador', () => {
    const { target, controller } = setup();
    const e = promptEvent();
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(installButtonVisible(controller.getState())).toBe(true);
  });

  it('avisa a los suscriptores al cambiar el estado', () => {
    const { target, controller } = setup();
    const listener = vi.fn();
    controller.subscribe(listener);
    target.dispatchEvent(promptEvent());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('la referencia del estado es estable mientras no cambie (useSyncExternalStore)', () => {
    const { target, controller } = setup();
    expect(controller.getState()).toBe(controller.getState());
    const before = controller.getState();
    target.dispatchEvent(promptEvent());
    expect(controller.getState()).not.toBe(before);
  });

  it('instalar llama a prompt() y, si se acepta, oculta el botón', async () => {
    const { target, controller } = setup();
    const e = promptEvent('accepted');
    target.dispatchEvent(e);
    await expect(controller.install()).resolves.toBe('accepted');
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(installButtonVisible(controller.getState())).toBe(false);
    expect(controller.getState().installed).toBe(true);
  });

  it('si el usuario rechaza el cuadro, el botón se oculta (el evento solo sirve una vez) pero no cuenta como instalada', async () => {
    const { target, controller } = setup();
    target.dispatchEvent(promptEvent('dismissed'));
    await expect(controller.install()).resolves.toBe('dismissed');
    expect(controller.getState()).toMatchObject({ offered: false, installed: false });
  });

  it('un nuevo beforeinstallprompt tras rechazar vuelve a ofrecer el botón', async () => {
    const { target, controller } = setup();
    target.dispatchEvent(promptEvent('dismissed'));
    await controller.install();
    target.dispatchEvent(promptEvent());
    expect(installButtonVisible(controller.getState())).toBe(true);
  });

  it('appinstalled oculta el botón aunque se haya instalado desde el menú del navegador', () => {
    const { target, controller } = setup();
    target.dispatchEvent(promptEvent());
    target.dispatchEvent(new Event('appinstalled'));
    expect(installButtonVisible(controller.getState())).toBe(false);
    expect(controller.getState().installed).toBe(true);
  });

  it('en modo independiente (ya instalada) nunca se muestra, aunque llegue el evento', () => {
    const { target, controller } = setup(true);
    target.dispatchEvent(promptEvent());
    expect(controller.getState().standalone).toBe(true);
    expect(installButtonVisible(controller.getState())).toBe(false);
  });

  it('install() sin oferta no hace nada', async () => {
    const { controller } = setup();
    await expect(controller.install()).resolves.toBe('unavailable');
  });

  it('si prompt() falla, el botón se oculta sin romper', async () => {
    const { target, controller } = setup();
    const e = promptEvent();
    e.prompt = vi.fn(async () => {
      throw new Error('boom');
    });
    target.dispatchEvent(e);
    await expect(controller.install()).resolves.toBe('unavailable');
    expect(controller.getState().offered).toBe(false);
  });

  it('dispose quita los oyentes', () => {
    const { target, controller } = setup();
    controller.dispose();
    target.dispatchEvent(promptEvent());
    expect(controller.getState().offered).toBe(false);
  });
});
