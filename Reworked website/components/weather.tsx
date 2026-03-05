'use client';

import { useState, useEffect } from 'react';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, CloudFog, Wind, Droplets, Moon,
} from 'lucide-react';
import type { WeatherData } from '@/app/api/weather/route';

// ── WMO weather code → Dutch label + icon ───────────────────────
// https://open-meteo.com/en/docs#weathervariables
type WeatherInfo = { label: string; Icon: React.ElementType };

export function interpretCode(code: number, isDay: boolean): WeatherInfo {
  if (code === 0)              return { label: isDay ? 'Helder'          : 'Helder',        Icon: isDay ? Sun        : Moon         };
  if (code === 1)              return { label: isDay ? 'Overwegend helder': 'Overwegend helder', Icon: isDay ? Sun   : Moon         };
  if (code === 2)              return { label: 'Gedeeltelijk bewolkt',                        Icon: Cloud                           };
  if (code === 3)              return { label: 'Bewolkt',                                     Icon: Cloud                           };
  if (code === 45 || code === 48) return { label: 'Mist',                                    Icon: CloudFog                        };
  if (code >= 51 && code <= 55)   return { label: 'Motregen',                                Icon: CloudDrizzle                    };
  if (code >= 56 && code <= 57)   return { label: 'IJzel',                                   Icon: CloudDrizzle                    };
  if (code >= 61 && code <= 65)   return { label: 'Regen',                                   Icon: CloudRain                       };
  if (code >= 66 && code <= 67)   return { label: 'IJsregen',                                Icon: CloudRain                       };
  if (code >= 71 && code <= 77)   return { label: 'Sneeuw',                                  Icon: CloudSnow                       };
  if (code >= 80 && code <= 82)   return { label: 'Buien',                                   Icon: CloudRain                       };
  if (code === 85 || code === 86) return { label: 'Sneeuwbuien',                             Icon: CloudSnow                       };
  if (code >= 95 && code <= 99)   return { label: 'Onweer',                                  Icon: CloudLightning                  };
  return { label: 'Onbekend', Icon: Cloud };
}

const WEATHER_POLL_MS = 10 * 60 * 1000; // re-fetch every 10 minutes

export function Weather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchWeather() {
      try {
        const res = await fetch('/api/weather');
        if (!res.ok) throw new Error('weather fetch failed');
        const data: WeatherData = await res.json();
        if (mounted) { setWeather(data); setError(false); }
      } catch {
        if (mounted) setError(true);
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, WEATHER_POLL_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Render ───────────────────────────────────────────────────────
  const base = 'border-b-2 border-[#2C1E16] p-4 bg-[#E6D5B8] flex-1 flex flex-col justify-center';

  if (error) {
    return (
      <div className={base}>
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3">Weer</h2>
        <p className="text-[#2C1E16] text-xs font-black uppercase">Niet beschikbaar</p>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className={base}>
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3">Weer</h2>
        <p className="text-[#2C1E16] text-xs font-black uppercase animate-pulse">Laden...</p>
      </div>
    );
  }

  const { label, Icon } = interpretCode(weather.weatherCode, weather.isDay === 1);

  return (
    <div className={base}>
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3">Weer</h2>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-10 h-10 text-[#2C1E16] shrink-0" />
        <div>
          <div className="text-4xl font-black text-[#2C1E16] leading-none">
            {weather.temperature}°C
          </div>
          <div className="text-[#2C1E16] text-xs font-black mt-1 uppercase leading-none">
            {label}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 text-xs font-black">
        <div className="flex items-center gap-2 text-[#2C1E16]">
          <Wind className="w-4 h-4 shrink-0" />
          <span>{weather.windSpeed} km/h</span>
        </div>
        <div className="flex items-center gap-2 text-[#2C1E16]">
          <Droplets className="w-4 h-4 shrink-0" />
          <span>{weather.humidity}%</span>
        </div>
      </div>
    </div>
  );
}
