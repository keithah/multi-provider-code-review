import { Provider } from './base';
import { ReviewResult } from '../types';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export class ClaudeCodeProvider extends Provider {
  constructor(private readonly model: string) {
    super(`claude/${model}`);
  }

  // Lightweight health check: verify CLI is available
  async healthCheck(_timeoutMs: number = 5000): Promise<boolean> {
    const timeoutMs = Math.max(500, _timeoutMs ?? 5000);

    let timeoutId: NodeJS.Timeout;
    let isTimedOut = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(new Error(`Claude Code health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([
        this.resolveBinary().then(() => {
          if (isTimedOut) {
            logger.debug(`Claude Code binary resolved after timeout (${this.name})`);
          }
        }),
        timeoutPromise
      ]);
      clearTimeout(timeoutId!);
      return true;
    } catch (error) {
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }
      logger.warn(`Claude Code health check failed for ${this.name}: ${(error as Error).message}`);
      return false;
    }
  }

  async review(prompt: string, timeoutMs: number): Promise<ReviewResult> {
    const started = Date.now();

    const binary = await this.resolveBinary();

    // Write prompt to temp file to avoid command line length limits
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-code-'));
    await fs.chmod(tmpDir, 0o700);
    const promptFile = path.join(tmpDir, `prompt-${crypto.randomBytes(8).toString('hex')}.txt`);
    await fs.writeFile(promptFile, prompt, { encoding: 'utf8', mode: 0o600 });

    // Claude Code CLI command:
    // claude --model <model> --print --no-session-persistence --output-format json <prompt-file>
    const args = [
      '--model', this.model,
      '--print',
      '--no-session-persistence',
      '--output-format', 'json',
      promptFile
    ];

    logger.info(`Running Claude Code CLI: ${binary} --model ${this.model} --print ...`);

    try {
      const { stdout, stderr } = await this.runCli(binary, args, timeoutMs);
      const content = stdout.trim();
      const durationSeconds = (Date.now() - started) / 1000;
      logger.info(
        `Claude Code CLI output for ${this.name}: stdout=${stdout.length} bytes, stderr=${stderr.length} bytes, duration=${durationSeconds.toFixed(1)}s`
      );
      if (!content) {
        throw new Error(`Claude Code CLI returned no output${stderr ? `; stderr: ${stderr.slice(0, 200)}` : ''}`);
      }
      return {
        content,
        durationSeconds,
        findings: this.extractFindings(content),
      };
    } catch (error) {
      logger.error(`Claude Code provider failed: ${this.name}`, error as Error);
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
        env: process.env,
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
        logger.warn(`Claude Code CLI timeout (${timeoutMs}ms), killing process and all children`);

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

        reject(new Error(`Claude Code CLI timed out after ${timeoutMs}ms`));
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
            reject(new Error(`Claude Code CLI exited with code ${code}: ${stderr || stdout || 'no output'}`));
          } else {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
          }
        }
      });
    });
  }

  private async resolveBinary(): Promise<string> {
    // Try claude command directly
    if (await this.canRun('claude', ['--version'])) {
      return 'claude';
    }
    // Try /usr/local/bin/claude
    if (await this.canRun('/usr/local/bin/claude', ['--version'])) {
      return '/usr/local/bin/claude';
    }
    // Try ~/.local/bin/claude
    const homeDir = os.homedir();
    const localBin = path.join(homeDir, '.local', 'bin', 'claude');
    if (await this.canRun(localBin, ['--version'])) {
      return localBin;
    }
    throw new Error('Claude Code CLI is not available (tried: claude, /usr/local/bin/claude, ~/.local/bin/claude)');
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
      logger.debug('Failed to parse findings from Claude Code response', error as Error);
    }
    return [];
  }
}
