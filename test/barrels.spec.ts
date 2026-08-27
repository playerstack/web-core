/**
 * Barrel smoke tests for the public subpath entrypoints (Req 1.1, 8.1, 11.1).
 *
 * The `./ui`, `./styles` and `./adapters/framework` subpaths are re-export barrels.
 * These tests import each barrel and assert every re-exported VALUE binding is present
 * and of the expected kind, so the public surface a consumer resolves is covered and
 * guarded against accidental removal/rename. Type-only re-exports are erased at runtime
 * and therefore aren't (and can't be) asserted here.
 */
import * as ui from '@ui/index';
import * as styles from '@styles/index';
import * as adapters from '@adapters/index';

describe('@playerstack/core/ui barrel', () => {
  it('re-exports the base element, registration and request/response core as callables', () => {
    expect(typeof ui.PlayerstackElement).toBe('function');
    expect(typeof ui.registerPlayerstackElements).toBe('function');
    expect(typeof ui.MediaController).toBe('function');
    expect(typeof ui.createMediaStore).toBe('function');
    expect(typeof ui.provideMediaContext).toBe('function');
    expect(typeof ui.requestMediaContext).toBe('function');
    expect(typeof ui.MEDIA_CONTEXT_EVENT).toBe('string');
  });

  it('re-exports the pure UI helpers and the element definition table', () => {
    expect(typeof ui.propToAttribute).toBe('function');
    expect(typeof ui.attributeToProp).toBe('function');
    expect(typeof ui.assertPlayerAdapter).toBe('function');
    expect(typeof ui.renderSvgFromDescriptor).toBe('function');
    expect(Array.isArray(ui.PLAYERSTACK_ELEMENTS)).toBe(true);
    expect(ui.PLAYERSTACK_ELEMENTS.length).toBeGreaterThan(0);
  });

  it('re-exports every playerstack-* UI_Element class', () => {
    const elementCtors = [
      ui.PlayerstackMediaController,
      ui.PlayerstackPlayButton,
      ui.PlayerstackVolume,
      ui.PlayerstackTimeSlider,
      ui.PlayerstackPlayTime,
      ui.PlayerstackSettings,
      ui.PlayerstackFullscreenButton,
      ui.PlayerstackPipButton,
      ui.PlayerstackCaptions,
      ui.PlayerstackChapters,
      ui.PlayerstackHeatmap,
      ui.PlayerstackContextMenu,
      ui.PlayerstackSpinner,
      ui.PlayerstackPlayState,
      ui.PlayerstackTopState,
      ui.PlayerstackPreventedTip,
      ui.PlayerstackAudioControls,
      ui.PlayerstackAdOverlay,
      ui.PlayerstackLiveIndicator,
      ui.PlayerstackDoubleTap,
      ui.PlayerstackIcon,
      ui.PlayerstackNavButtons,
    ];
    elementCtors.forEach((ctor) => expect(typeof ctor).toBe('function'));
  });
});

describe('@playerstack/core/styles barrel', () => {
  it('re-exports the design tokens and the pure token/state helpers', () => {
    expect(styles.DESIGN_TOKENS).toBeDefined();
    expect(typeof styles.tokenToCssVarName).toBe('function');
    expect(typeof styles.cssVarNameToTokenId).toBe('function');
    expect(typeof styles.compileTokensToCss).toBe('function');
    expect(typeof styles.reflectStateToAttributes).toBe('function');
    expect(typeof styles.readStateFromAttributes).toBe('function');
  });

  it('re-exports the Style_Auto_Injection API', () => {
    expect(typeof styles.ensurePlayerstackStyles).toBe('function');
    expect(typeof styles.ensureGlobalTokens).toBe('function');
  });
});

describe('@playerstack/core/adapters/framework barrel', () => {
  it('re-exports the DOM framework adapter and the UI element binding table', () => {
    expect(adapters.domFrameworkAdapter).toBeDefined();
    expect(typeof adapters.domFrameworkAdapter.syncAttribute).toBe('function');
    expect(typeof adapters.domFrameworkAdapter.syncProperty).toBe('function');
    expect(typeof adapters.domFrameworkAdapter.subscribe).toBe('function');
    expect(Array.isArray(adapters.UI_ELEMENT_BINDINGS)).toBe(true);
    expect(adapters.UI_ELEMENT_BINDINGS.length).toBeGreaterThan(0);
  });
});
