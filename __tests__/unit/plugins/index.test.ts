import { PluginLoader } from '../../../src/plugins';
import type { Plugin, PluginMetadata, PluginConfig } from '../../../src/plugins';

describe('Plugins Module', () => {
  it('should export required components', () => {
    expect(PluginLoader).toBeDefined();
    // Type imports are compile-time only, so we just verify the class export
    expect(typeof PluginLoader).toBe('function');
  });
});
