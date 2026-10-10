import { describe, it, expect } from 'bun:test';
import { passwordMatches, createSession, sessionValid, endSession } from '../lib/auth';

describe('admin auth', () => {
    it('accepts only the configured password, and nothing when none is set', () => {
        expect(passwordMatches('secret', 'secret')).toBe(true);
        expect(passwordMatches('wrong', 'secret')).toBe(false);
        expect(passwordMatches('', '')).toBe(false);
        expect(passwordMatches('anything', undefined)).toBe(false);
    });

    it('only knows tokens it handed out, until they expire or sign out', () => {
        const now = Date.now();
        const token = createSession(now);
        expect(sessionValid(token, now)).toBe(true);
        expect(sessionValid('authenticated', now)).toBe(false); // the old fixed cookie value
        expect(sessionValid(token, now + 8 * 24 * 3600 * 1000)).toBe(false);

        const other = createSession(now);
        endSession(other);
        expect(sessionValid(other, now)).toBe(false);
    });
});
