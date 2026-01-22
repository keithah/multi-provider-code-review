import { Provider } from './base';
import { ReviewResult } from '../types';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';

export class OpenCodeProvider extends Provider {
  constructor(private readonly modelId: string) {
    super(`opencode/${modelId}`);
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const started = Date.now();

    const { bin, args: baseArgs } = await this.resolveBinary();
    const args = [...baseArgs, 'run', '-m', this.modelId, '--', prompt];

    logger.info(`Running OpenCode CLI: ${bin} ${args.slice(0, 3).join(' ')} …`);

    try {
      const content = await this.runCli(bin, args, timeoutMs);
      const durationSeconds = (Date.now() - started) / 1000;
      return {
        content,
        durationSeconds,
        findings: this.extractFindings(content),
      };
    } catch (error) {
      logger.error(`OpenCode provider failed: ${this.name}`, error as Error);
      throw error;
    }
  }

  private runCli(bin: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`OpenCode CLI timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`OpenCode CLI exited with code ${code}: ${stderr || stdout}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  private async resolveBinary(): Promise<{ bin: string; args: string[] }> {
    if (await this.canRun('opencode', ['--version'])) {
      return { bin: 'opencode', args: [] };
    }
    if (await this.canRun('npx', ['--yes', 'opencode-ai', '--version'])) {
      return { bin: 'npx', args: ['--yes', 'opencode-ai'] };
    }
    throw new Error('OpenCode CLI is not available (opencode or npx opencode-ai)');
  }

  private async canRun(cmd: string, args: string[]): Promise<boolean> {
    return new Promise(resolve => {
      const proc = spawn(cmd, args, { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('close', code => resolve(code === 0));
    });
  }

  private extractFindings(content: string): any[] {
    try {
      const match = content.match(/```json\s*([\s\S]*?)```/i);
      if (match) {
        const parsed = JSON.parse(match[1]);
        return parsed.findings || [];
      }
    } catch (error) {
      logger.debug('Failed to parse findings from OpenCode response', error as Error);
    }
    return [];
  }
}
