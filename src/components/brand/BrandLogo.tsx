import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO = require('../../../assets/brand/momentum-logo.png');

/** Brand name shown to users. Internal ids (bundle, DB, Firestore) keep "streaks". */
export const APP_NAME = 'MOMENTUM';
export const APP_TAGLINE = 'Small actions. Big momentum.';

/**
 * The MOMENTUM logo exactly as supplied (assets/brand, built by
 * scripts/build-brand-assets.py). It is opaque artwork on black, so it is
 * shown as a rounded app-icon tile; always square so it never distorts.
 */
export function BrandLogo({ size, style }: { size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      accessibilityIgnoresInvertColors
      aria-hidden
      resizeMode="contain"
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
    />
  );
}
