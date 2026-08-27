/**
 * Vanilla_Build entry — a framework-agnostic way to mount a fully functional Playerstack
 * player using ONLY Core exports, with zero framework dependency (Req 6.1, 6.2).
 *
 * It re-exports `registerPlayerstackElements` (so a consumer can define the Custom Elements
 * ahead of time) and exposes `initPlayer`, which instantiates a `MediaEngine`, wraps it in a
 * `PlayerOrchestrator`, builds a `PlayerAdapter` that bridges request events to the engine /
 * orchestrator, and attaches a `MediaController` to a `playerstack-media-controller` host.
 *
 * WHY it lives in its own entry: this module is the standalone (IIFE/`globalName`) build's
 * source. Keeping it free of any framework import guarantees the produced bundle is usable
 * directly in a `<script>` tag or plain HTML without React/Vue/etc.
 */
import { registerPlayerstackElements } from '@ui/register';
import { MediaEngine } from '@media-engine';
import { PlayerOrchestrator } from '@player-orchestrator';
import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import type { PlayerAdapter } from '@typings/adapters.types';
import type { InitPlayerConfig, PlayerInstance } from '@typings/vanilla.types';

export { registerPlayerstackElements };
export type { InitPlayerConfig, PlayerInstance } from '@typings/vanilla.types';

/**
 * Mounts a functional Playerstack player into `container` using only Core (Req 6.1, 6.2).
 *
 * Steps:
 *   1. Ensure the Custom Elements are defined (idempotent — safe to call repeatedly).
 *   2. Create the native `HTMLMediaElement` (`<audio>` or `<video>`) the engine will drive.
 *   3. Build the `MediaEngine` + `PlayerOrchestrator` on top of that element.
 *   4. Build a `PlayerAdapter` that maps request-event intents to orchestrator/engine calls.
 *   5. Create the `playerstack-media-controller` host, wire the adapter + orchestrator into
 *      it via `attachController`, and append both the media element and host into `container`.
 *   6. Load `config.url` when provided, and return a `PlayerInstance` teardown handle.
 */
export function initPlayer(container: HTMLElement, config: InitPlayerConfig = {}): PlayerInstance {
  // 1. Idempotent registration so the host element resolves even if the consumer skipped it.
  registerPlayerstackElements();

  // 2. The engine needs a native media element; pick the tag from the config.
  const element = document.createElement(config.audio ? 'audio' : 'video') as HTMLMediaElement;

  // 3. Framework-agnostic playback stack: engine drives the element, orchestrator coordinates it.
  const engine = new MediaEngine(element, config.engine);
  const orchestrator = new PlayerOrchestrator(engine);

  // 4. Bridge the abstract request intents to concrete orchestrator/engine operations. The
  //    orchestrator owns playback state (play/pause/seek/volume), while read-only queries go
  //    straight to the engine. `getDuration` returns a `number` which satisfies `number | null`.
  const adapter: PlayerAdapter = {
    play: () => orchestrator.setPlaying(true),
    pause: () => orchestrator.setPlaying(false),
    stop: () => engine.stop(),
    load: (url: string) => orchestrator.load(url),
    seekTo: (seconds: number, keepPlaying?: boolean) => orchestrator.seekTo(seconds, keepPlaying),
    setVolume: (v: number) => orchestrator.setVolume(v),
    mute: () => orchestrator.setMuted(true),
    unmute: () => orchestrator.setMuted(false),
    setPlaybackRate: (rate: number) => orchestrator.setPlaybackRate(rate),
    getDuration: () => engine.getDuration(),
    getCurrentTime: () => engine.getCurrentTime(),
    getSecondsLoaded: () => engine.getSecondsLoaded(),
  };

  // 5. Mount the host and the media element, then wire the controller (request→adapter,
  //    orchestrator events→store) so descendant UI_Elements reflect real playback state.
  const controller = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  container.appendChild(element);
  container.appendChild(controller);
  controller.attachController({ adapter, orchestrator });

  // 6. Auto-load the initial source (if any) once the stack is wired.
  if (config.url) {
    adapter.load(config.url);
  }

  return {
    controller,
    element,
    destroy: () => {
      // Destroys the orchestrator (which also destroys the engine) and removes the created
      // DOM nodes so no listeners, timers or SDK instances leak after teardown.
      orchestrator.destroy();
      controller.remove();
      element.remove();
    },
  };
}
