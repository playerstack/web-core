import { computeLiveDVRState, sliderPositionToTime, formatLiveOffset, stabilizeLiveOffset } from '@live-dvr';

function createMockElement(seekableRanges: [number, number][], currentTime: number): HTMLMediaElement {
  const seekable = {
    length: seekableRanges.length,
    start: (i: number) => seekableRanges[i][0],
    end: (i: number) => seekableRanges[i][1],
  };
  return { seekable, currentTime } as unknown as HTMLMediaElement;
}

describe('computeLiveDVRState', () => {
  test('returns empty state when element is null', () => {
    const state = computeLiveDVRState(null);
    expect(state.hasDVR).toBe(false);
    expect(state.isAtLiveEdge).toBe(true);
  });

  test('returns empty state when seekable has no ranges', () => {
    const el = createMockElement([], 0);
    const state = computeLiveDVRState(el);
    expect(state.hasDVR).toBe(false);
  });

  test('returns hasDVR=false when seekable window is too small', () => {
    // 10s window, default minDVRWindow is 15
    const el = createMockElement([[100, 110]], 110);
    const state = computeLiveDVRState(el);
    expect(state.hasDVR).toBe(false);
    expect(state.seekableStart).toBe(100);
    expect(state.seekableEnd).toBe(110);
  });

  test('returns hasDVR=true when seekable window is large enough', () => {
    // 120s window (2 min DVR)
    const el = createMockElement([[500, 620]], 620);
    const state = computeLiveDVRState(el);
    expect(state.hasDVR).toBe(true);
    expect(state.seekableWindow).toBe(120);
  });

  test('detects at live edge when currentTime is near seekableEnd', () => {
    const el = createMockElement([[100, 200]], 195); // 5s behind end, tolerance is 10
    const state = computeLiveDVRState(el);
    expect(state.isAtLiveEdge).toBe(true);
  });

  test('detects NOT at live edge when currentTime is far behind', () => {
    const el = createMockElement([[100, 200]], 150); // 50s behind end
    const state = computeLiveDVRState(el);
    expect(state.isAtLiveEdge).toBe(false);
  });

  test('computes correct liveEdgeOffset', () => {
    const el = createMockElement([[100, 200]], 150);
    const state = computeLiveDVRState(el);
    expect(state.liveEdgeOffset).toBe(-50); // 50s behind
  });

  test('computes correct slider position and duration', () => {
    const el = createMockElement([[100, 200]], 150);
    const state = computeLiveDVRState(el);
    expect(state.sliderDuration).toBe(100); // seekable window
    expect(state.sliderPosition).toBe(50); // 150 - 100
  });

  test('slider position is clamped to 0 when before seekable start', () => {
    const el = createMockElement([[100, 200]], 80);
    const state = computeLiveDVRState(el);
    expect(state.sliderPosition).toBe(0);
  });

  test('respects custom config', () => {
    const el = createMockElement([[0, 12]], 10);
    // Default would say hasDVR=false (window=12 < 15), custom minDVRWindow=10
    const state = computeLiveDVRState(el, { minDVRWindow: 10, liveEdgeTolerance: 5 });
    expect(state.hasDVR).toBe(true);
    expect(state.isAtLiveEdge).toBe(true); // 10 >= 12-5
  });

  test('uses last seekable range when multiple exist', () => {
    const el = createMockElement([[0, 50], [100, 250]], 200);
    const state = computeLiveDVRState(el);
    expect(state.seekableStart).toBe(100);
    expect(state.seekableEnd).toBe(250);
    expect(state.seekableWindow).toBe(150);
    expect(state.sliderPosition).toBe(100); // 200 - 100
  });
});

describe('stabilizeLiveOffset', () => {
  test('returns the raw offset on the first reading (no previous)', () => {
    expect(stabilizeLiveOffset(-61.3, 0)).toBe(-61.3);
  });

  test('holds the previous offset when the change is within the segment step', () => {
    // -60.3 vs previous -61.3 differs by 1.0 (< default step 2) -> hold previous.
    expect(stabilizeLiveOffset(-60.3, -61.3)).toBe(-61.3);
  });

  test('updates when the offset moves more than the step (a real seek/drift)', () => {
    expect(stabilizeLiveOffset(-206.7, -61.3)).toBe(-206.7);
  });

  test('respects a custom step', () => {
    expect(stabilizeLiveOffset(-64, -61, 5)).toBe(-61); // |−64−(−61)|=3 < 5 -> hold
    expect(stabilizeLiveOffset(-67, -61, 5)).toBe(-67); // 6 > 5 -> update
  });
});

describe('sliderPositionToTime', () => {
  test('converts slider position to absolute time', () => {
    expect(sliderPositionToTime(50, 100)).toBe(150);
  });

  test('position 0 returns seekableStart', () => {
    expect(sliderPositionToTime(0, 500)).toBe(500);
  });
});

describe('formatLiveOffset', () => {
  test('returns empty string when at live edge', () => {
    expect(formatLiveOffset(0, true)).toBe('');
    expect(formatLiveOffset(-5, true)).toBe('');
  });

  test('formats seconds-only offset', () => {
    expect(formatLiveOffset(-45, false)).toBe('-0:45');
  });

  test('formats minutes and seconds', () => {
    expect(formatLiveOffset(-125, false)).toBe('-2:05');
  });

  test('formats hours, minutes, and seconds', () => {
    expect(formatLiveOffset(-4806, false)).toBe('-1:20:06');
  });

  test('handles positive offset (ahead, unlikely but safe)', () => {
    expect(formatLiveOffset(10, false)).toBe('-0:10');
  });
});
