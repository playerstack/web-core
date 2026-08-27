# @playerstack/web-core

[![npm version](https://img.shields.io/npm/v/@playerstack/web-core.svg)](https://www.npmjs.com/package/@playerstack/web-core)
[![Test Coverage](https://img.shields.io/codecov/c/github/playerstack/web-core.svg)](https://codecov.io/gh/playerstack/web-core)
[![License](https://img.shields.io/badge/license-PolyForm%20Shield%201.0.0-blue.svg)](./LICENSE.md)

Framework-agnostic media engine for video and audio playback. Supports HLS, DASH, FLV and native HTML5 media formats.

This package provides the core playback logic used by framework-specific wrappers like [`@playerstack/reactjs-video`](https://github.com/playerstack/reactjs-video).

## Installation

```bash
npm install @playerstack/web-core
```

## Quick Start

```ts
import { MediaEngine } from '@playerstack/web-core';

const video = document.querySelector('video')!;
const engine = new MediaEngine(video, {
  hlsVersion: '1.5.7',
});

engine.on('ready', () => {
  console.log('Media is ready to play');
  engine.play();
});

engine.on('timeUpdate', (currentTime) => {
  console.log(`Current time: ${currentTime}`);
});

engine.on('error', (err) => {
  console.error('Playback error:', err);
});

engine.load('https://example.com/video.m3u8');
```

## Subpath Exports

This package exposes granular subpath exports so consumers can import only what they need. This is especially important for React Native, where Metro does not tree-shake — native packages must import only DOM-free subpaths.

### React Native–safe subpaths (DOM-free)

These subpaths have zero browser global dependencies and are safe to use in React Native:

| Subpath | Description |
|---------|-------------|
| `@playerstack/web-core/hooks` | Shared React hooks (useChapters, useAutoHide, etc.) |
| `@playerstack/web-core/patterns` | `canPlay`, format extension regex |
| `@playerstack/web-core/chapters` | `computeChapterSegments`, `getChapterAtTime` |
| `@playerstack/web-core/heatmap` | `generateHeatmapPath` |
| `@playerstack/web-core/i18n` | `getTranslations`, locale data |
| `@playerstack/web-core/keyboard` | `eventsKeyCodes`, key mappings |
| `@playerstack/web-core/live-dvr` | `computeLiveDVRState`, `formatLiveOffset` |
| `@playerstack/web-core/slider` | `getTimeFromSliderPosition`, slider math |
| `@playerstack/web-core/player-state` | `playerStateInitial`, state reducers |
| `@playerstack/web-core/quality` | `getRecommendedVideoQuality` (pure function) |
| `@playerstack/web-core/reducer` | `createTypedReducer` factory |
| `@playerstack/web-core/ui` | `buildIconProps`, `settingsInitialState` |
| `@playerstack/web-core/adapters` | Platform adapter type definitions |
| `@playerstack/web-core/utils/format` | `formatTime`, `indexBy`, `omit` |
| `@playerstack/web-core/utils/env` | `isTestEnv`, `enableStubOn` |
| `@playerstack/web-core/utils/captions` | `parseVTTCaptions`, `getActiveCues`, `hexToRgba` |
| `@playerstack/web-core/utils/vtt-sprite` | `parseSpriteVTT`, `timeCodeToSeconds` |

### Web-only subpaths (require browser globals)

These subpaths use `window`, `document`, `navigator`, or load external scripts. Do **not** import them in React Native:

| Subpath | Reason |
|---------|--------|
| `@playerstack/web-core` (main) | Re-exports everything including DOM modules |
| `@playerstack/web-core/constants` | Evaluates `navigator`/`window` at load |
| `@playerstack/web-core/engine` | Full DOM dependency (`HTMLMediaElement`) |
| `@playerstack/web-core/utils/cookie` | Uses `document.cookie` |
| `@playerstack/web-core/utils/device` | Evaluates `window`/`navigator` at load |
| `@playerstack/web-core/utils/sdk` | Uses `window` + `load-script` |
| `@playerstack/web-core/utils/media` | Uses `window.MediaStream`, `document` |

### Usage examples

**Web packages** (backward compatible):
```ts
// Main entry still works for web
import { formatTime, IS_IOS, getSDK } from '@playerstack/web-core';

// Granular imports (better tree-shaking)
import { formatTime } from '@playerstack/web-core/utils/format';
import { IS_IOS } from '@playerstack/web-core/constants';
```

**React Native packages** (must use granular subpaths):
```ts
import { formatTime, indexBy } from '@playerstack/web-core/utils/format';
import { getTranslations } from '@playerstack/web-core/i18n';
import { computeChapterSegments } from '@playerstack/web-core/chapters';
import { useChapters, useAutoHide } from '@playerstack/web-core/hooks';
```

## Features

- **Framework-agnostic** — works with React, Vue, Svelte, Solid, Angular, vanilla JS, or any framework
- **Automatic SDK loading** — HLS.js, DASH.js, and FLV.js loaded on-demand from CDN
- **Typed events** — fully typed EventEmitter API
- **Unified playback API** — play, pause, seek, volume, PiP, playback rate
- **State snapshots** — get full media state at any time
- **Zero UI opinions** — bring your own player skin
- **Tree-shakeable** — only import what you need

## API

### `MediaEngine`

```ts
new MediaEngine(element: HTMLMediaElement, config?: MediaEngineConfig)
```

#### Methods

| Method | Description |
|--------|-------------|
| `load(url)` | Load a media source (auto-detects format) |
| `play()` | Start playback |
| `pause()` | Pause playback |
| `stop()` | Stop and unload media |
| `seekTo(seconds, keepPlaying?)` | Seek to a time position |
| `setVolume(fraction)` | Set volume (0–1) |
| `mute()` / `unmute()` | Mute/unmute |
| `setPlaybackRate(rate)` | Set playback speed |
| `setLoop(loop)` | Enable/disable looping |
| `enablePiP()` / `disablePiP()` | Picture-in-Picture |
| `getState()` | Get current media state snapshot |
| `getElement()` | Get the underlying HTMLMediaElement |
| `getHlsInstance()` | Get HLS.js instance (if active) |
| `getDashInstance()` | Get DASH.js instance (if active) |
| `destroy()` | Clean up all listeners and SDK instances |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | — | Media can begin playback |
| `play` | `{ hasAudio }` | Playback started |
| `pause` | — | Playback paused |
| `ended` | — | Playback ended |
| `buffer` | — | Buffering started |
| `bufferEnd` | — | Buffering ended |
| `seek` | `currentTime` | Seek completed |
| `error` | `error, data?, instance?, sdk?` | Error occurred |
| `playbackRateChange` | `rate` | Playback rate changed |
| `enablePiP` | — | Entered PiP mode |
| `disablePiP` | — | Exited PiP mode |
| `loaded` | — | SDK loaded and attached |
| `durationChange` | `duration` | Duration changed |
| `timeUpdate` | `currentTime` | Current time updated |
| `volumeChange` | `volume, muted` | Volume changed |
| `progress` | `loaded` | Buffer progress |

### Utilities

```ts
import { formatTime, canPlay, isDesktop, isMobile } from '@playerstack/web-core/utils';
```

### i18n

```ts
import { getTranslations } from '@playerstack/web-core/i18n';

const t = getTranslations('es');
console.log(t.play); // "Reproducir"
```

## Supported Formats

| Format | Extension | SDK |
|--------|-----------|-----|
| Native video | `.mp4`, `.webm`, `.ogg`, `.mov`, `.m4v` | HTML5 `<video>` |
| HLS | `.m3u8` | hls.js (loaded from CDN) |
| DASH | `.mpd` | dash.js (loaded from CDN) |
| FLV | `.flv` | flv.js (loaded from CDN) |
| MediaStream | — | Native |
| Blob URL | — | Native |

## Configuration

```ts
interface MediaEngineConfig {
  hlsVersion?: string;      // Default: '1.5.7'
  hlsOptions?: object;      // Passed to HLS.js constructor
  dashVersion?: string;     // Default: '4.7.4'
  flvVersion?: string;      // Default: '1.6.2'
  forceHLS?: boolean;       // Force HLS.js regardless of extension
  forceSafariHLS?: boolean; // Force HLS.js on Safari
  forceDisableHls?: boolean;// Disable HLS.js (use native)
  forceDASH?: boolean;      // Force DASH.js
  forceFLV?: boolean;       // Force FLV.js
}
```

## Usage with Frameworks

This package is consumed by framework-specific wrappers:

- [`@playerstack/reactjs-video`](https://github.com/playerstack/reactjs-video) — React wrapper

More wrappers coming: Vue, Svelte, Solid, React Native, etc.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

[PolyForm Shield 1.0.0](./LICENSE.md) © 2026 Oscar Garcés (PlayerStack)

Player Stack is **source-available**, not open source. You are free to use it — including commercially — and to fork, modify, and contribute. You may **not** use it to build or provide a product that competes with Player Stack. See [LICENSE.md](./LICENSE.md) for the full terms.
