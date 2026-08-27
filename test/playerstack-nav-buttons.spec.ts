import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-nav-buttons` — the previous/next navigation cluster UI_Element
 * (Req 2.1, 5.1, 5.2, 5.3, 21.1). It verifies:
 *  - Markup_Contract: the `part="nav-buttons"` container with a `part="prev-button"` and a
 *    `part="next-button"` `<button>`, each carrying its directional icon glyph and a
 *    configurable `aria-label` (defaults 'Previous' / 'Next').
 *  - request-event wiring: a click on prev emits `playerstack-prev-request` and a click on
 *    next emits `playerstack-next-request`, both bubbling + composed (Req 2.1).
 *
 * The element resolves the media context from an ancestor `playerstack-media-controller`, so
 * every test appends it as a light-DOM child of a connected controller. Registration goes
 * through `registerPlayerstackElements()` (idempotent).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a nav-buttons child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-nav-buttons');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-nav-buttons', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="nav-buttons" with prev/next buttons and their icon glyphs', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="nav-buttons"]')).not.toBeNull();

      const prev = root.querySelector('[part="prev-button"]');
      const next = root.querySelector('[part="next-button"]');
      expect(prev).not.toBeNull();
      expect(next).not.toBeNull();
      expect(prev?.getAttribute('type')).toBe('button');
      expect(next?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-prev')).not.toBeNull();
      expect(root.querySelector('.icon-next')).not.toBeNull();
    });

    it('applies the default accessible names when no labels are provided', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="prev-button"]')?.getAttribute('aria-label')).toBe('Previous');
      expect(root.querySelector('[part="next-button"]')?.getAttribute('aria-label')).toBe('Next');
    });

    it('uses the configured prev-label / next-label attributes for the accessible names', () => {
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      const el = document.createElement('playerstack-nav-buttons');
      el.setAttribute('prev-label', 'Anterior');
      el.setAttribute('next-label', 'Siguiente');
      host.appendChild(el);

      const root = el;
      expect(root.querySelector('[part="prev-button"]')?.getAttribute('aria-label')).toBe('Anterior');
      expect(root.querySelector('[part="next-button"]')?.getAttribute('aria-label')).toBe('Siguiente');
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-prev-request when the prev button is clicked', () => {
      const { el } = mount();

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-prev-request', (e) => received.push(e as CustomEvent));

      const prev = (el).querySelector('[part="prev-button"]') as HTMLButtonElement;
      prev.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.bubbles).toBe(true);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-next-request when the next button is clicked', () => {
      const { el } = mount();

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-next-request', (e) => received.push(e as CustomEvent));

      const next = (el).querySelector('[part="next-button"]') as HTMLButtonElement;
      next.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.bubbles).toBe(true);
      expect(received[0]?.composed).toBe(true);
    });
  });
});
