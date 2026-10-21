import { describe, expect, it, jest } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { connectStore, loadOffers, storeAvailability } from '../billing';

jest.mock('expo-iap', () => {
  throw new Error("Cannot find native module 'ExpoIap'");
});


const SRC = path.resolve(__dirname, '../..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) return n === '__tests__' ? [] : files(f);
    return /\.tsx?$/.test(n) ? [f] : [];
  });

describe('billing without the native store module (Expo Go)', () => {
  it('reports purchases as unavailable instead of crashing', async () => {
    expect(storeAvailability()).toEqual({ available: false, reason: expect.stringMatching(/not Expo Go/) });
    expect(await connectStore()).toBe(false);
    expect(await loadOffers()).toEqual([]);
  });

  it('app code never imports expo-iap eagerly (type-only imports are fine)', () => {
    const offenders = files(SRC).filter((f) => /^import (?!type )[^;]*from ['"]expo-iap['"]/m.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
