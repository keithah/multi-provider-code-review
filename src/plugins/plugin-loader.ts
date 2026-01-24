/**
 * Plugin Loader System
 * Dynamically loads and registers custom provider plugins
 *
 * ⚠️  SECURITY WARNING ⚠️
 *
 * This module loads and executes arbitrary JavaScript code from the filesystem.
 * Plugins have FULL system access with no sandboxing or isolation.
 *
 * CRITICAL SECURITY CONSIDERATIONS:
 * - Only load plugins from trusted sources you control
 * - Never use in public GitHub Actions workflows where untrusted PRs could influence plugin loading
 * - Plugins can execute ANY Node.js code with the same permissions as this process
 * - Review all plugin code before deployment
 * - Use allowlist/blocklist to restrict which plugins can be loaded
 *
 * RECOMMENDED USAGE:
 * - Private, controlled environments only (self-hosted runners, internal CI/CD)
 * - Consider requiring explicit acknowledgment via PLUGIN_SECURITY_ACKNOWLEDGED env var
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { Provider } from '../providers/base';

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  providers: string[];
}

export interface Plugin {
  metadata: PluginMetadata;
  initialize: () => Promise<void> | void;
  createProvider: (model: string, apiKey: string) => Provider;
}

export interface PluginConfig {
  pluginDir: string;
  enabled: boolean;
  allowlist?: string[];
  blocklist?: string[];
}

export class PluginLoader {
  private plugins = new Map<string, Plugin>();
  private providerMap = new Map<string, string>(); // provider name -> plugin name

  constructor(private readonly config: PluginConfig) {}

  /**
   * Load all plugins from plugin directory
   */
  async loadPlugins(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Plugins disabled, skipping load');
      return;
    }

    try {
      const pluginDir = path.resolve(this.config.pluginDir);
      logger.info(`Loading plugins from: ${pluginDir}`);

      // Check if directory exists
      try {
        await fs.access(pluginDir);
      } catch (error) {
        logger.warn(`Plugin directory does not exist: ${pluginDir}`);
        return;
      }

      const entries = await fs.readdir(pluginDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginPath = path.join(pluginDir, entry.name);
        await this.loadPlugin(pluginPath);
      }

      logger.info(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      logger.error('Failed to load plugins', error as Error);
      throw error;
    }
  }

  /**
   * Load a single plugin from directory
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const indexPath = path.join(pluginPath, 'index.js');

      // Check if plugin entry point exists
      try {
        await fs.access(indexPath);
      } catch (error) {
        logger.debug(`Plugin at ${pluginPath} missing index.js, skipping`);
        return;
      }

      // Dynamically import plugin
      const pluginModule = await import(indexPath);
      const plugin = pluginModule.default as Plugin;

      // Validate plugin structure
      if (!plugin.metadata || !plugin.createProvider) {
        logger.warn(`Invalid plugin at ${pluginPath}: missing required fields`);
        return;
      }

      // Validate metadata structure
      const metadata = plugin.metadata;
      if (!metadata.name || typeof metadata.name !== 'string' || metadata.name.trim() === '') {
        logger.warn(`Invalid plugin at ${pluginPath}: metadata.name must be a non-empty string`);
        return;
      }

      if (!metadata.version || typeof metadata.version !== 'string' || metadata.version.trim() === '') {
        logger.warn(`Invalid plugin at ${pluginPath}: metadata.version must be a non-empty string`);
        return;
      }

      if (!Array.isArray(metadata.providers) || metadata.providers.length === 0) {
        logger.warn(`Invalid plugin at ${pluginPath}: metadata.providers must be a non-empty array`);
        return;
      }

      // Validate all provider names are non-empty strings
      for (const provider of metadata.providers) {
        if (typeof provider !== 'string' || provider.trim() === '') {
          logger.warn(`Invalid plugin at ${pluginPath}: all provider names must be non-empty strings`);
          return;
        }
      }

      // Check allowlist/blocklist
      if (!this.isPluginAllowed(plugin.metadata.name)) {
        logger.info(`Plugin ${plugin.metadata.name} blocked by policy`);
        return;
      }

      // Initialize plugin
      if (plugin.initialize) {
        await plugin.initialize();
      }

      // Register plugin
      this.plugins.set(plugin.metadata.name, plugin);

      // Map provider names to plugin
      for (const providerName of plugin.metadata.providers) {
        this.providerMap.set(providerName, plugin.metadata.name);
      }

      logger.info(
        `Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version} ` +
        `(${plugin.metadata.providers.length} providers)`
      );
    } catch (error) {
      logger.error(`Failed to load plugin at ${pluginPath}`, error as Error);
    }
  }

  /**
   * Check if plugin is allowed by allowlist/blocklist
   */
  private isPluginAllowed(name: string): boolean {
    const { allowlist, blocklist } = this.config;

    // If allowlist exists, only allow listed plugins
    if (allowlist && allowlist.length > 0) {
      return allowlist.includes(name);
    }

    // If blocklist exists, reject blocked plugins
    if (blocklist && blocklist.length > 0) {
      return !blocklist.includes(name);
    }

    return true;
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if provider is provided by a plugin
   */
  hasProvider(providerName: string): boolean {
    return this.providerMap.has(providerName);
  }

  /**
   * Create provider instance from plugin
   */
  createProvider(providerName: string, apiKey: string): Provider | null {
    const pluginName = this.providerMap.get(providerName);
    if (!pluginName) {
      return null;
    }

    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return null;
    }

    try {
      return plugin.createProvider(providerName, apiKey);
    } catch (error) {
      logger.error(`Failed to create provider ${providerName} from plugin ${pluginName}`, error as Error);
      return null;
    }
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(p => p.metadata);
  }

  /**
   * Get all available providers from plugins
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providerMap.keys());
  }
}
