import { NextResponse } from 'next/server';
import { getWeatherData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export type WeatherData = {
    temperature: number;       // °C, rounded to 1 decimal
    humidity: number;          // % relative humidity
    windSpeed: number;         // km/h, rounded to integer
    weatherCode: number;       // WMO weather interpretation code
    isDay: number;             // 1 = daytime, 0 = night
};

export async function GET() {
    const data = await getWeatherData();
    if (!data) {
        return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
    }
    return NextResponse.json(data);
}
