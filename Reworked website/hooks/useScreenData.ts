import { useState, useEffect } from 'react';

export type ScreenData = {
    workshops: any[];
    news: any[];
    recurringEvents: any[];
    drinks: any[];
};

export function useScreenData() {
    const [data, setData] = useState<ScreenData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;

        async function fetchData() {
            try {
                const response = await fetch('/api/screen-data');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const json = await response.json();
                if (mounted) {
                    setData(json);
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error'));
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        // Initial fetch
        fetchData();

        // Re-fetch every 5 minutes to keep display fresh without reloading
        const interval = setInterval(fetchData, 5 * 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return { data, loading, error };
}
