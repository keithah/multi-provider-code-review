/**
 * Example Plugin
 * Template for creating custom provider plugins
 *
 * To create your own plugin:
 * 1. Copy this file to a new directory in the plugins folder
 * 2. Modify the metadata and provider implementation
 * 3. Build with: tsc src/plugins/your-plugin/index.ts --outDir plugins/your-plugin
 * 4. Deploy to PLUGIN_DIR specified in config
 */

import { Plugin, PluginMetadata } from './plugin-loader';
import { Provider } from '../providers/base';
import { ReviewResult } from '../types';
import { logger } from '../utils/logger';

/**
 * Plugin metadata
 */
const metadata: PluginMetadata = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin demonstrating custom provider integration',
  author: 'Your Name',
  providers: ['custom/my-model'],
};

/**
 * Custom provider implementation
 */
class CustomProvider implements Provider {
  name: string;
  model: string;

  constructor(model: string, private readonly apiKey: string) {
    this.name = model;
    this.model = model;
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    logger.info(`Custom provider ${this.model} reviewing code (timeout: ${timeoutMs}ms)`);

    try {
      // TODO: Implement your custom LLM API call here
      // Example structure:
      //
      // const response = await fetch('https://api.custom-llm.com/v1/chat', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     messages: [
      //       { role: 'system', content: systemPrompt },
      //       { role: 'user', content: prompt },
      //     ],
      //     model: this.model,
      //   }),
      // });
      //
      // const data = await response.json();
      //
      // return {
      //   content: data.choices[0].message.content,
      //   usage: {
      //     promptTokens: data.usage.prompt_tokens,
      //     completionTokens: data.usage.completion_tokens,
      //     totalTokens: data.usage.total_tokens,
      //   },
      // };

      // Placeholder response
      return {
        content: 'Custom provider response would go here',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error(`Custom provider ${this.model} failed`, error as Error);
      throw error;
    }
  }
}

/**
 * Plugin initialization (optional)
 */
async function initialize(): Promise<void> {
  logger.info(`Initializing plugin: ${metadata.name}`);
  // Perform any setup tasks here (validate API keys, test connections, etc.)
}

/**
 * Provider factory
 */
function createProvider(model: string, apiKey: string): Provider {
  return new CustomProvider(model, apiKey);
}

/**
 * Plugin export
 */
const plugin: Plugin = {
  metadata,
  initialize,
  createProvider,
};

export default plugin;
