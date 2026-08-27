/**
 * Types for the `playerstack-icon` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) stays documented in one place so the element and any future tests share a single
 * source of truth. The icon-descriptor shape (`IconDescriptor`) and the SVG sizing options
 * (`RenderSvgOptions`) are reused from the shared types (Req 1.4) so the element never
 * redefines the icon model or the serializer's option shape.
 */

/**
 * Named Shadow DOM `part` exposed by `playerstack-icon` so Skins can style the icon wrapper
 * (and reach the serialized `<svg>` through it) across the shadow boundary (Req 5.1, 5.3):
 *   - `icon` is the wrapper `<span>` whose `innerHTML` holds the serialized SVG string.
 */
export type IconPart = 'icon';
