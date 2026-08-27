import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for the control-button Tooltip_Manager (framework-agnostic recreation of the original
 * reactjs `Tooltip`). It verifies the behaviours + edge cases ported from main:
 *   - show the button's `aria-label` on hover; hide on pointer leave;
 *   - suppress while a menu is open (`[data-open]` / `[aria-expanded='true']`);
 *   - suppress on click (until the pointer leaves + re-enters);
 *   - only control-bar buttons get a tooltip;
 *   - the floating node is removed on disconnect.
 *
 * jsdom lacks layout (getBoundingClientRect returns zeros) so the exact clamp offset is not
 * asserted here — that is covered at runtime via the diag.html protocol. These tests assert the
 * VISIBILITY + suppression state machine, which is the logic that regressed.
 */
registerPlayerstackElements();

/** Mounts a controller with a `.playerstack-controls` bar holding one labelled button. */
function mount(): { host: PlayerstackMediaController; button: HTMLButtonElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);

  const bar = document.createElement('div');
  bar.className = 'playerstack-controls';
  const button = document.createElement('button');
  button.setAttribute('aria-label', 'Play');
  bar.appendChild(button);
  host.appendChild(bar);

  return { host, button };
}

/** Dispatches a pointerover from `target` (bubbles to the host delegate). */
function hover(target: Element): void {
  target.dispatchEvent(new Event('pointerover', { bubbles: true }));
}

/** Dispatches a pointerout from `target` with an optional relatedTarget. */
function leave(target: Element, related: EventTarget | null = document.body): void {
  const event = new Event('pointerout', { bubbles: true }) as PointerEvent;
  Object.defineProperty(event, 'relatedTarget', { value: related });
  target.dispatchEvent(event);
}

/** Returns the floating tooltip label node (or null). */
function label(host: HTMLElement): HTMLElement | null {
  return host.querySelector('[part="tooltip-label"]');
}

describe('TooltipManager', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the button aria-label on hover', () => {
    const { host, button } = mount();
    hover(button);

    const tip = label(host);
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toBe('Play');
    expect(tip?.getAttribute('data-visible')).toBe('true');
  });

  it('hides the tooltip on pointer leave', () => {
    const { host, button } = mount();
    hover(button);
    leave(button);

    expect(label(host)?.getAttribute('data-visible')).toBe('false');
  });

  it('does not hide when the pointer moves onto a child of the same button', () => {
    const { host, button } = mount();
    const child = document.createElement('span');
    button.appendChild(child);
    hover(button);

    leave(button, child); // relatedTarget is inside the same button
    expect(label(host)?.getAttribute('data-visible')).toBe('true');
  });

  it('suppresses the tooltip while a menu is open (data-open)', () => {
    const { host, button } = mount();
    const menuHost = document.createElement('div');
    menuHost.setAttribute('data-open', 'true');
    host.appendChild(menuHost);

    hover(button);
    // No tooltip shown while a menu is open.
    expect(label(host)).toBeNull();
  });

  it('suppresses the tooltip while an [aria-expanded="true"] descendant exists', () => {
    const { host, button } = mount();
    const expanded = document.createElement('button');
    expanded.setAttribute('aria-expanded', 'true');
    host.appendChild(expanded);

    hover(button);
    expect(label(host)).toBeNull();
  });

  it('suppresses the tooltip on click until the pointer leaves and re-enters', () => {
    const { host, button } = mount();
    hover(button);
    expect(label(host)?.getAttribute('data-visible')).toBe('true');

    // Click hides + suppresses.
    button.dispatchEvent(new Event('click', { bubbles: true }));
    expect(label(host)?.getAttribute('data-visible')).toBe('false');

    // A hover while still suppressed does not re-show.
    hover(button);
    expect(label(host)?.getAttribute('data-visible')).toBe('false');

    // Leaving clears suppression; a fresh hover shows again.
    leave(button);
    hover(button);
    expect(label(host)?.getAttribute('data-visible')).toBe('true');
  });

  it('ignores buttons outside the control bar', () => {
    const { host } = mount();
    const stray = document.createElement('button');
    stray.setAttribute('aria-label', 'Stray');
    host.appendChild(stray); // NOT inside .playerstack-controls

    hover(stray);
    expect(label(host)).toBeNull();
  });

  it('ignores a button with an empty aria-label', () => {
    const { host, button } = mount();
    button.setAttribute('aria-label', '');
    hover(button);
    expect(label(host)).toBeNull();
  });

  it('removes the floating tooltip node on disconnect', () => {
    const { host, button } = mount();
    hover(button);
    expect(label(host)).not.toBeNull();

    host.remove();
    expect(label(host)).toBeNull();
  });
});
