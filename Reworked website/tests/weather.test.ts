/**
 * Tests for the WMO weather-code interpreter in weather.tsx.
 * Only the Dutch label is asserted — the Icon value is a React component
 * that we don't need to inspect here.
 */
import { describe, test, expect } from 'bun:test';
import { interpretCode } from '@/components/weather';

describe('interpretCode — labels', () => {
    // Clear sky
    test('code 0 daytime → Helder', () => {
        expect(interpretCode(0, true).label).toBe('Helder');
    });
    test('code 0 nighttime → Helder', () => {
        expect(interpretCode(0, false).label).toBe('Helder');
    });

    // Mostly clear
    test('code 1 daytime → Overwegend helder', () => {
        expect(interpretCode(1, true).label).toBe('Overwegend helder');
    });

    // Partly cloudy
    test('code 2 → Gedeeltelijk bewolkt', () => {
        expect(interpretCode(2, true).label).toBe('Gedeeltelijk bewolkt');
    });

    // Overcast
    test('code 3 → Bewolkt', () => {
        expect(interpretCode(3, false).label).toBe('Bewolkt');
    });

    // Fog
    test('code 45 → Mist', () => {
        expect(interpretCode(45, true).label).toBe('Mist');
    });
    test('code 48 → Mist', () => {
        expect(interpretCode(48, true).label).toBe('Mist');
    });

    // Drizzle
    test('code 51 → Motregen', () => {
        expect(interpretCode(51, true).label).toBe('Motregen');
    });
    test('code 55 → Motregen', () => {
        expect(interpretCode(55, true).label).toBe('Motregen');
    });

    // Freezing drizzle
    test('code 56 → IJzel', () => {
        expect(interpretCode(56, true).label).toBe('IJzel');
    });
    test('code 57 → IJzel', () => {
        expect(interpretCode(57, true).label).toBe('IJzel');
    });

    // Rain
    test('code 61 → Regen', () => {
        expect(interpretCode(61, true).label).toBe('Regen');
    });
    test('code 65 → Regen', () => {
        expect(interpretCode(65, true).label).toBe('Regen');
    });

    // Freezing rain
    test('code 66 → IJsregen', () => {
        expect(interpretCode(66, true).label).toBe('IJsregen');
    });
    test('code 67 → IJsregen', () => {
        expect(interpretCode(67, true).label).toBe('IJsregen');
    });

    // Snow
    test('code 71 → Sneeuw', () => {
        expect(interpretCode(71, true).label).toBe('Sneeuw');
    });
    test('code 77 → Sneeuw', () => {
        expect(interpretCode(77, true).label).toBe('Sneeuw');
    });

    // Showers
    test('code 80 → Buien', () => {
        expect(interpretCode(80, true).label).toBe('Buien');
    });
    test('code 82 → Buien', () => {
        expect(interpretCode(82, true).label).toBe('Buien');
    });

    // Snow showers
    test('code 85 → Sneeuwbuien', () => {
        expect(interpretCode(85, true).label).toBe('Sneeuwbuien');
    });
    test('code 86 → Sneeuwbuien', () => {
        expect(interpretCode(86, true).label).toBe('Sneeuwbuien');
    });

    // Thunderstorm
    test('code 95 → Onweer', () => {
        expect(interpretCode(95, true).label).toBe('Onweer');
    });
    test('code 99 → Onweer', () => {
        expect(interpretCode(99, true).label).toBe('Onweer');
    });

    // Unknown code
    test('unknown code → Onbekend', () => {
        expect(interpretCode(999, true).label).toBe('Onbekend');
    });
});

describe('interpretCode — day/night icon switching', () => {
    test('code 0 day and night return different Icons', () => {
        const day   = interpretCode(0, true);
        const night = interpretCode(0, false);
        expect(day.Icon).not.toBe(night.Icon);
    });

    test('code 1 day and night return different Icons', () => {
        const day   = interpretCode(1, true);
        const night = interpretCode(1, false);
        expect(day.Icon).not.toBe(night.Icon);
    });

    test('code 2 day and night return the same Icon (clouds)', () => {
        const day   = interpretCode(2, true);
        const night = interpretCode(2, false);
        expect(day.Icon).toBe(night.Icon);
    });
});
