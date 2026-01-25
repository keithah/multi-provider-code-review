# Plugin Development Guide

Create custom LLM provider plugins for Multi-Provider Code Review.

## Overview

The plugin system allows you to integrate custom LLM providers without modifying the core codebase. Plugins are dynamically loaded at runtime and can provide one or more review providers.

## Quick Start

### 1. Create Plugin Directory

```bash
mkdir -p plugins/my-custom-provider
cd plugins/my-custom-provider
```

### 2. Create Plugin Entry Point

Create `index.js` (or `index.ts` and compile to JS):

```typescript
// index.js
const { Plugin } = require('../../src/plugins/plugin-loader');

/**
 * Plugin metadata
 */
const metadata = {
  name: 'my-custom-provider',
  version: '1.0.0',
  description: 'Custom LLM provider integration',
  author: 'Your Name',
  providers: ['custom/my-model', 'custom/another-model'],
};

/**
 * Custom provider implementation
 */
class CustomProvider {
  constructor(model, apiKey) {
    this.name = model;
    this.model = model;
    this.apiKey = apiKey;
  }

  async review(prompt, timeoutMs) {
    // Make API call to your custom LLM
    const response = await fetch('https://api.custom-llm.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a code reviewer.' },
          { role: 'user', content: prompt },
        ],
        model: this.model,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }
}

/**
 * Plugin initialization (optional)
 */
async function initialize() {
  console.log(`Initializing plugin: ${metadata.name}`);
  // Validate API keys, test connections, etc.
}

/**
 * Provider factory
 */
function createProvider(model, apiKey) {
  return new CustomProvider(model, apiKey);
}

/**
 * Plugin export
 */
module.exports = {
  metadata,
  initialize,
  createProvider,
};
```

### 3. Enable Plugin

Edit `.env`:

```bash
PLUGINS_ENABLED=true
PLUGIN_DIR=./plugins
PLUGIN_API_KEY=your_custom_api_key_here
```

### 4. Use Plugin Provider

```bash
REVIEW_PROVIDERS=custom/my-model,custom/another-model
```

## Plugin Interface

### Metadata

```typescript
interface PluginMetadata {
  name: string;           // Unique plugin identifier
  version: string;        // Semantic version (e.g., "1.0.0")
  description: string;    // Brief description
  author?: string;        // Plugin author
  providers: string[];    // List of provider names this plugin provides
}
```

### Plugin Structure

```typescript
interface Plugin {
  metadata: PluginMetadata;
  initialize?: () => Promise<void> | void;  // Optional setup
  createProvider: (model: string, apiKey: string) => Provider;
}
```

### Provider Interface

Your provider must implement:

```typescript
interface Provider {
  name: string;           // Provider identifier
  review(prompt: string, timeoutMs: number): Promise<ReviewResult>;
}

interface ReviewResult {
  content: string;        // LLM response text
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationSeconds?: number;
  findings?: Finding[];   // Optional: pre-parsed findings
  aiLikelihood?: number;  // Optional: AI detection score
}
```

## Examples

### Example 1: OpenAI-Compatible API

```typescript
// plugins/openai-compatible/index.js
class OpenAICompatibleProvider {
  constructor(model, apiKey, baseURL = 'https://api.openai.com/v1') {
    this.name = model;
    this.model = model;
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async review(prompt, timeoutMs) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Analyze the code and provide structured feedback.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      },
    };
  }
}

module.exports = {
  metadata: {
    name: 'openai-compatible',
    version: '1.0.0',
    description: 'OpenAI-compatible API provider',
    providers: ['openai/gpt-4', 'openai/gpt-3.5-turbo'],
  },
  createProvider: (model, apiKey) => new OpenAICompatibleProvider(model, apiKey),
};
```

### Example 2: Anthropic Claude

```typescript
// plugins/anthropic/index.js
const Anthropic = require('@anthropic-ai/sdk');

class AnthropicProvider {
  constructor(model, apiKey) {
    this.name = model;
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async review(prompt, timeoutMs) {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      timeout: timeoutMs,
    });

    return {
      content: message.content[0].text,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
  }
}

module.exports = {
  metadata: {
    name: 'anthropic',
    version: '1.0.0',
    description: 'Anthropic Claude API provider',
    providers: ['anthropic/claude-3-5-sonnet-20241022', 'anthropic/claude-3-opus-20240229'],
  },
  createProvider: (model, apiKey) => new AnthropicProvider(model, apiKey),
};
```

### Example 3: Self-Hosted Model

