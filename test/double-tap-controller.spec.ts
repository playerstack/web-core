import { DoubleTapController } from '@double-tap-controller';

describe('DoubleTapController', () => {
  let controller: DoubleTapController;
  let seekFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    controller = new DoubleTapController();
    seekFn = jest.fn();
    controller.setOnSeek(seekFn);
    controller.setTimeInfo(50, 100); // currentTime=50, duration=100
  });

  afterEach(() => {
    controller.destroy();
    jest.useRealTimers();
  });

  describe('single tap', () => {
    it('emits singleTap after doubleTapDelay when only one tap on left', () => {
      const handler = jest.fn();
      controller.on('singleTap', handler);

      controller.handleTapLeft();
      expect(handler).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(handler).toHaveBeenCalledWith('left');
    });

    it('emits singleTap after doubleTapDelay when only one tap on right', () => {
      const handler = jest.fn();
      controller.on('singleTap', handler);

      controller.handleTapRight();
      jest.advanceTimersByTime(300);
      expect(handler).toHaveBeenCalledWith('right');
    });
  });

  describe('double tap — skip', () => {
    it('emits skip backward on double tap left', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      controller.handleTapLeft();
      controller.handleTapLeft(); // double tap

      expect(handler).toHaveBeenCalledWith({
        direction: 'backward',
        visible: true,
        seconds: 10,
      });
      expect(seekFn).toHaveBeenCalledWith(40); // 50 - 10
    });

    it('emits skip forward on double tap right', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      controller.handleTapRight();
      controller.handleTapRight(); // double tap

      expect(handler).toHaveBeenCalledWith({
        direction: 'forward',
        visible: true,
        seconds: 10,
      });
      expect(seekFn).toHaveBeenCalledWith(60); // 50 + 10
    });

    it('does not emit singleTap when double tap occurs', () => {
      const singleHandler = jest.fn();
      controller.on('singleTap', singleHandler);

      controller.handleTapRight();
      controller.handleTapRight();

      jest.advanceTimersByTime(500);
      expect(singleHandler).not.toHaveBeenCalled();
    });
  });

  describe('accumulation on rapid taps', () => {
    it('accumulates skip seconds on repeated double-taps', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      // First double tap forward
      controller.handleTapRight();
      controller.handleTapRight();
      expect(handler).toHaveBeenLastCalledWith({
        direction: 'forward',
        visible: true,
        seconds: 10,
      });

      // Second double tap forward (within display duration)
      controller.handleTapRight();
      controller.handleTapRight();
      expect(handler).toHaveBeenLastCalledWith({
        direction: 'forward',
        visible: true,
        seconds: 20,
      });

      // Third
      controller.handleTapRight();
      controller.handleTapRight();
      expect(handler).toHaveBeenLastCalledWith({
        direction: 'forward',
        visible: true,
        seconds: 30,
      });
    });

    it('resets accumulation when direction changes', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      // Forward
      controller.handleTapRight();
      controller.handleTapRight();

      // Now backward — resets
      controller.handleTapLeft();
      controller.handleTapLeft();
      expect(handler).toHaveBeenLastCalledWith({
        direction: 'backward',
        visible: true,
        seconds: 10, // reset, not 20
      });
    });
  });

  describe('auto-hide after displayDuration', () => {
    it('hides skip indicator after 1000ms', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      controller.handleTapRight();
      controller.handleTapRight();
      handler.mockClear();

      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledWith({
        direction: null,
        visible: false,
        seconds: 0,
      });
    });

    it('resets the hide timer on additional taps', () => {
      const handler = jest.fn();
      controller.on('skip', handler);

      controller.handleTapRight();
      controller.handleTapRight();
      jest.advanceTimersByTime(800); // 200ms left before hide

      // Another double tap — resets timer
      controller.handleTapRight();
      controller.handleTapRight();
      handler.mockClear();

      jest.advanceTimersByTime(800); // still visible (only 800ms since last)
      expect(handler).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200); // now 1000ms since last — hides
      expect(handler).toHaveBeenCalledWith({
        direction: null,
        visible: false,
        seconds: 0,
      });
    });
  });

  describe('configurable skip seconds', () => {
    it('uses custom skipSeconds', () => {
      const custom = new DoubleTapController({ skipSeconds: 15 });
      custom.setTimeInfo(50, 100);
      const seekMock = jest.fn();
      custom.setOnSeek(seekMock);

      const handler = jest.fn();
      custom.on('skip', handler);

      custom.handleTapRight();
      custom.handleTapRight();

      expect(seekMock).toHaveBeenCalledWith(65); // 50 + 15
      expect(handler).toHaveBeenCalledWith({
        direction: 'forward',
        visible: true,
        seconds: 15,
      });

      custom.destroy();
    });
  });

  describe('boundary clamping', () => {
    it('clamps to 0 when skipping backward past start', () => {
      controller.setTimeInfo(5, 100);
      controller.handleTapLeft();
      controller.handleTapLeft();
      expect(seekFn).toHaveBeenCalledWith(0); // max(0, 5-10)
    });

    it('clamps to duration when skipping forward past end', () => {
      controller.setTimeInfo(95, 100);
      controller.handleTapRight();
      controller.handleTapRight();
      expect(seekFn).toHaveBeenCalledWith(100); // min(100, 95+10)
    });
  });

  describe('destroy()', () => {
    it('clears all pending timers', () => {
      controller.handleTapLeft(); // starts single tap timer
      controller.destroy();

      const handler = jest.fn();
      controller.on('singleTap', handler);
      jest.advanceTimersByTime(500);
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores taps after destroy', () => {
      controller.destroy();
      const handler = jest.fn();
      controller.on('skip', handler);

      controller.handleTapLeft();
      controller.handleTapLeft();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('state getter', () => {
    it('returns initial state', () => {
      expect(controller.state).toEqual({
        direction: null,
        visible: false,
        seconds: 0,
      });
    });

    it('reflects current state after skip', () => {
      controller.handleTapRight();
      controller.handleTapRight();
      expect(controller.state).toEqual({
        direction: 'forward',
        visible: true,
        seconds: 10,
      });
    });
  });
});
