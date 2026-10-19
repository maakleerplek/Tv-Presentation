import { describe, test, expect } from 'bun:test';
import { cn, parseDescription, shortUrl } from '@/lib/utils';

describe('cn', () => {
    test('returns a single class unchanged', () => {
        expect(cn('foo')).toBe('foo');
    });

    test('joins multiple classes with a space', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    test('ignores falsy values', () => {
        expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
    });

    test('merges conflicting Tailwind classes (last wins)', () => {
        // tailwind-merge should collapse p-2 and p-4 → p-4
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    test('handles conditional objects', () => {
        expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
    });

    test('returns empty string for no arguments', () => {
        expect(cn()).toBe('');
    });
});

describe('parseDescription', () => {
  test('splits paragraphs, keeps line breaks, groups bullets and shortens URLs', () => {
    const blocks = parseDescription(
      'PRE-ORDERS OPEN:  https://opendrone.be?ref=yt\r\n\r\nLine one\r\nLine **two**\n- a\n• b\n\n1. c',
    );
    expect(blocks.map(b => b.kind)).toEqual(['p', 'p', 'ul', 'ul']);
    expect(blocks[0].lines[0]).toEqual([{ text: 'PRE-ORDERS OPEN:  ' }, { text: 'opendrone.be', url: true }]);
    expect(blocks[1].lines[1]).toEqual([{ text: 'Line ' }, { text: 'two', bold: true }]);
    expect(blocks[2].lines).toEqual([[{ text: 'a' }], [{ text: 'b' }]]);
    expect(blocks[3].lines).toEqual([[{ text: 'c' }]]);
  });

  test('leaves plain text as one paragraph', () => {
    expect(parseDescription('Just text, no breaks.')).toEqual([{ kind: 'p', lines: [[{ text: 'Just text, no breaks.' }]] }]);
  });

  test('shortens URLs to host and path', () => {
    expect(shortUrl('https://www.github.com/OpenDrone-hw/OpenF/?x=1')).toBe('github.com/OpenDrone-hw/OpenF');
  });
});
