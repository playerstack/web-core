import { VolumeController } from '@volume-controller';
import type { VolumeAdapter } from '@typings/adapters.types';

function createMockAdapter(initialVolume = 0.8, initialMuted = false): VolumeAdapter & { triggerChange: (volume: number, muted: boolean) => void } {
  let volume = initialVolume;
  let muted = initialMuted;
  let callback: ((v: number, m: boolean) => void) | null = null;

  return {
    getVolume: jest.fn(() => volume),
    setVolume: jest.fn((v: number) => { volume = v; }),
    getMuted: jest.fn(() => muted),
    setMuted: jest.fn((m: boolean) => { muted = m; }),
    onVolumeChange: jest.fn((cb) => {
      callback = cb;
      return () => { callback = null; };
    }),
    triggerChange(v: number, m: boolean) {
      volume = v;
      muted = m;
      if (callback) callback(v, m);
    },
  };
}

describe('VolumeController', () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let controller: VolumeController;

  beforeEach(() => {
    jest.useFakeTimers();
    adapter = createMockAdapter();
    controller = new VolumeController(adapter);
  });

  afterEach(() => {
    controller.destroy();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('subscribes to adapter volume changes', () => {
      expect(adapter.onVolumeChange).toHaveBeenCalledTimes(1);
    });

    it('emits volumeChange on external adapter change', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      adapter.triggerChange(0.5, false);
      expect(handler).toHaveBeenCalledWith({ volume: 0.5, muted: false });
    });

    it('treats volume === 0 as muted in external changes', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      adapter.triggerChange(0, false);
      expect(handler).toHaveBeenCalledWith({ volume: 0, muted: true });
    });
  });

  describe('onMutedClick() — mute', () => {
    it('remembers volume before muting', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.onMutedClick(); // mute
      expect(adapter.setMuted).toHaveBeenCalledWith(true);
      expect(handler).toHaveBeenCalledWith({ volume: 0.8, muted: true });
    });

    it('restores volume on unmute', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      // Mute first
      controller.onMutedClick();
      handler.mockClear();

      // Simulate adapter now says muted
      (adapter.getMuted as jest.Mock).mockReturnValue(true);

      // Unmute
      controller.onMutedClick();
      expect(adapter.setMuted).toHaveBeenCalledWith(false);
      expect(adapter.setVolume).toHaveBeenCalledWith(0.8);
      expect(handler).toHaveBeenCalledWith({ volume: 0.8, muted: false });
    });

    it('remembers a custom volume before muting', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      // Change volume to 0.6 first
      (adapter.getVolume as jest.Mock).mockReturnValue(0.6);

      controller.onMutedClick(); // mute
      handler.mockClear();

      (adapter.getMuted as jest.Mock).mockReturnValue(true);
      controller.onMutedClick(); // unmute
      expect(handler).toHaveBeenCalledWith({ volume: 0.6, muted: false });
    });
  });

  describe('changeVolume()', () => {
    it('updates adapter volume', () => {
      controller.changeVolume(0.5);
      expect(adapter.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('emits volumeChange with new volume', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);
      controller.changeVolume(0.5);
      expect(handler).toHaveBeenCalledWith({ volume: 0.5, muted: false });
    });

    it('unmutes when volume > 0 and adapter is muted', () => {
      (adapter.getMuted as jest.Mock).mockReturnValue(true);
      controller.changeVolume(0.5);
      expect(adapter.setMuted).toHaveBeenCalledWith(false);
    });

    it('treats volume 0 as muted', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);
      controller.changeVolume(0);
      expect(handler).toHaveBeenCalledWith({ volume: 0, muted: true });
    });

    it('remembers non-zero volume for mute toggle', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.changeVolume(0.3);
      handler.mockClear();

      // Now mute
      (adapter.getMuted as jest.Mock).mockReturnValue(false);
      (adapter.getVolume as jest.Mock).mockReturnValue(0.3);
      controller.onMutedClick(); // mute
      handler.mockClear();

      // Unmute should restore 0.3
      (adapter.getMuted as jest.Mock).mockReturnValue(true);
      controller.onMutedClick();
      expect(handler).toHaveBeenCalledWith({ volume: 0.3, muted: false });
    });
  });

  describe('ignore-own-change guard', () => {
    it('ignores adapter changes triggered by own programmatic change', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.changeVolume(0.5);
      handler.mockClear();

      // Adapter fires back due to setVolume — should be ignored
      adapter.triggerChange(0.5, false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('resumes listening after guard timeout (50ms)', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.changeVolume(0.5);
      handler.mockClear();

      // Still guarded
      adapter.triggerChange(0.5, false);
      expect(handler).not.toHaveBeenCalled();

      // After 50ms, guard expires
      jest.advanceTimersByTime(50);

      adapter.triggerChange(0.7, false);
      expect(handler).toHaveBeenCalledWith({ volume: 0.7, muted: false });
    });
  });

  describe('syncMuted() — mirror external muted prop', () => {
    it('sets the adapter muted and suppresses the echoed onVolumeChange (guard)', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.syncMuted(true);
      expect(adapter.setMuted).toHaveBeenCalledWith(true);

      // An echo fired synchronously (within the 50ms guard) is ignored — no volumeChange emitted.
      adapter.triggerChange(0.8, true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('resumes emitting external changes after the guard window', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);

      controller.syncMuted(false);
      jest.advanceTimersByTime(50);
      adapter.triggerChange(0.4, false);
      expect(handler).toHaveBeenCalledWith({ volume: 0.4, muted: false });
    });

    it('does nothing after destroy', () => {
      controller.destroy();
      adapter.setMuted.mockClear();
      controller.syncMuted(true);
      expect(adapter.setMuted).not.toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('unsubscribes from adapter', () => {
      const handler = jest.fn();
      controller.on('volumeChange', handler);
      controller.destroy();

      adapter.triggerChange(0.5, false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('clears ignore timer', () => {
      controller.changeVolume(0.5);
      controller.destroy();
      // Should not throw when timer fires
      jest.advanceTimersByTime(100);
    });

    it('ignores operations after destroy', () => {
      controller.destroy();
      // Should not throw
      controller.onMutedClick();
      controller.changeVolume(0.5);
    });
  });
});
