/**
 * Types for the `playerstack-heatmap` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the heatmap-input shape stay documented in one place so the element and any
 * future tests share a single source of truth. The data-point shape is reused from the shared
 * heatmap types (Req 1.6) so the element never redefines the heatmap model.
 */
import type { HeatmapDataPoint } from '@typings/heatmap.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-heatmap` so Skins can style the heatmap
 * container, its inline SVG, and the generated stroke path through the shadow boundary
 * (Req 5.1, 5.3):
 *   - `heatmap` is the container.
 *   - `heatmap-svg` is the inline `<svg>` whose `viewBox` matches the 0-100 coordinate space
 *     `generateHeatmapPath` emits.
 *   - `heatmap-path` is the `<path>` that receives the generated `d` attribute.
 */
export type HeatmapPart = 'heatmap' | 'heatmap-svg' | 'heatmap-path' | 'heatmap-path-played';

/**
 * Heatmap input the consumer/adapter supplies: the same "most replayed" data points that
 * `generateHeatmapPath` consumes (Req 1.6). The element pairs it with the store's `duration`
 * to compute the SVG stroke path, so consumers pass only the raw data points.
 */
export type HeatmapInput = HeatmapDataPoint[];
