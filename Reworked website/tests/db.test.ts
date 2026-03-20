import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { getCustomNews, addCustomNews, deleteCustomNews, verifyAdmin } from '../lib/db';
import { Database } from 'bun:sqlite';
import path from 'path';

describe('Database Operations', () => {
    let testItemId: number;

    // Clean up any left over test artifacts
    beforeAll(() => {
        const dbPath = path.join(process.cwd(), 'custom-news.db');
        const db = new Database(dbPath);
        // Create the table just in case the db hasn't been initialized yet
        db.exec(`
            CREATE TABLE IF NOT EXISTS custom_news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            url TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            image_url TEXT
            )
        `);
        db.exec("DELETE FROM custom_news WHERE title = 'TEST_TITLE'");
        db.close();
    });

    afterAll(() => {
        const dbPath = path.join(process.cwd(), 'custom-news.db');
        const db = new Database(dbPath);
        db.exec("DELETE FROM custom_news WHERE title = 'TEST_TITLE'");
        db.close();
    });

    it('should verify the default admin password', () => {
        // verifyAdmin creates the table and seeds it if it doesn't exist
        expect(verifyAdmin('3EmmertjesWater')).toBe(true);
        expect(verifyAdmin('wrongpassword')).toBe(false);
    });

    it('should add a custom news item', () => {
        const id = addCustomNews(
            'TEST_TITLE',
            'TEST_DESCRIPTION',
            'https://test.com',
            'https://test.com/image.jpg',
            'test, tags'
        );
        
        testItemId = Number(id);

        expect(typeof testItemId).toBe('number');
        expect(testItemId).toBeGreaterThan(0);
    });

    it('should retrieve the custom news item', () => {
        const news = getCustomNews();
        const testItem = news.find(n => n.id === testItemId);

        expect(testItem).toBeDefined();
        expect(testItem?.title).toBe('TEST_TITLE');
        expect(testItem?.description).toBe('TEST_DESCRIPTION');
        expect(testItem?.url).toBe('https://test.com');
        expect(testItem?.image_url).toBe('https://test.com/image.jpg');
        expect(testItem?.tags).toBe('test, tags');
    });

    it('should delete the custom news item', () => {
        deleteCustomNews(testItemId);
        const news = getCustomNews();
        const testItem = news.find(n => n.id === testItemId);

        expect(testItem).toBeUndefined();
    });
});
