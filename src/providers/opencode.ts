import { Provider } from './base';
import { ReviewResult } from '../types';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export class OpenCodeProvider extends Provider {
  constructor(private readonly modelId: string) {
    super(`opencode/${modelId}`);
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const started = Date.now();

    const { bin, args: baseArgs } = await this.resolveBinary();
    const cliModel = this.modelId.startsWith('opencode/')
      ? this.modelId
      : `opencode/${this.modelId}`;

    // Write prompt to temp file to avoid command line length limits
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-'));
    const promptFile = path.join(tmpDir, `prompt-${crypto.randomBytes(8).toString('hex')}.txt`);
    await fs.writeFile(promptFile, prompt, { encoding: 'utf8', mode: 0o600 });

    const args = [...baseArgs, 'run', '-m', cliModel, '--file', promptFile, '--', 'Review the attached PR context and provide structured findings.'];

    logger.info(`Running OpenCode CLI: ${bin} ${args.slice(0, 3).join(' ')} …`);

    try {
      const { stdout, stderr } = await this.runCli(bin, args, timeoutMs);
      const content = stdout.trim();
      const durationSeconds = (Date.now() - started) / 1000;
      logger.info(
        `OpenCode CLI output for ${this.name}: stdout=${stdout.length} bytes, stderr=${stderr.length} bytes, duration=${durationSeconds.toFixed(1)}s`
      );
      if (!content) {
        throw new Error(`OpenCode CLI returned no output${stderr ? `; stderr: ${stderr.slice(0, 200)}` : ''}`);
      }
      return {
        content,
        durationSeconds,
        findings: this.extractFindings(content),
      };
    } catch (error) {
      logger.error(`OpenCode provider failed: ${this.name}`, error as Error);
      throw error;
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(promptFile);
        await fs.rmdir(tmpDir);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  private runCli(bin: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
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
          reject(new Error(`OpenCode CLI exited with code ${code}: ${stderr || stdout || 'no output'}`));
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
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
        if (Array.isArray(parsed)) return parsed;
        return parsed.findings || [];
      }
    } catch (error) {
      logger.debug('Failed to parse findings from OpenCode response', error as Error);
    }
    return [];
  }
}