```typescript
// plugins/self-hosted/index.js
class SelfHostedProvider {
  constructor(model, apiKey) {
    this.name = model;
    this.model = model;
    this.apiKey = apiKey;
    this.baseURL = process.env.SELF_HOSTED_URL || 'http://localhost:8000';
  }

  async review(prompt, timeoutMs) {
    const response = await fetch(`${this.baseURL}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        prompt: `Review this code:\n\n${prompt}`,
        max_tokens: 4096,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const data = await response.json();

    return {
      content: data.choices[0].text,
      usage: {
        promptTokens: 0,  // Self-hosted may not track tokens
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}

module.exports = {
  metadata: {
    name: 'self-hosted',
    version: '1.0.0',
    description: 'Self-hosted LLM provider',
    providers: ['self-hosted/llama3', 'self-hosted/mistral'],
  },
  initialize: async () => {
    console.log('Checking self-hosted model availability...');
  },
  createProvider: (model, apiKey) => new SelfHostedProvider(model, apiKey),
};
```

## Plugin Security

### ⚠️ Important Security Considerations

1. **Plugins execute arbitrary code** - Only load plugins from trusted sources
2. **Plugins have full system access** - They run with the same permissions as the main process
3. **API keys are passed to plugins** - Ensure plugins handle credentials securely
4. **Network access** - Plugins can make arbitrary network requests

### Best Practices

#### 1. Validate Plugin Structure

```typescript
async function initialize() {
  // Validate environment
  if (!process.env.CUSTOM_API_KEY) {
    throw new Error('CUSTOM_API_KEY environment variable is required');
  }

  // Test API connectivity
  try {
    await fetch('https://api.custom-llm.com/health');
  } catch (error) {
    throw new Error('Unable to reach custom LLM API');
  }
}
```

#### 2. Handle Errors Gracefully

```typescript
async review(prompt, timeoutMs) {
  try {
    const response = await fetch(/* ... */);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

#### 3. Sanitize Inputs

```typescript
async review(prompt, timeoutMs) {
  // Validate timeout
  if (timeoutMs < 1000 || timeoutMs > 300000) {
    throw new Error('Invalid timeout value');
  }

  // Sanitize prompt
  const sanitizedPrompt = prompt.slice(0, 100000); // Limit size

  // ...
}
```

#### 4. Log Responsibly

```typescript
async review(prompt, timeoutMs) {
  console.log(`Reviewing with ${this.model}`);
  // ❌ DON'T log API keys or sensitive data
  // console.log(`API key: ${this.apiKey}`);  // NEVER DO THIS

  // ✅ Log only necessary info
  console.log(`Request size: ${prompt.length} chars`);
}
```

## Plugin Configuration

### Allowlist/Blocklist

Control which plugins can load:

```bash
# Only allow specific plugins
PLUGIN_ALLOWLIST=my-custom-provider,another-plugin

# Block specific plugins
PLUGIN_BLOCKLIST=untrusted-plugin
```

### Plugin Directory

```bash
# Default: ./plugins
PLUGIN_DIR=/opt/mpr-plugins

# Multiple directories (not yet supported)
# Future: PLUGIN_DIRS=/opt/plugins:/usr/local/plugins
```

### Per-Plugin Configuration

Use environment variables:

```bash
# Generic plugin API key
PLUGIN_API_KEY=sk-xxxx

# Plugin-specific keys
MY_CUSTOM_PROVIDER_API_KEY=sk-yyyy
ANTHROPIC_API_KEY=sk-ant-zzzz
```

Access in plugin:

```typescript
const apiKey = process.env.MY_CUSTOM_PROVIDER_API_KEY || apiKey;
```

## Testing Plugins

### Unit Tests

```typescript
// plugins/my-provider/__tests__/provider.test.js
const { createProvider } = require('../index');

describe('CustomProvider', () => {
  it('should create provider instance', () => {
    const provider = createProvider('custom/model', 'test-key');
    expect(provider.name).toBe('custom/model');
  });

  it('should handle review requests', async () => {
    const provider = createProvider('custom/model', 'test-key');

    // Mock API response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Review response' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      })
    );

    const result = await provider.review('test prompt', 30000);
    expect(result.content).toBe('Review response');
    expect(result.usage.totalTokens).toBe(150);
  });
});
```

### Integration Testing

```bash
# Test plugin loading
PLUGINS_ENABLED=true \
PLUGIN_DIR=./plugins \
node dist/cli/index.js review HEAD~1
```

## Deployment

### Docker

Add plugins to Docker image:

```dockerfile
# Copy plugins
COPY plugins /app/plugins

# Set plugin directory
ENV PLUGIN_DIR=/app/plugins
ENV PLUGINS_ENABLED=true
```

### Distribution

#### Option 1: NPM Package

```json
// package.json
{
  "name": "@yourorg/mpr-custom-provider",
  "version": "1.0.0",
  "main": "index.js",
  "files": ["index.js"],
  "peerDependencies": {
    "multi-provider-code-review": "^2.0.0"
  }
}
```

#### Option 2: Git Repository

```bash
# Install from git
git clone https://github.com/yourorg/mpr-custom-provider.git plugins/custom-provider
```

#### Option 3: Direct Copy

```bash
# Copy to plugins directory
cp -r /path/to/custom-provider plugins/
```

## Troubleshooting

### Plugin Not Loading

```bash
# Check plugin directory
ls -la plugins/

# Verify index.js exists
ls -la plugins/my-provider/index.js

# Check logs
LOG_LEVEL=debug npm start
```

### API Errors

```typescript
// Add detailed error logging
async review(prompt, timeoutMs) {
  try {
    const response = await fetch(/* ... */);

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

### Timeout Issues

```typescript
// Adjust timeout handling
async review(prompt, timeoutMs) {
  // Add buffer for network overhead
  const apiTimeout = Math.max(timeoutMs - 5000, 10000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), apiTimeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // ...
    });
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Support

For plugin development help:
- Example plugins: `src/plugins/example-plugin.ts`
- GitHub Issues: https://github.com/keithah/multi-provider-code-review/issues
- Provider interface: `src/providers/base.ts`

## License

Plugins must be compatible with the MIT license of the main project.
