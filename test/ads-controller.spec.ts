import { AdsController } from '@ads-controller';

describe('AdsController', () => {
  let controller: AdsController;

  beforeEach(() => {
    controller = new AdsController();
  });

  afterEach(() => {
    controller.destroy();
  });

  describe('initial state', () => {
    it('starts with ad not active', () => {
      expect(controller.isAdActive).toBe(false);
    });
  });

  describe('configure()', () => {
    it('accepts an ads config', () => {
      controller.configure({ skipAfter: 5 });
      expect(controller.isAdActive).toBe(false); // not active until play
    });

    it('resets state when reconfigured', () => {
      controller.configure({ skipAfter: 5 });
      controller.notifyPlay();
      expect(controller.isAdActive).toBe(true);

      controller.configure(null);
      expect(controller.isAdActive).toBe(false);
    });
  });

  describe('notifyPlay() — pre-roll activation', () => {
    it('activates ad on first play only', () => {
      const handler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.on('adActivated', handler);

      controller.notifyPlay();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(controller.isAdActive).toBe(true);

      // Second play does not re-activate
      controller.notifyPlay();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no ads configured', () => {
      const handler = jest.fn();
      controller.on('adActivated', handler);
      controller.notifyPlay();
      expect(handler).not.toHaveBeenCalled();
      expect(controller.isAdActive).toBe(false);
    });
  });

  describe('update() — skip availability', () => {
    it('emits adSkippable when elapsed time reaches skipAfter', () => {
      const skippableHandler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.notifyPlay();
      controller.on('adSkippable', skippableHandler);

      // Before skipAfter
      controller.update(3, 30, false);
      expect(skippableHandler).not.toHaveBeenCalled();

      // At skipAfter
      controller.update(5, 30, false);
      expect(skippableHandler).toHaveBeenCalledTimes(1);

      // Should not emit again
      controller.update(6, 30, false);
      expect(skippableHandler).toHaveBeenCalledTimes(1);
    });

    it('computes skipCountdown correctly', () => {
      const progressHandler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.notifyPlay();
      controller.on('adProgress', progressHandler);

      controller.update(2, 30, false);
      expect(progressHandler).toHaveBeenCalledWith({
        progress: 2 / 5,
        canSkip: false,
        skipCountdown: 3,
      });
    });
  });

  describe('update() — progress computation', () => {
    it('computes progress based on skipAfter when hasSkipTimer', () => {
      const handler = jest.fn();
      controller.configure({ skipAfter: 10 });
      controller.notifyPlay();
      controller.on('adProgress', handler);

      controller.update(5, 30, false);
      expect(handler).toHaveBeenCalledWith({
        progress: 0.5,
        canSkip: false,
        skipCountdown: 5,
      });
    });

    it('computes progress based on duration when no skipAfter', () => {
      const handler = jest.fn();
      controller.configure({});
      controller.notifyPlay();
      controller.on('adProgress', handler);

      controller.update(15, 30, false);
      expect(handler).toHaveBeenCalledWith({
        progress: 0.5,
        canSkip: false,
        skipCountdown: 0,
      });
    });

    it('caps progress at 1', () => {
      const handler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.notifyPlay();
      controller.on('adProgress', handler);

      controller.update(10, 30, false);
      expect(handler).toHaveBeenCalledWith({
        progress: 1,
        canSkip: true,
        skipCountdown: 0,
      });
    });
  });

  describe('update() — completion detection', () => {
    it('emits adCompleted on ended', () => {
      const completedHandler = jest.fn();
      const onAdComplete = jest.fn();
      controller.configure({ onAdComplete });
      controller.notifyPlay();
      controller.on('adCompleted', completedHandler);

      controller.update(30, 30, true);
      expect(completedHandler).toHaveBeenCalledTimes(1);
      expect(onAdComplete).toHaveBeenCalledTimes(1);
    });

    it('does not emit adCompleted twice', () => {
      const completedHandler = jest.fn();
      controller.configure({});
      controller.notifyPlay();
      controller.on('adCompleted', completedHandler);

      controller.update(30, 30, true);
      controller.update(30, 30, true);
      expect(completedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('onSkip()', () => {
    it('calls the configured onSkip callback', () => {
      const onSkip = jest.fn();
      controller.configure({ skipAfter: 5, onSkip });
      controller.notifyPlay();
      controller.onSkip();
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no onSkip configured', () => {
      controller.configure({});
      controller.notifyPlay();
      // Should not throw
      controller.onSkip();
    });
  });

  describe('onAdClick()', () => {
    it('calls the configured onAdClick callback', () => {
      const onAdClick = jest.fn();
      controller.configure({ onAdClick });
      controller.notifyPlay();
      controller.onAdClick();
      expect(onAdClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('stateChange event', () => {
    it('emits stateChange on every update', () => {
      const handler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.notifyPlay();
      controller.on('stateChange', handler);

      controller.update(3, 30, false);
      expect(handler).toHaveBeenCalledWith({
        isAdActive: true,
        hasSkipTimer: true,
        canSkip: false,
        skipCountdown: 2,
        adProgress: 3 / 5,
      });
    });
  });

  describe('destroy()', () => {
    it('prevents further operations', () => {
      const handler = jest.fn();
      controller.configure({ skipAfter: 5 });
      controller.on('adActivated', handler);
      controller.destroy();

      controller.notifyPlay();
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not emit events after destroy', () => {
      const handler = jest.fn();
      controller.configure({});
      controller.notifyPlay();
      controller.on('adProgress', handler);
      controller.destroy();

      controller.update(5, 30, false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('sourceReset event', () => {
    it('emits sourceReset when ads toggle on (null → config)', () => {
      const handler = jest.fn();
      controller.on('sourceReset', handler);
      controller.configure({ skipAfter: 5 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits sourceReset when ads toggle off (config → null)', () => {
      controller.configure({ skipAfter: 5 });
      const handler = jest.fn();
      controller.on('sourceReset', handler);
      controller.configure(null);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not emit sourceReset when reconfiguring with a new config (config → config)', () => {
      controller.configure({ skipAfter: 5 });
      const handler = jest.fn();
      controller.on('sourceReset', handler);
      controller.configure({ skipAfter: 10 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not emit sourceReset when configuring null → null', () => {
      const handler = jest.fn();
      controller.on('sourceReset', handler);
      controller.configure(null);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
