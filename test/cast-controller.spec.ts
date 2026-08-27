import { CastController } from '@cast-controller';
import type { CastAdapter, CastState } from '@typings/adapters.types';

/**
 * Spec for `CastController` — the framework-agnostic cast/remote-playback state machine. A fake
 * adapter drives support/state/availability and the prompt outcome so the controller's derived
 * `castAvailable`, disabled gating, and state/availability events can be asserted without any DOM.
 */
function createMockAdapter(
  opts: { supported?: boolean; state?: CastState; promptReject?: boolean } = {},
): CastAdapter & { fireState: (s: CastState) => void; fireAvail: (a: boolean) => void } {
  let stateCb: ((s: CastState) => void) | null = null;
  let availCb: ((a: boolean) => void) | null = null;
  return {
    isSupported: jest.fn(() => opts.supported ?? true),
    getState: jest.fn(() => opts.state ?? 'disconnected'),
    prompt: jest.fn(() =>
      opts.promptReject ? Promise.reject(new Error('no')) : Promise.resolve({ usedFallback: false }),
    ),
    setDisabled: jest.fn(),
    watchAvailability: jest.fn((cb) => {
      availCb = cb;
      return () => {
        availCb = null;
      };
    }),
    onStateChange: jest.fn((cb) => {
      stateCb = cb;
      return () => {
        stateCb = null;
      };
    }),
    destroy: jest.fn(),
    fireState(s: CastState) {
      if (stateCb) stateCb(s);
    },
    fireAvail(a: boolean) {
      if (availCb) availCb(a);
    },
  };
}

describe('CastController', () => {
  it('exposes isSupported and seeds state from the adapter', () => {
    const adapter = createMockAdapter({ supported: true, state: 'disconnected' });
    const controller = new CastController(adapter);
    expect(controller.isSupported).toBe(true);
    expect(controller.castState).toBe('disconnected');
    controller.destroy();
  });

  it('castAvailable requires supported + available + not disabled', () => {
    const adapter = createMockAdapter({ supported: true });
    const controller = new CastController(adapter);
    expect(controller.castAvailable).toBe(false); // no device yet

    adapter.fireAvail(true);
    expect(controller.castAvailable).toBe(true);

    controller.setDisabled(true);
    expect(controller.castAvailable).toBe(false);
    controller.destroy();
  });

  it('constructor forwards the initial disabled flag to the adapter', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter, { disabled: true });
    expect(adapter.setDisabled).toHaveBeenCalledWith(true);
    expect(controller.disabled).toBe(true);
    controller.destroy();
  });

  it('prompt() delegates to the adapter when enabled', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter);
    controller.prompt();
    expect(adapter.prompt).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('prompt() is a no-op when disabled', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter, { disabled: true });
    controller.prompt();
    expect(adapter.prompt).not.toHaveBeenCalled();
    controller.destroy();
  });

  it('swallows a rejected prompt (all mechanisms failed)', async () => {
    const adapter = createMockAdapter({ promptReject: true });
    const controller = new CastController(adapter);
    expect(() => controller.prompt()).not.toThrow();
    await Promise.resolve();
    controller.destroy();
  });

  it('emits stateChange on adapter state changes (deduped)', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter);
    const handler = jest.fn();
    controller.on('stateChange', handler);

    adapter.fireState('connecting');
    adapter.fireState('connected');
    adapter.fireState('connected'); // duplicate — ignored
    expect(handler).toHaveBeenCalledTimes(2);
    expect(controller.castState).toBe('connected');
    controller.destroy();
  });

  it('emits availabilityChange (deduped)', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter);
    const handler = jest.fn();
    controller.on('availabilityChange', handler);

    adapter.fireAvail(true);
    adapter.fireAvail(true); // duplicate — ignored
    expect(handler).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('destroy unsubscribes and releases the adapter', () => {
    const adapter = createMockAdapter();
    const controller = new CastController(adapter);
    controller.destroy();
    expect(adapter.destroy).toHaveBeenCalled();

    // Late events are ignored.
    const handler = jest.fn();
    controller.on('stateChange', handler);
    adapter.fireState('connected');
    expect(handler).not.toHaveBeenCalled();
  });
});
