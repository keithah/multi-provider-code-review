#!/usr/bin/env node
/**
 * Health Check Script for Docker
 * Verifies that the application and its dependencies are working correctly
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Perform health check
 * Exits with 0 if healthy, 1 if unhealthy
 */
async function healthCheck(): Promise<void> {
  try {
    // Check 1: Verify Node.js runtime is working
    if (typeof process === 'undefined') {
      throw new Error('Node.js runtime not available');
    }

    // Check 2: Verify application files exist
    const requiredFiles = [
      'dist/index.js',
      'dist/cli/index.js',
      'package.json',
    ];

    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check 3: Verify package.json is valid JSON
    const packageJsonPath = path.resolve('package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.name || !packageJson.version) {
      throw new Error('Invalid package.json');
    }

    // Check 4: Verify cache directory is writable
    const cacheDir = process.env.CACHE_DIR || './.cache';
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      const testFile = path.join(cacheDir, '.health-check');
      await fs.writeFile(testFile, 'OK', 'utf8');
      await fs.unlink(testFile);
    } catch (error) {
      throw new Error(`Cache directory not writable: ${cacheDir}`);
    }

    // All checks passed
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Health check failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Run health check
healthCheck().catch((error) => {
  console.error('Health check error:', error);
  process.exit(1);
});

export { healthCheck };
