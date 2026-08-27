/**
 * Example/edge tests for `propToAttribute`/`attributeToProp` (Req 7.2, 17.5).
 *
 * The property test (`attribute-reflect.pbt.spec.ts`) covers the exact roundtrip for
 * finite values. These examples cover the FALLBACK branches the roundtrip generators
 * intentionally exclude: absent (`null`) attributes and non-parsing numeric strings,
 * plus the HTML boolean presence convention.
 */
import { propToAttribute, attributeToProp } from '@ui/attribute-reflect';

describe('attribute-reflect fallbacks (Req 7.2)', () => {
  describe('attributeToProp', () => {
    it('falls back to 0 for an absent number attribute', () => {
      expect(attributeToProp(null, 'number')).toBe(0);
    });

    it('falls back to 0 for a non-parsing number attribute', () => {
      expect(attributeToProp('not-a-number', 'number')).toBe(0);
    });

    it('parses a finite number attribute', () => {
      expect(attributeToProp('12.5', 'number')).toBe(12.5);
    });

    it('falls back to empty string for an absent string attribute', () => {
      expect(attributeToProp(null, 'string')).toBe('');
    });

    it('decodes boolean presence: present → true, absent → false', () => {
      expect(attributeToProp('', 'boolean')).toBe(true);
      expect(attributeToProp('anything', 'boolean')).toBe(true);
      expect(attributeToProp(null, 'boolean')).toBe(false);
    });
  });

  describe('propToAttribute', () => {
    it('encodes boolean presence: true → "" and false → null', () => {
      expect(propToAttribute(true, 'boolean')).toBe('');
      expect(propToAttribute(false, 'boolean')).toBeNull();
    });

    it('stringifies numbers and strings', () => {
      expect(propToAttribute(7, 'number')).toBe('7');
      expect(propToAttribute('hi', 'string')).toBe('hi');
    });
  });
});
