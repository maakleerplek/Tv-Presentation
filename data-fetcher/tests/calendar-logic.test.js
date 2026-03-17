
import { describe, it, expect } from 'bun:test';

/**
 * Simplified version of the classification logic from server.js
 */
function classifyEvents(calendar, recurringKeywords) {
    const workshops = [];
    const recurringEvents = [];

    // Count title occurrences to detect repeating events
    const titleCounts = {};
    for (const event of calendar) {
        titleCounts[event.title] = (titleCounts[event.title] || 0) + 1;
    }

    const recurringByTitle = {};

    for (const event of calendar) {
        const isRecurringByCount = titleCounts[event.title] > 1;
        const isRecurringByKeyword = recurringKeywords.some(kw => 
            event.title.toLowerCase().includes(kw)
        );

        if (isRecurringByCount || isRecurringByKeyword) {
            if (!recurringByTitle[event.title]) recurringByTitle[event.title] = [];
            recurringByTitle[event.title].push(event);
        } else {
            workshops.push({ ...event, type: 'workshop' });
        }
    }

    return { workshops, recurringByTitle };
}

describe('Calendar Classification Logic', () => {
    const recurringKeywords = ['openlab', 'repair', 'young maker'];

    it('classifies unique titles as workshops', () => {
        const calendar = [
            { title: 'Soldering for beginners', dateISO: '2026-03-20' },
            { title: '3D Printing basics', dateISO: '2026-03-21' }
        ];
        
        const { workshops, recurringByTitle } = classifyEvents(calendar, recurringKeywords);
        
        expect(workshops).toHaveLength(2);
        expect(workshops[0].title).toBe('Soldering for beginners');
        expect(Object.keys(recurringByTitle)).toHaveLength(0);
    });

    it('classifies repeating titles as recurring', () => {
        const calendar = [
            { title: 'OpenLab', dateISO: '2026-03-18' },
            { title: 'OpenLab', dateISO: '2026-03-25' },
            { title: 'Unique Workshop', dateISO: '2026-03-20' }
        ];
        
        const { workshops, recurringByTitle } = classifyEvents(calendar, recurringKeywords);
        
        expect(workshops).toHaveLength(1);
        expect(workshops[0].title).toBe('Unique Workshop');
        expect(recurringByTitle['OpenLab']).toHaveLength(2);
    });

    it('classifies single events with priority keywords as recurring', () => {
        const calendar = [
            { title: 'Repair Café', dateISO: '2026-03-18' }
        ];
        // 'repair' is in our recurringKeywords
        
        const { workshops, recurringByTitle } = classifyEvents(calendar, recurringKeywords);
        
        expect(workshops).toHaveLength(0);
        expect(recurringByTitle['Repair Café']).toHaveLength(1);
    });

    it('is case-insensitive for keywords', () => {
        const calendar = [
            { title: 'YOUNG MAKER SUNDAY', dateISO: '2026-03-22' }
        ];
        
        const { recurringByTitle } = classifyEvents(calendar, recurringKeywords);
        expect(recurringByTitle['YOUNG MAKER SUNDAY']).toBeDefined();
    });
});
