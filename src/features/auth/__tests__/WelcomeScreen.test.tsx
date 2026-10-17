import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WelcomeScreen } from '../WelcomeScreen';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

describe('WelcomeScreen', () => {
  it('shows the MOMENTUM name and tagline', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByRole('header').props.children).toBe('MOMENTUM');
    expect(screen.getByText('Small actions. Big momentum.')).toBeTruthy();
  });

  /**
   * Reanimated warns "Property "opacity" of AnimatedComponent(View) may be
   * overwritten by a layout animation" when a view with `entering` also sets
   * a property the animation drives. FadeIn / FadeInDown / ZoomIn drive
   * opacity and transform, so those must live on a nested view.
   */
  it('never puts static opacity/transform on a view with an entering animation', async () => {
    await render(<WelcomeScreen />);
    const animated = screen.container.queryAll((n) => typeof n.type === 'string' && n.props.entering !== undefined);
    expect(animated.length).toBeGreaterThanOrEqual(7);
    for (const node of animated) {
      const style = StyleSheet.flatten(node.props.style) ?? {};
      expect(style).not.toHaveProperty('opacity');
      expect(style).not.toHaveProperty('transform');
    }
  });
});
