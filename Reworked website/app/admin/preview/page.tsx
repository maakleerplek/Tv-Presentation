import { redirect } from 'next/navigation';
import { checkAuth } from '../actions';
import { getScreenData, getWeatherData } from '@/lib/data';
import { PreviewLayout } from './preview-layout';

export default async function PreviewPage() {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) redirect('/admin');

  const [screenData, weatherData] = await Promise.all([
    getScreenData(),
    getWeatherData(),
  ]);

  // Override config to very fast timings for preview
  const previewData = screenData
    ? {
        ...screenData,
        config: {
          ...screenData.config,
          transitionTime:     2,
          tipsTransitionTime: 2,
          statusRotationTime: 2,
        },
      }
    : null;

  return <PreviewLayout screenData={previewData} weatherData={weatherData} />;
}
