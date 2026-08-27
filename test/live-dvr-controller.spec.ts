import { LiveDVRController } from '@live-dvr-controller';
import type { DVRAdapter } from '@typings/adapters.types';

function createMockAdapter(options: { start?: number; end?: number; currentTime?: number } = {}): DVRAdapter & { triggerTimeUpdate: () => void; setCurrentTime: (t: number) => void; setRange: (r: { start: number; end: number } | null) => void } {
  let range: { start: number; end: number } | null = options.start !== undefined && options.end !== undefined
    ? { start: options.start, end: options.end }
    : null;
  let currentTime = options.currentTime ?? 0;
  let callback: (() => void) | null = null;

  return {
    getSeekableRange: jest.fn(() => range),
    getCurrentTime: jest.fn(() => currentTime),
    seekTo: jest.fn(),
    onTimeUpdate: jest.fn((cb) => {
      callback = cb;
      return () => { callback = null; };
    }),
    triggerTimeUpdate() {
      if (callback) callback();
    },
    setCurrentTime(t: number) {
      currentTime = t;
    },
    setRange(r: { start: number; end: number } | null) {
      range = r;
    },
  };
}

describe('LiveDVRController', () => {
  describe('DVR state computation', () => {
    it('returns a no-DVR state (hasDVR false) when no seekable range', () => {
      const adapter = createMockAdapter();
      const controller = new LiveDVRController(adapter);

      // A structured object (not null) so every skin reads a stable shape.
      expect(controller.state).not.toBeNull();
      expect(controller.state!.hasDVR).toBe(false);
      expect(controller.isAtLiveEdge).toBe(true);
      expect(controller.liveOffset).toBe('');

      controller.destroy();
    });

    it('returns a no-DVR state (hasDVR false) when seekable window is below minimum (15s)', () => {
      const adapter = createMockAdapter({ start: 0, end: 10, currentTime: 5 });
      const controller = new LiveDVRController(adapter);

      expect(controller.state!.hasDVR).toBe(false);
      // Known seekable bounds are still surfaced for the too-small window.
      expect(controller.state!.seekableStart).toBe(0);
      expect(controller.state!.seekableEnd).toBe(10);
      controller.destroy();
    });

    it('computes valid DVR state from seekable range (behind the edge maps the real position)', () => {
      // currentTime 150 is 50s behind end 200 → clearly behind the edge, so the slider maps the
      // real window position (not pinned to the edge).
      const adapter = createMockAdapter({ start: 100, end: 200, currentTime: 150 });
      const controller = new LiveDVRController(adapter);

      expect(controller.state).not.toBeNull();
      expect(controller.state!.hasDVR).toBe(true);
      expect(controller.state!.seekableStart).toBe(100);
      expect(controller.state!.seekableEnd).toBe(200);
      expect(controller.state!.seekableWindow).toBe(100);
      expect(controller.state!.sliderDuration).toBe(100);
      expect(controller.state!.isAtLiveEdge).toBe(false);
      expect(controller.state!.sliderPosition).toBe(50); // 150 - 100

      controller.destroy();
    });

    it('pins the slider to the edge and zeroes the offset when at the live edge (YouTube-style)', () => {
      // currentTime 190 is only 10s behind end 200 → within tolerance, so at-edge. The slider is
      // pinned flush to the end and the offset reads 0 so the timeline looks live (no drift/timer).
      const adapter = createMockAdapter({ start: 100, end: 200, currentTime: 190 });
      const controller = new LiveDVRController(adapter);

      expect(controller.state!.isAtLiveEdge).toBe(true);
      expect(controller.state!.sliderPosition).toBe(100); // pinned to seekableWindow
      expect(controller.state!.liveEdgeOffset).toBe(0); // no negative timer while live
      expect(controller.liveOffset).toBe('');

      controller.destroy();
    });
  });

  describe('live edge detection', () => {
    it('detects at live edge when within tolerance', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 95 });
      const controller = new LiveDVRController(adapter);

      expect(controller.isAtLiveEdge).toBe(true);
      expect(controller.state!.isAtLiveEdge).toBe(true);

      controller.destroy();
    });

    it('detects NOT at live edge when behind tolerance', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 50 });
      const controller = new LiveDVRController(adapter);

      expect(controller.isAtLiveEdge).toBe(false);
      expect(controller.state!.isAtLiveEdge).toBe(false);
      expect(controller.state!.liveEdgeOffset).toBe(-50); // 50 - 100

      controller.destroy();
    });

    it('computes liveOffset string when behind', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 20 });
      const controller = new LiveDVRController(adapter);

      // 20 - 100 = -80s → "-1:20"
      expect(controller.liveOffset).toBe('-1:20');

      controller.destroy();
    });

    it('returns empty liveOffset when at live edge', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 95 });
      const controller = new LiveDVRController(adapter);

      expect(controller.liveOffset).toBe('');

      controller.destroy();
    });

    // Regression: on a real live stream `seekableEnd` extends in discrete segment steps while
    // currentTime advances smoothly, so the offset oscillates around the edge. With hysteresis,
    // once at the edge a small dip past the enter-tolerance must NOT flip the badge to "behind".
    it('stays at the live edge through small offset oscillations (hysteresis)', () => {
      // Start clearly at edge: currentTime 198, end 200 → offset -2.
      const adapter = createMockAdapter({ start: 0, end: 200, currentTime: 198 });
      const controller = new LiveDVRController(adapter);
      expect(controller.isAtLiveEdge).toBe(true);

      // seekableEnd jumps ahead by a segment (end 206) while currentTime creeps to 200 → offset
      // -6. Below the OLD 10s tolerance? no; but even past the enter tolerance the sticky exit
      // band (tolerance + hysteresis = 30) keeps it at edge.
      adapter.setRange({ start: 0, end: 206 });
      adapter.setCurrentTime(200);
      adapter.triggerTimeUpdate();
      expect(controller.isAtLiveEdge).toBe(true);

      // Another segment step: end 226, currentTime 205 → offset -21. Still inside the 30s exit
      // band, so it stays live (no flip to grey).
      adapter.setRange({ start: 0, end: 226 });
      adapter.setCurrentTime(205);
      adapter.triggerTimeUpdate();
      expect(controller.isAtLiveEdge).toBe(true);

      // Only a genuine large fall-behind (offset < -(tolerance + hysteresis)) exits the edge.
      adapter.setCurrentTime(180); // end 226 → offset -46
      adapter.triggerTimeUpdate();
      expect(controller.isAtLiveEdge).toBe(false);

      controller.destroy();
    });
  });

  describe('seekToLive()', () => {
    it('seeks a live-latency margin behind the seekable end (end - 3) so it stays at the edge', () => {
      const adapter = createMockAdapter({ start: 0, end: 200, currentTime: 100 });
      const controller = new LiveDVRController(adapter);

      controller.seekToLive();
      // Lands at end - LIVE_EDGE_SEEK_MARGIN (200 - 3 = 197): enough headroom that the advancing
      // live window doesn't immediately drift the offset past the edge (and no `ended` on VOD).
      expect(adapter.seekTo).toHaveBeenCalledWith(197);

      controller.destroy();
    });

    it('clamps to start when the window is smaller than the seek margin', () => {
      const adapter = createMockAdapter({ start: 100, end: 100.5, currentTime: 100 });
      const controller = new LiveDVRController(adapter);

      controller.seekToLive();
      // Math.max(start, end - 3) = Math.max(100, 97.5) = 100.
      expect(adapter.seekTo).toHaveBeenCalledWith(100);

      controller.destroy();
    });

    it('does nothing after destroy', () => {
      const adapter = createMockAdapter({ start: 0, end: 200, currentTime: 100 });
      const controller = new LiveDVRController(adapter);
      controller.destroy();

      controller.seekToLive();
      expect(adapter.seekTo).not.toHaveBeenCalled();
    });
  });

  describe('seekToDVRPosition()', () => {
    it('converts slider position to absolute time and seeks', () => {
      const adapter = createMockAdapter({ start: 100, end: 200, currentTime: 150 });
      const controller = new LiveDVRController(adapter);

      // Slider position 30 → absolute time 100 + 30 = 130 (below the go-live cap of 197).
      controller.seekToDVRPosition(30);
      expect(adapter.seekTo).toHaveBeenCalledWith(130);

      controller.destroy();
    });

    it('caps a seek to the very end of the window at the go-live target (end - 3, never ended)', () => {
      const adapter = createMockAdapter({ start: 100, end: 200, currentTime: 150 });
      const controller = new LiveDVRController(adapter);

      // Slider position 100 → absolute 200, capped at the live target end - 3 = 197.
      controller.seekToDVRPosition(100);
      expect(adapter.seekTo).toHaveBeenCalledWith(197);

      controller.destroy();
    });

    it('does nothing when there is no usable DVR window', () => {
      const adapter = createMockAdapter();
      const controller = new LiveDVRController(adapter);

      controller.seekToDVRPosition(50);
      expect(adapter.seekTo).not.toHaveBeenCalled();

      controller.destroy();
    });
  });

  describe('dvrStateChange event', () => {
    it('emits on initial computation', () => {
      const handler = jest.fn();
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 50 });
      const controller = new LiveDVRController(adapter);
      // The initial _update fires in constructor — subscribe after to test triggerTimeUpdate
      controller.on('dvrStateChange', handler);

      adapter.setCurrentTime(60);
      adapter.triggerTimeUpdate();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        hasDVR: true,
        sliderPosition: 60,
      }));

      controller.destroy();
    });

    it('emits a no-DVR state (hasDVR false) when the range disappears', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 50 });
      const controller = new LiveDVRController(adapter);
      const handler = jest.fn();
      controller.on('dvrStateChange', handler);

      adapter.setRange(null);
      adapter.triggerTimeUpdate();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ hasDVR: false }));

      controller.destroy();
    });
  });

  describe('destroy()', () => {
    it('unsubscribes from adapter time updates', () => {
      const adapter = createMockAdapter({ start: 0, end: 100, currentTime: 50 });
      const controller = new LiveDVRController(adapter);
      const handler = jest.fn();
      controller.on('dvrStateChange', handler);

      controller.destroy();

      adapter.setCurrentTime(60);
      adapter.triggerTimeUpdate();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
