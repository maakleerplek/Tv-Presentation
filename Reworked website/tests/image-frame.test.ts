import { describe, expect, test } from 'bun:test';
import { imageFrameAspect } from '@/components/event-carousel';

describe('imageFrameAspect', () => {
  test('follows an image within the allowed range', () => {
    expect(imageFrameAspect(1080 / 720)).toBeCloseTo(1.5);   // the Mistral poster: shown whole
    expect(imageFrameAspect(1200 / 630)).toBeCloseTo(1.905);
  });

  test('clamps images that are too tall or too wide', () => {
    expect(imageFrameAspect(1)).toBe(1.3);      // square
    expect(imageFrameAspect(0.8)).toBe(1.3);    // portrait
    expect(imageFrameAspect(3)).toBe(2.2);      // banner
  });

  test('uses the share-image shape until the size is known', () => {
    expect(imageFrameAspect(undefined)).toBeCloseTo(1200 / 630);
    expect(imageFrameAspect(NaN)).toBeCloseTo(1200 / 630);
  });
});
