import type { HeatmapDataPoint } from '@typings/heatmap.types';

export type { HeatmapDataPoint } from '@typings/heatmap.types';

/**
 * Generate a smooth SVG stroke path from heatmap (most replayed) data.
 * Uses Catmull-Rom to cubic Bézier conversion for smooth curves.
 * Pure function — no framework dependency.
 *
 * @param data - Array of heatmap data points (startTime, endTime, value 0-1)
 * @param duration - Total media duration in seconds
 * @returns SVG path string for the stroke, or empty string if insufficient data
 */
export function generateHeatmapPath(data: HeatmapDataPoint[] | null | undefined, duration: number): string {
  if (!data || data.length === 0 || duration <= 0) {
    return '';
  }

  const points = data.map((point) => {
    const midTime = (point.startTime + point.endTime) / 2;
    const x = (midTime / duration) * 100;
    const value = Math.max(0, Math.min(1, point.value));
    const y = 100 - value * 100;
    return { x, y };
  });

  if (points.length < 2) {
    return '';
  }

  // Catmull-Rom to cubic Bézier conversion
  // Higher tension = sharper peaks (more graph-like, less wavy)
  const tension = 6;

  // Virtual floor anchors at both ends
  const totalPoints = points.length + 2;
  const getPoint = (idx: number): { x: number; y: number } => {
    if (idx <= 0) return { x: 0, y: 100 };
    if (idx >= totalPoints - 1) return { x: 100, y: 100 };
    return points[idx - 1]!;
  };

  let path = `M ${getPoint(0).x},${getPoint(0).y}`;

  for (let i = 0; i < totalPoints - 1; i++) {
    const p0 = getPoint(i - 1);
    const p1 = getPoint(i);
    const p2 = getPoint(i + 1);
    const p3 = getPoint(i + 2);

    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}
