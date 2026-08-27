import { renderSvgFromDescriptor } from '@ui/icon-render';
import type { IconDescriptor } from '@typings/icons.types';

describe('renderSvgFromDescriptor', () => {
  const singlePathIcon: IconDescriptor = {
    viewBox: '0 0 24 24',
    elements: [{ tag: 'path', attrs: { d: 'M0 0h24v24H0z' } }],
  };

  describe('without size options', () => {
    test('renders root svg with xmlns and viewBox, self-closed path, no width/height', () => {
      const output = renderSvgFromDescriptor(singlePathIcon);

      expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(output).toContain('viewBox="0 0 24 24"');
      expect(output).toContain('<path d="M0 0h24v24H0z"/>');
      expect(output).not.toContain('width=');
      expect(output).not.toContain('height=');
      expect(output).toBe(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
      );
    });
  });

  describe('with size options', () => {
    test('includes width and height when provided in opts', () => {
      const output = renderSvgFromDescriptor(singlePathIcon, { width: 24, height: 24 });

      expect(output).toContain('width="24"');
      expect(output).toContain('height="24"');
    });
  });

  describe('fill handling', () => {
    test('includes fill attribute when descriptor defines fill', () => {
      const icon: IconDescriptor = {
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        elements: [{ tag: 'path', attrs: { d: 'M0 0h24v24H0z' } }],
      };

      const output = renderSvgFromDescriptor(icon);

      expect(output).toContain('fill="currentColor"');
    });

    test('omits fill attribute when descriptor has no fill', () => {
      const output = renderSvgFromDescriptor(singlePathIcon);

      expect(output).not.toContain('fill=');
    });
  });

  describe('nested elements', () => {
    test('wraps children in open/close tags with self-closed leaf child', () => {
      const icon: IconDescriptor = {
        viewBox: '0 0 24 24',
        elements: [
          {
            tag: 'g',
            attrs: { transform: 'translate(1 1)' },
            children: [{ tag: 'path', attrs: { d: 'M0 0h4v4H0z' } }],
          },
        ],
      };

      const output = renderSvgFromDescriptor(icon);

      expect(output).toContain('<g transform="translate(1 1)"><path d="M0 0h4v4H0z"/></g>');
    });
  });

  describe('attribute escaping', () => {
    test('escapes special characters in attribute values and omits raw chars', () => {
      const icon: IconDescriptor = {
        viewBox: '0 0 24 24',
        elements: [{ tag: 'path', attrs: { 'data-label': 'a "b" <c> & d' } }],
      };

      const output = renderSvgFromDescriptor(icon);

      expect(output).toContain('&quot;');
      expect(output).toContain('&lt;');
      expect(output).toContain('&amp;');
      // Raw special chars must not appear inside the attribute value.
      expect(output).toContain('data-label="a &quot;b&quot; &lt;c&gt; &amp; d"');
      expect(output).not.toContain('data-label="a "b"');
    });
  });
});
