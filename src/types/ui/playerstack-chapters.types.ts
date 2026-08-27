/**
 * Types for the `playerstack-chapters` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the chapter-input shape stay documented in one place so the element and any
 * future tests share a single source of truth. The chapter shapes are reused from the shared
 * chapter types (Req 1.6) so the element never redefines the chapter model.
 */
import type { ChapterInput } from '@typings/chapters.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-chapters` so Skins can style the chapters
 * container and its current-chapter title region through the shadow boundary (Req 5.1, 5.3):
 *   - `chapters` is the container; it carries the reflected `data-active` state when a chapter
 *     is current.
 *   - `chapter-title` is the region that receives the active chapter title on every store
 *     change.
 */
export type ChaptersPart = 'chapters' | 'chapter-title';

/**
 * Chapter input the consumer/adapter supplies. Raw chapter markers (`title` + `startTime`)
 * that the element turns into computed segments via `computeChapterSegments` (Req 1.6). The
 * segments themselves are derived internally, so consumers pass only the raw markers.
 */
export type ChaptersInput = ChapterInput[];
