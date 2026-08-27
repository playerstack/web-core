/**
 * `playerstack-media-controller` — the ROOT host Custom Element of a Playerstack player
 * (Req 1.1, 5.1, 5.3). It is the single element a consumer places at the top of the tree;
 * every other `playerstack-*` element composes inside it as a real light-DOM child.
 *
 * Responsibilities of the root host:
 *   - Own the shared reactive `MediaStore` and PROVIDE it as the media context so every
 *     descendant resolves the same store WITHOUT holding a direct reference (Req 2.2, 2.3).
 *   - Inject the global `:root { --playerstack-* }` Design_Tokens exactly once per document
 *     via `ensureGlobalTokens` (Req 3.10) so tokens are available document-wide.
 *   - Act as the positioned STAGE for its composed `playerstack-*` children (Req 5.1, 5.3):
 *     the light-DOM children are laid out directly against the controller by the Style_Layer
 *     (controller tag + element-child selectors), so the controller does NOT inject a
 *     competing `[part="root"]` wrapper or a `<slot>` around them.
 *   - Optionally host a `MediaController` (adapter + orchestrator wiring) attached later by
 *     the Vanilla_Build / framework adapter layer (Req 1.6, 2.2, 2.3); it stays optional so
 *     the element works standalone (e.g. in tests) with only the store + context.
 *
 * WHY it overrides `connectedCallback`: unlike leaf UI_Elements (which only CONSUME the
 * context), the root host must CREATE and PROVIDE the store before descendants request it.
 * The store is created and provided first, then `ensureGlobalTokens` runs, then
 * `super.connectedCallback()` ensures the global Style_Layer + renders. `super`'s own
 * `requestMediaContext` finds no ancestor provider (this IS the provider) and is harmless.
 */
import type { AttachControllerParams } from '@typings/ui/playerstack-media-controller.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { createMediaStore } from '@ui/media-store';
import { provideMediaContext } from '@ui/media-context';
import { MediaController } from '@ui/media-controller';
import { TooltipManager } from '@ui/tooltip-manager';
import { ensureGlobalTokens } from '@styles/style-injector';

export class PlayerstackMediaController extends PlayerstackElement {
  /**
   * The shared reactive store this host owns and provides to descendants. Created lazily on
   * first connect and reused across reconnects so the context identity stays stable.
   */
  private mediaStore = createMediaStore();

  /**
   * The optional controller wiring adapter + orchestrator into the store. `null` until
   * `attachController` is called by the adapter layer; destroyed on disconnect.
   */
  private controller: MediaController | null = null;

  /**
   * The control-button tooltip manager (framework-agnostic recreation of the original
   * `Tooltip`). Attached on connect, destroyed on disconnect. Scoped to THIS host so the
   * tooltip clamps within the player box and only reacts to this player's control buttons.
   */
  private tooltipManager: TooltipManager | null = null;

  /**
   * Creates + provides the media context, injects the global tokens, then defers to the
   * base class to ensure the global Style_Layer and render. Ordering matters: provide
   * BEFORE `super` so a descendant added in the same tick resolves the context.
   */
  override connectedCallback(): void {
    // Provide the shared context first so descendants that request it resolve immediately.
    const unprovide = provideMediaContext(this, { store: this.mediaStore });
    this.addDisposer(unprovide);

    // Req 3.10: inject the global `:root` tokens exactly once per document (idempotent).
    ensureGlobalTokens();

    // Attach the control-button tooltip manager (hover label + clamping + menu/click suppress).
    if (this.tooltipManager === null) {
      this.tooltipManager = new TooltipManager({ host: this });
    }

    // Base class: ensure the global Style_Layer is present, (harmlessly) request context,
    // and invoke `render`.
    super.connectedCallback();
  }

  /**
   * Destroys the hosted controller (if any) before running the base class teardown so no
   * request/orchestrator listeners or timers leak, then defers to `super` to run disposers.
   */
  override disconnectedCallback(): void {
    if (this.controller !== null) {
      this.controller.destroy();
      this.controller = null;
    }
    if (this.tooltipManager !== null) {
      this.tooltipManager.destroy();
      this.tooltipManager = null;
    }
    super.disconnectedCallback();
  }

  /**
   * Attaches a `MediaController` that wires `adapter` (request events → media I/O) and
   * `orchestrator` (playback events → store) to THIS host's store and root target
   * (Req 1.6, 2.2, 2.3). Optional and defensive: destroys any previously attached
   * controller first so repeated attaches never leak listeners.
   */
  attachController({ adapter, orchestrator }: AttachControllerParams): void {
    if (this.controller !== null) {
      this.controller.destroy();
    }
    this.controller = new MediaController({
      adapter,
      store: this.mediaStore,
      rootTarget: this,
      orchestrator,
    });
  }

  /**
   * The shared reactive store this host provides. Read-only accessor so the adapter layer
   * (or tests) can observe the exact store descendants subscribe to.
   */
  get store(): ReturnType<typeof createMediaStore> {
    return this.mediaStore;
  }

