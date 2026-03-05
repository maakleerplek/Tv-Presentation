import { describe, test, expect } from 'bun:test';
import { cn } from '@/lib/utils';

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
