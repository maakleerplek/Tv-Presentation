'use client';

import { ScreenDataOverrideContext } from './useScreenData';
import type { ScreenData } from '@/lib/types';

export function ScreenDataOverrideProvider({
    data,
    children,
}: {
    data: ScreenData;
    children: React.ReactNode;
}) {
    return (
        <ScreenDataOverrideContext.Provider value={data}>
            {children}
        </ScreenDataOverrideContext.Provider>
    );
}
