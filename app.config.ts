import type { ConfigContext, ExpoConfig } from 'expo/config';

const GOOGLE_MAPS_ANDROID_API_KEY = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Driver Community Map',
  slug: 'driver-community-map',
  scheme: 'driver-community-map',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.drivercommunity.map', supportsTablet: true },
  android: { package: 'com.drivercommunity.map' },
  plugins: [
    'expo-router',
    ['expo-location', { locationWhenInUsePermission: 'Разрешите доступ к геопозиции, чтобы показать события рядом.' }],
    ['react-native-maps', { androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID_API_KEY }]
  ],
  experiments: { typedRoutes: true }
});
