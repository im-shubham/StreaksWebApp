import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. Google Sign-In's native config plugin needs the iOS OAuth
 * client's URL scheme, so it is only added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 * is set (see docs/setup/google-sign-in.md). Without it, builds still work and
 * the app offers email/password only.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${id}` }]);
  }
  return { ...config, name: config.name ?? 'STREAKS', slug: config.slug ?? 'streaks', plugins };
};
