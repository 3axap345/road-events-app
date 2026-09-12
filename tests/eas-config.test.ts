import { describe, expect, it } from 'vitest';

describe('development build configuration', () => {
  it('defines Android and iOS EAS development profiles', async () => {
    const { default: easConfig } = await import('../eas.json');

    expect(easConfig.build.development).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
      android: {
        buildType: 'apk'
      },
      ios: {
        simulator: false
      }
    });

    expect(easConfig.build['development-simulator']).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
      ios: {
        simulator: true
      }
    });
  });

  it('configures the required Expo plugins', async () => {
    const { default: createExpoConfig } = await import('../app.config');

    const expoConfig = createExpoConfig({
      config: {}
    } as Parameters<typeof createExpoConfig>[0]);

    const plugins = expoConfig.plugins ?? [];

    const pluginNames = plugins.map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin
    );

    expect(pluginNames).toContain('expo-router');
    expect(pluginNames).toContain('expo-location');
    expect(pluginNames).toContain('@maplibre/maplibre-react-native');

    expect(pluginNames).not.toContain('react-native-maps');

    const locationPlugin = plugins.find(
      (plugin) =>
        Array.isArray(plugin) &&
        plugin[0] === 'expo-location'
    );

    expect(locationPlugin).toBeDefined();

    if (Array.isArray(locationPlugin)) {
      expect(locationPlugin[1]).toMatchObject({
        locationWhenInUsePermission: expect.any(String)
      });
    }
  });
});