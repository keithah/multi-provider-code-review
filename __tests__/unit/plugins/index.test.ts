import { PluginLoader } from '../../../src/plugins';

describe('Plugins Module', () => {
  it('should export required components', () => {
    expect(PluginLoader).toBeDefined();
    expect(typeof PluginLoader).toBe('function');
  });
});
