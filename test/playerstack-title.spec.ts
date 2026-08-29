import { PlayerstackTitle } from '@ui/elements/playerstack-title';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-title` — the media-title read-out UI_Element (Req 10.1, 10.2, 10.3).
 *
 * As a display element it only reflects a consumer-provided string: it renders a single
 * `part="title"` node and writes the value of the `title` attribute into that node's
 * `textContent`. It never reads the store or resolves a media context, so — unlike sibling
 * display elements — it does not need a `playerstack-media-controller` ancestor and is mounted
 * directly in the light DOM.
 *
 * The suite verifies: the Custom Element registers under its tag (Req 10.1), the Markup_Contract
 * `part="title"` node is present after connect (Req 10.2), and the title text reflects the
 * `title` attribute — setting it paints the text, changing it repaints, and removing it decodes
 * to `''` and clears the read-out (Req 10.2, 10.3).
 */
registerPlayerstackElements();

/** Creates a `playerstack-title`, optionally seeds its `title` attribute, and connects it. */
function mount(title?: string): PlayerstackTitle {
  const el = document.createElement('playerstack-title') as PlayerstackTitle;
  if (title !== undefined) {
    el.setAttribute('title', title);
  }
  document.body.appendChild(el);
  return el;
}

describe('playerstack-title', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('registration (Req 10.1)', () => {
    it('defines the custom element under its playerstack-title tag', () => {
      expect(customElements.get('playerstack-title')).toBe(PlayerstackTitle);
    });

    it('upgrades a created element to a PlayerstackTitle instance', () => {
      const el = mount();
      expect(el).toBeInstanceOf(PlayerstackTitle);
    });
  });

  describe('Markup_Contract (Req 10.2)', () => {
    it('renders a part="title" node after connect', () => {
      const el = mount();
      expect(el.querySelector('[part="title"]')).not.toBeNull();
    });
  });

  describe('title text reflection (Req 10.2, 10.3)', () => {
    it('seeds the title text from a title attribute present before connect', () => {
      const el = mount('Big Buck Bunny');
      expect(el.querySelector('[part="title"]')?.textContent).toBe('Big Buck Bunny');
    });

    it('reflects the title attribute set after connect into the part="title" textContent', () => {
      const el = mount();
      // No title yet: the read-out starts empty.
      expect(el.querySelector('[part="title"]')?.textContent).toBe('');

      el.setAttribute('title', 'Sprite Fight');

      expect(el.querySelector('[part="title"]')?.textContent).toBe('Sprite Fight');
    });

    it('repaints the read-out when the title attribute changes', () => {
      const el = mount('First Title');
      expect(el.querySelector('[part="title"]')?.textContent).toBe('First Title');

      el.setAttribute('title', 'Second Title');

      expect(el.querySelector('[part="title"]')?.textContent).toBe('Second Title');
    });

    it('clears the read-out to an empty string when the title attribute is removed', () => {
      const el = mount('Removable Title');
      expect(el.querySelector('[part="title"]')?.textContent).toBe('Removable Title');

      el.removeAttribute('title');

      expect(el.querySelector('[part="title"]')?.textContent).toBe('');
    });
  });
});
