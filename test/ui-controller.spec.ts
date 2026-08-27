import { UIController } from '@ui-controller';

describe('UIController', () => {
  let controller: UIController;

  beforeEach(() => {
    jest.useFakeTimers();
    controller = new UIController();
  });

  afterEach(() => {
    controller.destroy();
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with controls visible', () => {
      expect(controller.isControlsVisible).toBe(true);
    });

    it('starts with settings closed', () => {
      expect(controller.settingsOpen).toBe(false);
    });

    it('starts unlocked', () => {
      expect(controller.isLocked).toBe(false);
    });
  });

  describe('show()', () => {
    it('sets controls visible and starts hide timer', () => {
      controller.hide(); // first hide
      const handler = jest.fn();
      controller.on('controlsVisibilityChange', handler);

      controller.show();
      expect(controller.isControlsVisible).toBe(true);
      expect(handler).toHaveBeenCalledWith(true);
    });

    it('hides after configured delay', () => {
      controller.hide();
      controller.show();
      jest.advanceTimersByTime(3000);
      expect(controller.isControlsVisible).toBe(false);
    });

    it('resets timer when called again', () => {
      controller.hide();
      controller.show();
      jest.advanceTimersByTime(2000);
      controller.show(); // reset timer
      jest.advanceTimersByTime(2000);
      // Only 2000ms since last show, should still be visible
      expect(controller.isControlsVisible).toBe(true);
      jest.advanceTimersByTime(1000);
      expect(controller.isControlsVisible).toBe(false);
    });

    it('respects custom hideDelay', () => {
      const custom = new UIController({ hideDelay: 5000 });
      custom.hide();
      custom.show();
      jest.advanceTimersByTime(3000);
      expect(custom.isControlsVisible).toBe(true);
      jest.advanceTimersByTime(2000);
      expect(custom.isControlsVisible).toBe(false);
      custom.destroy();
    });
  });

  describe('hide()', () => {
    it('sets controls not visible', () => {
      controller.hide();
      expect(controller.isControlsVisible).toBe(false);
    });

    it('emits controlsVisibilityChange', () => {
      const handler = jest.fn();
      controller.on('controlsVisibilityChange', handler);
      controller.hide();
      expect(handler).toHaveBeenCalledWith(false);
    });

    it('clears pending timer', () => {
      controller.show();
      controller.hide();
      jest.advanceTimersByTime(5000);
      // Should stay hidden (no timer re-hiding)
      expect(controller.isControlsVisible).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('hides when visible', () => {
      controller.toggle();
      expect(controller.isControlsVisible).toBe(false);
    });

    it('shows when hidden', () => {
      controller.hide();
      controller.toggle();
      expect(controller.isControlsVisible).toBe(true);
    });

    it('starts auto-hide timer when toggling to visible', () => {
      controller.hide();
      controller.toggle(); // now visible
      jest.advanceTimersByTime(3000);
      expect(controller.isControlsVisible).toBe(false);
    });
  });

  describe('lock()', () => {
    it('keeps controls visible', () => {
      controller.lock();
      jest.advanceTimersByTime(10000);
      expect(controller.isControlsVisible).toBe(true);
    });

    it('clears existing timer', () => {
      controller.show();
      controller.lock();
      jest.advanceTimersByTime(5000);
      expect(controller.isControlsVisible).toBe(true);
    });

    it('sets isLocked true', () => {
      controller.lock();
      expect(controller.isLocked).toBe(true);
    });
  });

  describe('unlock()', () => {
    it('starts hide timer', () => {
      controller.lock();
      controller.unlock();
      expect(controller.isLocked).toBe(false);
      jest.advanceTimersByTime(3000);
      expect(controller.isControlsVisible).toBe(false);
    });
  });

  describe('show() while locked', () => {
    it('does not start timer', () => {
      controller.lock();
      controller.show();
      jest.advanceTimersByTime(10000);
      expect(controller.isControlsVisible).toBe(true);
    });
  });

  describe('toggleSettings()', () => {
    it('toggles settingsOpen', () => {
      controller.toggleSettings();
      expect(controller.settingsOpen).toBe(true);
      controller.toggleSettings();
      expect(controller.settingsOpen).toBe(false);
    });

    it('emits settingsChange', () => {
      const handler = jest.fn();
      controller.on('settingsChange', handler);
      controller.toggleSettings();
      expect(handler).toHaveBeenCalledWith(true);
      controller.toggleSettings();
      expect(handler).toHaveBeenCalledWith(false);
    });
  });

  describe('destroy()', () => {
    it('clears timer', () => {
      controller.show();
      controller.destroy();
      jest.advanceTimersByTime(5000);
      // Remains in last state — no timer fires
      expect(controller.isControlsVisible).toBe(true);
    });

    it('ignores calls after destroy', () => {
      controller.destroy();
      controller.show();
      controller.hide();
      controller.toggle();
      controller.lock();
      controller.unlock();
      controller.toggleSettings();
      // No errors thrown
    });

    it('does not emit events after destroy', () => {
      const handler = jest.fn();
      controller.on('controlsVisibilityChange', handler);
      controller.destroy();
      controller.hide();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