  /**
   * Reflects the CONTROLLER-SCOPED presentation state to `data-*` on the root host so the
   * Style_Layer's `playerstack-media-controller[data-*] ...` selectors resolve (Req 3.3).
   *
   * WHY the controller (not a leaf element) reflects `fullscreen`: the ported skin CSS scales
   * the whole chrome from fullscreen — control-bar height 36px→54px, buttons 36→54, the volume
   * reveal width, the time-slider rail/handle sizes and the slider/menu offsets all key off
   * `playerstack-media-controller[data-fullscreen]` (mirroring the original `isFullscreen`
   * interpolation, which was threaded from the player root down to every styled block). The
   * fullscreen button already reflects `data-fullscreen` on ITS OWN host for its enter/exit
   * glyph, but the stage-wide sizing needs the flag on the stage host — so the controller
   * mirrors `isFullScreen` here. `null` removes the attribute when not fullscreen so the CSS
   * uses attribute PRESENCE (`[data-fullscreen]`) exactly like the original boolean gate.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    // `timeSliding` mirrors the original reactjs `timeSliding` UI flag that was threaded from
    // the player root into the TimeSlider / TimeTooltip / handle blocks (`isSliding`). The
    // closest store-derived boolean is `state.seeking` (true while the user is actively
    // scrubbing), so we reflect it as `data-time-sliding` on the stage host. This keeps the
    // reflection AGNOSTIC (a plain boolean derived from store state, no adapter/DOM coupling)
    // and lets the Style_Layer keep the slider rail thick, the handle popped and the time
    // tooltip visible WHILE dragging on touch, exactly like the original — the hover/focus
    // paths already cover pointer devices. `null` removes the attribute so the CSS keys off
    // attribute PRESENCE just like the original boolean gate.
    //
    // NOTE on `volume-sliding` / `ad-active`: the shared store has no boolean for either
    // (volume drag is a transient UI-only state and ads are owned by `playerstack-ad-overlay`,
    // which reflects `data-active` on ITS OWN host). We therefore do NOT fabricate controller
    // reflections for those — the volume reveal is driven by `:hover` and the ad-mode slider
    // styling keys off the ad-overlay host — keeping the controller free of state it cannot
    // derive from the store.
    // `loading`/`buffering` mirror the store's `isLoading`/`isBuffering` onto the stage host so
    // the Style_Layer can gate STAGE-WIDE loading affordances that a single element cannot own.
    // Concretely (parity with the original mobile MobileCenterControls, which rendered a spinner
    // IN PLACE OF the center play/pause button via `isLoading ? <Spinner/> : <PlayButton/>`): the
    // mobile center play-state button is hidden while `[data-loading]`/`[data-buffering]` is set
    // so the center spinner shows in its place instead of overlapping the glyph. Reflected as a
    // single derived `data-buffering` (loading OR buffering) plus the discrete `data-loading`, so
    // the CSS can key off either; `null` removes them so the gate uses attribute PRESENCE.
    const isLoadingOrBuffering = state.isLoading || state.isBuffering;
    this.reflectState({
      fullscreen: state.isFullScreen ? true : null,
      timeSliding: state.seeking ? true : null,
      loading: state.isLoading ? true : null,
      buffering: isLoadingOrBuffering ? true : null,
      // `playing` is reflected on the STAGE host so the audio skin's `[data-playing]`-gated
      // reveals resolve: the prev/next nav cluster (StyledSkipButtonWrapper `$visible`) and the
      // paused-label↔timeline morph key off whether playback is active, exactly like the
      // original `isPlaying = !paused && !ended`. A single element cannot own this because the
      // affordances span the whole control row, so the controller mirrors the store's `playing`.
      // `null` removes the attribute so the CSS uses attribute PRESENCE like the original gate.
      playing: state.playing ? true : null,
    });
  }

  /**
   * The controller renders NO structural markup of its own (Req 5.1, 5.3). In the light-DOM
   * model the composed `playerstack-*` elements are ALREADY real children of the controller
   * (placed there by the framework skin / Vanilla_Build). The controller element itself IS
   * the positioned stage; the Style_Layer lays the children out directly against the
   * controller tag (stage + bottom control bar + absolutely-positioned overlays). Injecting
   * a `[part="root"]` wrapper or a `<slot>` here would duplicate/hide those children, so
   * `render` intentionally does nothing structural. Kept idempotent (a no-op) so reconnects
   * never touch the light-DOM children.
   */
  protected render(): void {
    // Intentionally empty: the controller is the stage; its light-DOM children are laid out
    // by the Style_Layer. No wrapper/slot is created so the children stay real descendants.
  }

  /**
   * Override: the controller is a CONTAINER — its children are composed by the framework
   * (React layout), not rendered by the element itself. Clearing them on disconnect would
   * destroy the React-managed subtree. Only the controller's OWN state (tooltipManager,
   * MediaController) is cleaned up in `disconnectedCallback` above.
   */
  protected override onDisconnect(): void {
    // No-op: do NOT clear children — they belong to the React layout.
  }
}
