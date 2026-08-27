/**
 * Style_Auto_Injection — the concrete mechanism that makes every PlayerStack UI_Element
 * apply its Style_Layer automatically when it connects to the DOM, without the consumer
 * importing any CSS (Req 3.7-3.10).
 *
 * WHY a single GLOBAL head injection (no Shadow DOM)
 *   Every `playerstack-*` element now renders into its OWN light DOM instead of an
 *   attached shadow root, so there is no per-root stylesheet to adopt. The Style_Layer is
 *   therefore injected ONCE into `document.head` as a single `<style data-playerstack-styles>`
 *   element. N elements share the SAME global stylesheet — the injected CSS is never
 *   duplicated (Req 3.8, Property 6 / Req 20.6). Because there is no shadow boundary, the
 *   Design_Tokens are compiled against `:root` (not `:host`).
 *
 * WHY the injection is idempotent
 *   `ensurePlayerstackStyles` appends the `<style>` only when a marker element is not
 *   already present in `document.head`, and `ensureGlobalTokens` guards the global
 *   `:root` tokens block with its own marker, so N calls yield exactly one injection each.
 */
import { compileTokensToCss } from '@styles/token-css';
import { DESIGN_TOKENS } from '@styles/tokens';
import playerstackCssText from '@styles/playerstack.css';

/**
 * Marker attribute used to guard the single global Style_Layer `<style>` per document so
 * the full CSS is injected into `document.head` exactly once (Req 3.7, 3.8).
 */
const GLOBAL_STYLE_MARKER = 'data-playerstack-styles';

/**
 * Marker attribute used to guard the single global tokens `<style>` per document so the
 * `:root { --playerstack-* }` block is injected exactly once (Req 3.10).
 */
const GLOBAL_TOKENS_MARKER = 'data-playerstack-tokens';

/**
 * Builds the full Style_Layer text: the standard `playerstack.css` plus the Design_Tokens
 * compiled against `:root` so the `--playerstack-*` custom properties are available to the
 * whole document (Req 4.2). Kept as a helper so the injection and any test share exactly
 * the same text.
 */
function buildStyleLayerText(): string {
  return `${playerstackCssText}\n${compileTokensToCss(DESIGN_TOKENS, ':root')}`;
}

/**
 * Injects the full Style_Layer as a single guarded `<style data-playerstack-styles>`
 * element into `document.head` exactly once (Req 3.7, 3.8). The marker attribute keeps it
 * idempotent: a document that already carries the marker is left untouched, so N elements
 * connecting yield exactly ONE global injection (Property 6 / Req 20.6).
 *
 * `doc` defaults to the ambient `document`; it is a parameter so tests can pass a fake.
 */
export function ensurePlayerstackStyles(doc: Document = document): void {
  if (doc.querySelector(`style[${GLOBAL_STYLE_MARKER}]`) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(GLOBAL_STYLE_MARKER, '');
  style.textContent = buildStyleLayerText();
  (doc.head ?? doc.documentElement).appendChild(style);
}

/**
 * Injects the global `:root { --playerstack-* }` custom properties into a document
 * exactly once (Req 3.10). A guarded `<style data-playerstack-tokens>` element in the
 * document head acts as the marker, so N calls produce exactly ONE injection.
 *
 * `doc` defaults to the ambient `document`; it is a parameter so tests can pass a fake.
 */
export function ensureGlobalTokens(doc: Document = document): void {
  if (doc.querySelector(`style[${GLOBAL_TOKENS_MARKER}]`) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(GLOBAL_TOKENS_MARKER, '');
  style.textContent = compileTokensToCss(DESIGN_TOKENS, ':root');
  (doc.head ?? doc.documentElement).appendChild(style);
}
