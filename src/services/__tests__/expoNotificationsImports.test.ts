import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('expo-notifications imports', () => {
  /**
   * Importing the package index crashes Expo Go on Android ("Cannot find
   * native module 'ExpoTopicSubscriptionModule'"), so app code must go
   * through src/services/expoNotifications.ts.
   */
  it('never imports the package index from app code', () => {
    const offenders = sourceFiles(SRC).filter((f) => /from ['"]expo-notifications['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('the wrapper never loads the push-only topic subscription module', () => {
    const wrapper = readFileSync(path.join(SRC, 'services/expoNotifications.ts'), 'utf8');
    const sources = [...wrapper.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      expect(s).toMatch(/^expo-notifications\/build\//);
      expect(s).not.toMatch(/topicSubscription|PushToken|registerTask|ServerRegistration/i);
    }
  });
});
