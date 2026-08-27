import { FullscreenController } from '@fullscreen-controller';
import type { FullscreenAdapter } from '@typings/adapters.types';

/**
 * Spec for `FullscreenController` — the framework-agnostic fullscreen state machine. A fake
 * adapter drives `isFullscreen()` and the `onChange` subscription so the controller's state,
 * toggle decision and `fullscreenChange` emission can be asserted without any DOM.
 */
function createMockAdapter(initial = false): FullscreenAdapter & { fire: () => void; setFs: (v: boolean) => void } {
  let fs = initial;
  let cb: (() => void) | null = null;
  return {
    request: jest.fn(() => {
      fs = true;
    }),
    exit: jest.fn(() => {
      fs = false;
    }),
    isFullscreen: jest.fn(() => fs),
    onChange: jest.fn((c) => {
      cb = c;
      return () => {
        cb = null;
      };
    }),
    fire() {
      if (cb) cb();
    },
    setFs(v: boolean) {
      fs = v;
    },
  };
}

describe('FullscreenController', () => {
  it('seeds isFullscreen from the adapter and subscribes to changes', () => {
    const adapter = createMockAdapter(true);
    const controller = new FullscreenController(adapter);
    expect(controller.isFullscreen).toBe(true);
    expect(adapter.onChange).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('request()/exit() delegate to the adapter', () => {
    const adapter = createMockAdapter();
    const controller = new FullscreenController(adapter);
    controller.request();
    expect(adapter.request).toHaveBeenCalled();
    controller.exit();
    expect(adapter.exit).toHaveBeenCalled();
    controller.destroy();
  });

  it('toggle() requests when not fullscreen and exits when fullscreen', () => {
    const adapter = createMockAdapter(false);
    const controller = new FullscreenController(adapter);
    controller.toggle();
    expect(adapter.request).toHaveBeenCalledTimes(1);
    controller.toggle();
    expect(adapter.exit).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('emits fullscreenChange with the new state on an adapter change', () => {
    const adapter = createMockAdapter(false);
    const controller = new FullscreenController(adapter);
    const handler = jest.fn();
    controller.on('fullscreenChange', handler);

    adapter.setFs(true);
    adapter.fire();

    expect(handler).toHaveBeenCalledWith(true);
    expect(controller.isFullscreen).toBe(true);
    controller.destroy();
  });

  it('does nothing after destroy and unsubscribes', () => {
    const adapter = createMockAdapter();
    const controller = new FullscreenController(adapter);
    controller.destroy();

    controller.request();
    controller.exit();
    controller.toggle();
    expect(adapter.request).not.toHaveBeenCalled();
    expect(adapter.exit).not.toHaveBeenCalled();

    // A late adapter change is ignored (unsubscribed).
    const handler = jest.fn();
    controller.on('fullscreenChange', handler);
    adapter.fire();
    expect(handler).not.toHaveBeenCalled();
  });
});
