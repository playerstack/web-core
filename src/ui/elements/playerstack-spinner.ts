/**
 * `playerstack-spinner` — the loading/buffering overlay (Req 1.4, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it only reflects state: it consumes the shared store and never
 * touches the media element or dispatches requests. On every store change it mirrors the
 * loading and buffering flags to `data-loading`/`data-buffering` on the host (Req 3.3) so the
 * Style_Layer can drive the overlay through its attribute selectors.
 *
 * WHY also reflect `data-active` and toggle inline display: the shared Style_Layer's
 * spinner-visibility selector lives on the media-controller host, not on this element's host.
 * Reflecting a single `data-active` (loading OR buffering) and toggling this element's own
 * display keeps the spinner robust and self-contained regardless of where it is mounted —
 * it shows while loading/buffering and hides otherwise without depending on ancestor CSS.
 */
import type { SpinnerPart } from '@typings/ui/playerstack-spinner.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';

export class PlayerstackSpinner extends PlayerstackElement {
  /** The rendered overlay container; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /**
   * Reflects the loading/buffering flags to `data-*` on the host (Req 3.3) and toggles the
   * overlay's own visibility from a derived `data-active` (loading OR buffering). Only the two
   * fields this element cares about are read, per the base class's opt-in `onStoreChange`
   * design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    const active = state.isLoading || state.isBuffering;
    this.reflectState({
      loading: state.isLoading,
      buffering: state.isBuffering,
      active,
    });
    this.updateVisibility(active);
  }

  /**
   * Shows the overlay while loading/buffering and hides it otherwise. Guards for the
   * pre-render window: if called before `render` created the container the toggle is skipped
   * and `render` applies the latest state on connect.
   */
  private updateVisibility(active: boolean): void {
    if (this.container === null) {
      return;
    }
    this.container.style.display = active ? 'flex' : 'none';
  }

  /**
   * Builds the Markup_Contract: a `part="spinner"` overlay container holding a
   * `part="spinner-indicator"` glyph the Style_Layer animates. Nodes are created and APPENDED
   * (never via `innerHTML`) so the adopted Style_Layer — in the fallback path an injected
   * `<style>` — is preserved. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const containerPart: SpinnerPart = 'spinner';
    const container = document.createElement('div');
    container.setAttribute('part', containerPart);

    const indicatorPart: SpinnerPart = 'spinner-indicator';
    const indicator = document.createElement('span');
    indicator.setAttribute('part', indicatorPart);
    // Class name matches the shared icon convention so the Style_Layer can spin the glyph.
    indicator.className = 'icon icon-spinner';

    container.appendChild(indicator);

    this.container = container;
    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Apply from whatever state the store has already delivered (if the context resolved
    // before render ran). Default hidden until the store reports loading/buffering.
    const state = this.store?.getState();
    const active = state !== undefined ? state.isLoading || state.isBuffering : false;
    this.updateVisibility(active);
  }
}
