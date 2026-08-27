import { registerPlayerstackElements } from '@ui/register';
import type { IconDescriptor } from '@typings/icons.types';
import type { RenderSvgOptions } from '@typings/ui/icon-render.types';

/**
 * Spec for `playerstack-icon` — the presentational SVG icon UI_Element (Req 5.1, 5.3, 17.5).
 * As a purely presentational element it holds no media state and needs no controller host, so
 * it is created and connected directly. It verifies the Markup_Contract (`part="icon"` wrapper
 * `<span>`), that assigning an `IconDescriptor` serializes an inline `<svg>` with the described
 * path, and that `size` forwards a width onto the `<svg>`.
 */
registerPlayerstackElements();

/** A minimal descriptor matching the real `IconDescriptor` shape (`viewBox` + `elements`). */
const ICON: IconDescriptor = {
  viewBox: '0 0 24 24',
  elements: [{ tag: 'path', attrs: { d: 'M0 0h24v24H0z' } }],
};

/** Creates a connected `playerstack-icon` element (no controller host needed). */
function mount(): HTMLElement {
  const el = document.createElement('playerstack-icon');
  document.body.appendChild(el);
  return el;
}

describe('playerstack-icon', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.3)', () => {
    it('renders a part="icon" wrapper span', () => {
      const el = mount();
      const wrapper = (el).querySelector('[part="icon"]');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.tagName.toLowerCase()).toBe('span');
    });

    it('serializes the descriptor into an inline svg with the described path', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;

      const wrapper = (el).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toContain('<svg');
      expect(wrapper.innerHTML).toContain('viewBox="0 0 24 24"');
      expect(wrapper.innerHTML).toContain('<path');
      expect(wrapper.innerHTML).toContain('M0 0h24v24H0z');
    });

    it('forwards the size width onto the svg', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      (el as unknown as { size: RenderSvgOptions }).size = { width: 24 };

      const wrapper = (el).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toContain('width="24"');
    });

    it('matches the rendered shadow markup snapshot', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      (el as unknown as { size: RenderSvgOptions }).size = { width: 24 };
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('icon/size accessors', () => {
    it('exposes the assigned descriptor via the icon getter', () => {
      const el = mount() as unknown as { icon: IconDescriptor | null };
      el.icon = ICON;
      expect(el.icon).toBe(ICON);
    });

    it('exposes the assigned sizing via the size getter and repaints', () => {
      const el = mount() as unknown as { icon: IconDescriptor; size: RenderSvgOptions | null };
      el.icon = ICON;
      el.size = { width: 30, height: 30 };
      expect(el.size).toEqual({ width: 30, height: 30 });

      const wrapper = (el as unknown as HTMLElement).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toContain('width="30"');
      expect(wrapper.innerHTML).toContain('height="30"');
    });

    it('normalizes a null size assignment to empty sizing', () => {
      const el = mount() as unknown as { size: RenderSvgOptions | null };
      el.size = { width: 30 };
      el.size = null;
      expect(el.size).toEqual({});
    });

    it('empties the wrapper when the descriptor is cleared to null', () => {
      const el = mount() as unknown as { icon: IconDescriptor | null };
      el.icon = ICON;
      el.icon = null;

      const wrapper = (el as unknown as HTMLElement).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toBe('');
    });

    it('paints a descriptor assigned before connect once rendered', () => {
      // Assigning `icon` while detached exercises the pre-render guard in `paint` (wrapper
      // is still null); connecting then renders and paints from the stored descriptor.
      const el = document.createElement('playerstack-icon');
      (el as unknown as { icon: IconDescriptor }).icon = ICON; // detached: guard path
      document.body.appendChild(el); // connect: render + paint

      const wrapper = (el).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toContain('<svg');
    });

    it('keeps a single wrapper across disconnect/reconnect (idempotent render)', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      // Reconnect: connectedCallback → render runs again and must early-return (guard).
      el.remove();
      document.body.appendChild(el);

      const wrappers = (el).querySelectorAll('[part="icon"]');
      expect(wrappers).toHaveLength(1);
    });
  });

  describe('width/height attribute reflection', () => {
    it('merges the width attribute into the serialized svg', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      el.setAttribute('width', '48');

      const wrapper = (el).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).toContain('width="48"');
    });

    it('clears a dimension when its attribute is removed', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      el.setAttribute('height', '48');
      el.removeAttribute('height');

      const wrapper = (el).querySelector('[part="icon"]') as HTMLElement;
      expect(wrapper.innerHTML).not.toContain('height="48"');
    });

    it('ignores attribute changes that are not width/height', () => {
      const el = mount();
      (el as unknown as { icon: IconDescriptor }).icon = ICON;
      const before = ((el).querySelector('[part="icon"]') as HTMLElement).innerHTML;

      // `role` is not part of the icon's attributeSchema, so onAttributeChanged early-returns.
      (
        el as unknown as { onAttributeChanged: (k: string, v: string | number | boolean) => void }
      ).onAttributeChanged('role', 'img');

      const after = ((el).querySelector('[part="icon"]') as HTMLElement).innerHTML;
      expect(after).toBe(before);
    });
  });
});
