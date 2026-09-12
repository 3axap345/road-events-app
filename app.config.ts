import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Driver Community Map',
  slug: 'road-events-app',
  owner: 'zaxap382s-team',
  scheme: 'driver-community-map',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',

  ios: {
    bundleIdentifier: 'com.drivercommunity.map',
    supportsTablet: true
  },

  android: {
    package: 'com.drivercommunity.map'
  },

    plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Разрешите доступ к геопозиции, чтобы показать события рядом.'
      }
    ],
    '@maplibre/maplibre-react-native'
  ],

  extra: {
    eas: {
      projectId: 'fde6a5fb-3bc8-4e9e-9abc-474296025f0f'
    }
  },

  experiments: {
    typedRoutes: true
  }
});