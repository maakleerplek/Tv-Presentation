'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
    // retry off: every query polls anyway. gcTime short: the Pi has little RAM.
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 60_000,
                refetchOnWindowFocus: false,
                refetchIntervalInBackground: true,
            },
        },
    }));
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
