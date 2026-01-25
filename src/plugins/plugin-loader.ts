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
import * as crypto from 'crypto';
import { pathToFileURL } from 'url';
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

    // Require explicit security acknowledgment
    // CRITICAL: Plugins execute with full system access, no sandboxing
    const securityAcknowledged = process.env.PLUGIN_SECURITY_ACKNOWLEDGED;

    // Fail fast with explicit validation - must be exactly 'true' (case-sensitive)
    if (securityAcknowledged !== 'true') {
      const actualValue = securityAcknowledged === undefined ? 'undefined' :
                         securityAcknowledged === '' ? 'empty string' :
                         `"${securityAcknowledged}"`;

      logger.error(
        'Plugin loading BLOCKED - Security acknowledgment required. ' +
        'Plugins execute arbitrary code with full system access and no sandboxing. ' +
        `Current PLUGIN_SECURITY_ACKNOWLEDGED value: ${actualValue}. ` +
        'Set PLUGIN_SECURITY_ACKNOWLEDGED=true environment variable ONLY if you: ' +
        '1. Understand the security risks, ' +
        '2. Have reviewed all plugin code, ' +
        '3. Are running in a trusted, private environment.'
      );
      throw new Error(
        `Plugin security not acknowledged (value: ${actualValue}). ` +
        'Set PLUGIN_SECURITY_ACKNOWLEDGED=true to enable plugins. ' +
        'Only use plugins in trusted, private environments where you control all code.'
      );
    }

    logger.info('✓ Plugin security acknowledged - loading plugins with full system access');

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

      // Verify plugin integrity if manifest exists
      await this.verifyPluginIntegrity(pluginPath, indexPath);

      // Dynamically import plugin (use pathToFileURL for cross-platform compatibility)
      const pluginModule = await import(pathToFileURL(indexPath).href);
      const plugin = pluginModule.default as Plugin;

      // Validate plugin structure
      if (!plugin.metadata || !plugin.createProvider) {
        logger.warn(`Invalid plugin at ${pluginPath}: missing required fields`);
        return;
      }

      // Validate that createProvider is actually a function
      if (typeof plugin.createProvider !== 'function') {
        logger.warn(`Invalid plugin at ${pluginPath}: createProvider must be a function`);
        return;
      }

      // Validate that initialize, if present, is a function
      if (plugin.initialize !== undefined && typeof plugin.initialize !== 'function') {
        logger.warn(`Invalid plugin at ${pluginPath}: initialize must be a function if provided`);
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

      // Check for duplicate plugin name before registration
      if (this.plugins.has(plugin.metadata.name)) {
        logger.error(
          `Plugin name collision detected: "${plugin.metadata.name}" is already registered. ` +
          `Cannot load duplicate plugin from ${pluginPath}.`
        );
        throw new Error(
          `Plugin name collision: "${plugin.metadata.name}" already registered`
        );
      }

      // Check for provider name collisions before registration (atomic check)
      for (const providerName of plugin.metadata.providers) {
        const existingPlugin = this.providerMap.get(providerName);
        if (existingPlugin) {
          logger.error(
            `Provider name collision detected: "${providerName}" is already registered by plugin "${existingPlugin}". ` +
            `Plugin "${plugin.metadata.name}" cannot register the same provider name.`
          );
          throw new Error(
            `Provider name collision: "${providerName}" already registered by plugin "${existingPlugin}"`
          );
        }
      }

      // Initialize plugin (only after all validation passes)
      if (plugin.initialize) {
        await plugin.initialize();
      }

      // Register plugin atomically (all checks passed)
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
   * Verify plugin integrity using optional manifest file
   * Manifest file format (plugin-manifest.json):
   * {
   *   "sha256": "checksum of index.js file",
   *   "created": "ISO timestamp"
   * }
   */
  private async verifyPluginIntegrity(pluginPath: string, indexPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'plugin-manifest.json');

    try {
      await fs.access(manifestPath);
    } catch (error) {
      // Manifest is optional - if it doesn't exist, skip verification
      logger.debug(`No manifest found for plugin at ${pluginPath}, skipping integrity check`);
      return;
    }

    try {
      // Read manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      if (!manifest.sha256 || typeof manifest.sha256 !== 'string') {
        throw new Error('Manifest missing valid sha256 checksum');
      }

      // Calculate actual checksum of index.js
      const pluginCode = await fs.readFile(indexPath, 'utf8');
      const hash = crypto.createHash('sha256');
      hash.update(pluginCode);
      const actualChecksum = hash.digest('hex');

      // Compare checksums
      if (actualChecksum !== manifest.sha256) {
        throw new Error(
          `Plugin integrity verification failed! ` +
          `Expected: ${manifest.sha256}, Got: ${actualChecksum}. ` +
          `Plugin code may have been tampered with.`
        );
      }

      logger.info(`Plugin integrity verified: ${pluginPath}`);
    } catch (error) {
      logger.error(`Plugin integrity verification failed for ${pluginPath}`, error as Error);
      throw new Error(`Plugin integrity check failed: ${(error as Error).message}`);
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
