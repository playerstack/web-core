/**
 * `MediaController` is the single point that knows about the `PlayerAdapter` and
 * the `PlayerOrchestrator` (Req 2.2). It wires the request/response model:
 *
 * - Request events dispatched by interactive UI_Elements on `rootTarget` are
 *   routed to the corresponding `PlayerAdapter` method (Req 2.1, 2.2). The
 *   UI_Elements never touch the media element directly — they only express
 *   intent, and this controller translates that intent into adapter calls.
 * - Playback events emitted by the `PlayerOrchestrator` are mirrored into the
 *   reactive `MediaStore` (Req 2.3), so state flows back to subscribed
 *   UI_Elements which reflect it as `data-*` attributes.
 *
 * The constructor asserts the adapter's conformance FIRST (Req 2.5): a
 * non-conformant adapter throws before any listener is wired, so the controller
 * never ends up half-initialized.
 */
import type {
  MediaControllerConfig,
  RequestEventName,
  SeekRequestDetail,
  VolumeRequestDetail,
  RateRequestDetail,
  LoadRequestDetail,
  OrchestratorEventTarget,
} from '@typings/ui/media-controller.types';
import type { PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';
import { assertPlayerAdapter } from '@ui/adapter-conformance';

export class MediaController {
  private readonly config: MediaControllerConfig;

  /**
   * Request-event listeners keyed by event name, kept so `destroy` can remove
   * exactly what was added on `rootTarget`.
   */
  private readonly requestListeners = new Map<RequestEventName, EventListener>();

  /**
   * Orchestrator listeners kept as discriminated `[event, handler]` pairs so
   * `destroy` can `off(...)` each subscription it registered with exact typing.
   */
  private readonly orchestratorListeners: Array<
    { [K in keyof PlayerOrchestratorEvents]: [K, PlayerOrchestratorEvents[K]] }[keyof PlayerOrchestratorEvents]
  > = [];

  constructor(config: MediaControllerConfig) {
    // Req 2.5: validate the adapter BEFORE wiring anything. A non-conformant
    // adapter must fail loudly at construction rather than at the first request.
    assertPlayerAdapter(config.adapter);

    this.config = config;
    this.wireRequestEvents();
    this.wireOrchestratorEvents();
  }

  /**
   * Registers one delegated listener per request event on `rootTarget`, routing
   * each intent to the matching `PlayerAdapter` method (Req 2.1, 2.2). Malformed
   * events with a missing/typeless `detail` are ignored or fall back to defaults
   * rather than throwing, so a stray dispatch can never break the controller.
   */
  private wireRequestEvents(): void {
    const { adapter, rootTarget } = this.config;

    const handlers: { [K in RequestEventName]: (event: Event) => void } = {
      'playerstack-play-request': () => adapter.play(),
      'playerstack-pause-request': () => adapter.pause(),
      'playerstack-seek-request': (event) => {
        const detail = (event as CustomEvent<SeekRequestDetail>).detail;
        // Ignore seeks without a usable numeric time.
        if (!detail || typeof detail.time !== 'number') return;
        adapter.seekTo(detail.time, detail.keepPlaying);
      },
      'playerstack-volume-request': (event) => {
        const detail = (event as CustomEvent<VolumeRequestDetail>).detail;
        if (!detail || typeof detail.volume !== 'number') return;
        adapter.setVolume(detail.volume);
      },
      'playerstack-mute-request': () => adapter.mute(),
      'playerstack-unmute-request': () => adapter.unmute(),
      'playerstack-rate-request': (event) => {
        const detail = (event as CustomEvent<RateRequestDetail>).detail;
        if (!detail || typeof detail.rate !== 'number') return;
        adapter.setPlaybackRate(detail.rate);
      },
      'playerstack-load-request': (event) => {
        const detail = (event as CustomEvent<LoadRequestDetail>).detail;
        if (!detail || typeof detail.url !== 'string') return;
        adapter.load(detail.url, detail.isReady);
      },
    };

    (Object.keys(handlers) as RequestEventName[]).forEach((name) => {
      const listener = handlers[name] as EventListener;
      this.requestListeners.set(name, listener);
      rootTarget.addEventListener(name, listener);
    });
  }

  /**
   * Subscribes to the orchestrator's `EventEmitter` and mirrors each playback
   * event into the reactive `MediaStore` (Req 2.3). The `PlayerState` fields are
   * mapped from the orchestrator payloads; `playedSeconds` maps to `seek` since
   * `PlayerState` tracks the current position under that field.
   */
  private wireOrchestratorEvents(): void {
    const { store } = this.config;

    this.subscribe('progress', (data) => {
      store.set({
        played: data.played,
        loaded: data.loaded,
        seek: data.playedSeconds,
        bufferedRanges: data.bufferedRanges,
      });
    });
    this.subscribe('duration', (duration) => store.set({ duration }));
    this.subscribe('ready', () => store.set({ isLoading: false }));
    this.subscribe('play', () => store.set({ playing: true, isEnded: false }));
    this.subscribe('pause', () => store.set({ playing: false }));
    this.subscribe('ended', () => store.set({ isEnded: true, playing: false }));
    this.subscribe('error', (error) => store.set({ kernelError: error }));
    this.subscribe('seek', (time) => store.set({ seek: time }));
    this.subscribe('loading', (isLoading) => store.set({ isLoading }));
    // `liveEnded` has no dedicated PlayerState field; subscribe as a no-op so the
    // wiring stays complete and can gain behavior later without changing cleanup.
    this.subscribe('liveEnded', () => {
      /* no-op: no PlayerState field to update on live→VOD transition */
    });
  }

  /**
   * Registers an orchestrator subscription and records the `[event, handler]`
   * pair so `destroy` can remove it with `orchestrator.off(...)`.
   */
  private subscribe<K extends keyof PlayerOrchestratorEvents>(event: K, handler: PlayerOrchestratorEvents[K]): void {
    // Subscribe through the narrow `OrchestratorEventTarget` view so the handler
    // keeps its exact per-event typing (see the interface's rationale).
    (this.config.orchestrator as OrchestratorEventTarget).on(event, handler);
    // `[event, handler]` is a correlated `[K, handler-for-K]` pair; store it in
    // the discriminated-union array (the widened generic tuple needs the cast).
    this.orchestratorListeners.push([event, handler] as (typeof this.orchestratorListeners)[number]);
  }

  /**
   * Removes every request listener from `rootTarget`, unsubscribes every
   * orchestrator listener, and destroys the orchestrator so the controller
   * leaves no dangling subscriptions or timers behind.
   */
  destroy(): void {
    const { rootTarget, orchestrator } = this.config;

    this.requestListeners.forEach((listener, name) => {
      rootTarget.removeEventListener(name, listener);
    });
    this.requestListeners.clear();

    const target = orchestrator as OrchestratorEventTarget;
    this.orchestratorListeners.forEach((pair) => {
      // Unsubscribe via a generic helper so the `[event, handler]` correlation
      // survives (destructuring a discriminated-union tuple would lose it).
      this.unsubscribe(target, pair);
    });
    this.orchestratorListeners.length = 0;

    orchestrator.destroy();
  }

  /**
   * Removes a single orchestrator subscription. The `K` generic ties `event` and
   * `handler` together so `off` type-checks even though the stored pairs are a
   * discriminated union of every event/handler combination.
   */
  private unsubscribe<K extends keyof PlayerOrchestratorEvents>(
    target: OrchestratorEventTarget,
    [event, handler]: [K, PlayerOrchestratorEvents[K]],
  ): void {
    target.off(event, handler);
  }
}
