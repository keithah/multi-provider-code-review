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

  // Lightweight health check: verify CLI is available; skip full review run
  async healthCheck(_timeoutMs: number = 5000): Promise<boolean> {
    const timeoutMs = Math.max(1, _timeoutMs ?? 5000);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`OpenCode health check timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      await Promise.race([this.resolveBinary(), timeoutPromise]);
      return true;
    } catch (error) {
      logger.warn(`OpenCode health check failed for ${this.name}: ${(error as Error).message}`);
      return false;
    }
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const started = Date.now();

    const { bin, args: baseArgs } = await this.resolveBinary();
    const cliModel = this.modelId.startsWith('opencode/')
      ? this.modelId
      : `opencode/${this.modelId}`;

    // Write prompt to temp file to avoid command line length limits
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-'));
    await fs.chmod(tmpDir, 0o700);
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
      // Use detached: true to create a new process group
      // This allows killing the entire process tree when needed
      const proc = spawn(bin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });

      // Unref to avoid keeping parent alive (if available)
      if (proc.unref) {
        proc.unref();
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        logger.warn(`OpenCode CLI timeout (${timeoutMs}ms), killing process and all children`);

        // Kill the entire process group to ensure child processes are terminated
        // On Unix: negative PID kills the process group
        try {
          if (proc.pid) {
            process.kill(-proc.pid, 'SIGKILL');
          }
        } catch (err) {
          // Fallback: kill just the main process
          proc.kill('SIGKILL');
        }

        reject(new Error(`OpenCode CLI timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });
      proc.on('error', err => {
        if (!timedOut) {
          clearTimeout(timer);
          reject(err);
        }
      });
      proc.on('close', code => {
        if (!timedOut) {
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`OpenCode CLI exited with code ${code}: ${stderr || stdout || 'no output'}`));
          } else {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
          }
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
      // Try markdown code block first
      const match = content.match(/```json\s*([\s\S]*?)```/i);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) return parsed;
        return parsed.findings || [];
      }

      // Fallback: try parsing as plain JSON
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      return parsed.findings || [];
    } catch (error) {
      logger.debug('Failed to parse findings from OpenCode response', error as Error);
    }
    return [];
  }
}
