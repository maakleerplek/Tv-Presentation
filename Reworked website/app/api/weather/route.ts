import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type WeatherData = {
    temperature: number;       // °C, rounded to 1 decimal
    humidity: number;          // % relative humidity
    windSpeed: number;         // km/h, rounded to integer
    weatherCode: number;       // WMO weather interpretation code
    isDay: number;             // 1 = daytime, 0 = night
};

export async function GET() {
    const lat = process.env.WEATHER_LAT ?? '50.8798';
    const lon = process.env.WEATHER_LON ?? '4.7005';

    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
        `&wind_speed_unit=kmh` +
        `&timezone=Europe%2FBrussels`;

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Open-Meteo responded with ${res.status}`);
        }

        const json = await res.json();
        const c = json.current;

        const data: WeatherData = {
            temperature: Math.round(c.temperature_2m * 10) / 10,
            humidity:    Math.round(c.relative_humidity_2m),
            windSpeed:   Math.round(c.wind_speed_10m),
            weatherCode: c.weather_code,
            isDay:       c.is_day,
        };

        return NextResponse.json(data);
    } catch (err) {
        console.error('[Weather] Failed to fetch from Open-Meteo:', err);
        return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
    }
}
