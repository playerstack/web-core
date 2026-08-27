import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { ChapterInput } from '@typings/chapters.types';

/**
 * Spec for `playerstack-chapters` — the current-chapter title UI_Element (Req 3.3, 5.1, 5.2,
 * 5.3, 17.5). It verifies the Markup_Contract (`part="chapters"` container with a
 * `part="chapter-title"` region), store→display propagation (the active chapter title appears
 * for the current `seek`), and the reflected `data-active` state (Req 3.3).
 */
registerPlayerstackElements();

/** Raw chapter markers matching the real `ChapterInput` shape (`title`/`startTime`). */
const CHAPTERS: ChapterInput[] = [
  { title: 'Intro', startTime: 0 },
  { title: 'Middle', startTime: 40 },
  { title: 'Outro', startTime: 80 },
];

/** Creates a connected controller host and a chapters child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-chapters');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-chapters', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="chapters" with a part="chapter-title" region', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="chapters"]')).not.toBeNull();
      expect(root.querySelector('[part="chapter-title"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: ChapterInput[] }).chapters = CHAPTERS;
      host.store.set({ duration: 100, seek: 50 });
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→display propagation (Req 3.3)', () => {
    it('shows the active chapter title in part="chapter-title" and reflects data-active', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: ChapterInput[] }).chapters = CHAPTERS;

      host.store.set({ duration: 100, seek: 50 });

      const title = (el).querySelector('[part="chapter-title"]');
      expect(title?.textContent).toBe('Middle');
      expect(el.getAttribute('data-active')).toBe('true');
    });

    it('resolves the correct chapter as seek advances', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: ChapterInput[] }).chapters = CHAPTERS;

      host.store.set({ duration: 100, seek: 90 });

      const title = (el).querySelector('[part="chapter-title"]');
      expect(title?.textContent).toBe('Outro');
    });
  });

  describe('chapters input handling (Req 1.6)', () => {
    it('exposes the tracked markers via the getter', () => {
      const { el } = mount();
      (el as unknown as { chapters: ChapterInput[] | null }).chapters = CHAPTERS;
      expect((el as unknown as { chapters: ChapterInput[] | null }).chapters).toEqual(CHAPTERS);
    });

    it('clears the chapters when the input is set to null', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: ChapterInput[] | null }).chapters = CHAPTERS;
      (el as unknown as { chapters: ChapterInput[] | null }).chapters = null;

      host.store.set({ duration: 100, seek: 50 });

      const title = (el).querySelector('[part="chapter-title"]');
      expect(title?.textContent).toBe('');
      expect(el.getAttribute('data-active')).toBe('false');
    });

    it('recomputes and paints from markers and store state present before connect', () => {
      // Assigning markers while detached exercises the pre-render guard in
      // updateActiveChapter; connecting under a host whose store already has a duration
      // and seek recomputes segments and paints the active chapter on render.
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      host.store.set({ duration: 100, seek: 50 });

      const el = document.createElement('playerstack-chapters');
      (el as unknown as { chapters: ChapterInput[] }).chapters = CHAPTERS; // detached: guard path
      host.appendChild(el); // connect: render recomputes + paints from resolved store state

      const title = (el).querySelector('[part="chapter-title"]');
      expect(title?.textContent).toBe('Middle');
    });
  });
});
