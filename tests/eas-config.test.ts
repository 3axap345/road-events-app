import { describe, expect, it } from 'vitest';

describe('development build configuration', () => {
  it('defines the Expo and EAS configuration files', async () => {
    await expect(import('../app.config')).resolves.toBeDefined();
    await expect(import('../eas.json')).resolves.toBeDefined();
  });
});
