import type { ScreenData, NewsItem } from './types';
import type { WeatherData } from '@/app/api/weather/route';
import { getCustomNews } from './db';

const INTERNAL_URL = process.env.DATA_FETCHER_INTERNAL_URL || 'http://data-fetcher:8080';
const EXTERNAL_URL = process.env.DATA_FETCHER_EXTERNAL_URL || 'http://localhost:8085';

const CACHE_REVALIDATE = 5 * 60; // 5 minutes

export async function getScreenData(): Promise<ScreenData | null> {
    try {
        let res: Response | undefined;
        try {
            res = await fetch(`${INTERNAL_URL}/api/screen-data`, {
                next: { revalidate: CACHE_REVALIDATE }
            });
        } catch {
            // failed to connect to docker container
        }

        let rawData: ScreenData | null = null;

        if (!res || !res.ok) {
            try {
                const localRes = await fetch(`${EXTERNAL_URL}/api/screen-data`, {
                    next: { revalidate: CACHE_REVALIDATE }
                });
                if (localRes.ok) {
                    rawData = await localRes.json();
                }
            } catch {
                // failed to connect to local fallback
            }
        } else {
            try {
                rawData = await res.json();
            } catch {
                // failed to parse json
            }
        }

        if (!rawData) return null;

        // Fetch custom news from local SQLite database
        const customNewsRows = getCustomNews();
        
        // Map database rows to the NewsItem type expected by the frontend
        const customNewsItems: NewsItem[] = customNewsRows.map(row => ({
            title: row.title,
            description: row.description,
            link: row.url || '',
            imageUrl: row.image_url || '',
            date: 'Aankondiging',
            type: 'news',
            _id: row.id // Attach the DB id for the admin interface to allow deleting
        }));

        // Merge custom news at the top of the scraped news
        rawData.news = [...customNewsItems, ...rawData.news];

        return rawData;
    } catch (error) {
        console.error('getScreenData error:', error);
        return null;
    }
}

export async function getWeatherData(): Promise<WeatherData | null> {
    const lat = process.env.WEATHER_LAT ?? '50.8798';
    const lon = process.env.WEATHER_LON ?? '4.7005';

    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
        `&wind_speed_unit=kmh` +
        `&timezone=Europe%2FBrussels`;

    try {
        const res = await fetch(url, { 
            next: { revalidate: CACHE_REVALIDATE } 
        });
        if (!res.ok) return null;

        const json = await res.json();
        const c = json.current;

        return {
            temperature: Math.round(c.temperature_2m * 10) / 10,
            humidity:    Math.round(c.relative_humidity_2m),
            windSpeed:   Math.round(c.wind_speed_10m),
            weatherCode: c.weather_code,
            isDay:       c.is_day,
        };
    } catch (err) {
        console.error('getWeatherData error:', err);
        return null;
    }
}
