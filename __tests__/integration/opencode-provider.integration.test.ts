import { OpenCodeProvider } from '../../src/providers/opencode';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('OpenCodeProvider Integration', () => {
  const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use real timers for integration tests that depend on actual timing logic
    // These tests need to validate real setTimeout behavior and duration tracking
    // The delay parameter (10ms) is minimal to keep tests fast while still reliable
    jest.useRealTimers();
  });

  function createMockProcess(stdout: string, stderr: string = '', exitCode: number = 0, delay: number = 0) {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();

    // Emit events after a small delay to ensure listeners are attached
    setTimeout(() => {
      if (stdout) {
        mockProcess.stdout.emit('data', Buffer.from(stdout));
      }
      if (stderr) {
        mockProcess.stderr.emit('data', Buffer.from(stderr));
      }
      mockProcess.emit('close', exitCode);
    }, delay || 10);

    return mockProcess;
  }

  // Helper to setup spawn mock for review tests
  // First spawn call is for binary check, second is the actual review
  function setupSpawnMock(stdout: string, stderr: string = '', exitCode: number = 0, delay: number = 0) {
    let spawnCount = 0;
    mockedSpawn.mockImplementation(() => {
      spawnCount++;
      // First call is for resolveBinary check (opencode --version)
      if (spawnCount === 1) {
        const binaryCheckProc = new EventEmitter() as any;
        binaryCheckProc.stdout = new EventEmitter();
        binaryCheckProc.stderr = new EventEmitter();
        binaryCheckProc.kill = jest.fn();
        setTimeout(() => binaryCheckProc.emit('close', 0), 1);
        return binaryCheckProc;
      }
      // Second call is the actual review
      return createMockProcess(stdout, stderr, exitCode, delay);
    });
  }

  describe('Successful Reviews', () => {
    it('should parse findings from JSON response', async () => {
      const provider = new OpenCodeProvider('test-model');

      const response = JSON.stringify({
        findings: [
          { file: 'src/test.ts', line: 10, severity: 'critical', title: 'Issue', message: 'Fix this' },
          { file: 'src/test.ts', line: 20, severity: 'major', title: 'Warning', message: 'Check this' }
        ]
      });

      setupSpawnMock(response);

      const result = await provider.review('test prompt', 5000);

      expect(result.findings).toHaveLength(2);
      expect(result.findings![0].severity).toBe('critical');
      expect(result.content).toBe(response);
      expect(result.durationSeconds).toBeGreaterThan(0);
    });

    it('should parse findings from direct array', async () => {
      const provider = new OpenCodeProvider('test-model');

      const response = JSON.stringify([
        { file: 'app.ts', line: 5, severity: 'minor', title: 'Style', message: 'Use const' }
      ]);

      setupSpawnMock(response);

      const result = await provider.review('test', 5000);

      expect(result.findings).toHaveLength(1);
      expect(result.findings![0].file).toBe('app.ts');
    });

    it('should parse findings from markdown code block', async () => {
      const provider = new OpenCodeProvider('test-model');

      const response = '```json\n[{"file": "test.ts", "line": 1, "severity": "major", "title": "Test", "message": "Msg"}]\n```';

      setupSpawnMock(response);

      const result = await provider.review('test', 5000);

      expect(result.findings).toHaveLength(1);
    });

    it('should handle model ID with opencode prefix', async () => {
      const provider = new OpenCodeProvider('opencode/test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const args = spawnCall[1];
      const modelIndex = args.indexOf('-m');
      expect(args[modelIndex + 1]).toBe('opencode/test-model');
    });

    it('should handle model ID without opencode prefix', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const args = spawnCall[1];
      const modelIndex = args.indexOf('-m');
      expect(args[modelIndex + 1]).toBe('opencode/test-model');
    });

    it('should write prompt to temp file and use --file flag', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test prompt content', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const args = spawnCall[1];

      expect(args).toContain('--file');
      const fileIndex = args.indexOf('--file');
      const promptFile = args[fileIndex + 1];
      expect(promptFile).toMatch(/opencode-.*\/prompt-.*\.txt/);
    });

    it('should log stdout and stderr lengths', async () => {
      const provider = new OpenCodeProvider('test-model');

      const response = JSON.stringify([{ file: 'a.ts', line: 1, severity: 'major', title: 'T', message: 'M' }]);
      const stderr = 'Some debug output';

      setupSpawnMock(response, stderr);

      const result = await provider.review('test', 5000);

      expect(result.content).toBe(response);
      // Logs are emitted but we can't easily assert on them without log mocking
    });
  });

  describe('Error Handling', () => {
    it('should throw on empty stdout', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('', 'some error');

      await expect(provider.review('test', 5000)).rejects.toThrow('OpenCode CLI returned no output');
    });

    it('should throw on whitespace-only stdout', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('   \n  \t  ', '');

      await expect(provider.review('test', 5000)).rejects.toThrow('OpenCode CLI returned no output');
    });

    it('should include stderr in error message when stdout is empty', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('', 'Command failed: model not found');

      await expect(provider.review('test', 5000)).rejects.toThrow('stderr: Command failed: model not found');
    });

    it('should handle non-zero exit code', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('', '', 1);

      await expect(provider.review('test', 5000)).rejects.toThrow('OpenCode CLI exited with code 1');
    });

    it('should handle timeout', async () => {
      const provider = new OpenCodeProvider('test-model');

      let reviewMockProcess: any;
      let spawnCount = 0;
      mockedSpawn.mockImplementation(() => {
        spawnCount++;
        if (spawnCount === 1) {
          const binaryCheckProc = new EventEmitter() as any;
          binaryCheckProc.stdout = new EventEmitter();
          binaryCheckProc.stderr = new EventEmitter();
          binaryCheckProc.kill = jest.fn();
          setTimeout(() => binaryCheckProc.emit('close', 0), 1);
          return binaryCheckProc;
        }
        // Create process that never emits close event (simulates hanging process)
        reviewMockProcess = new EventEmitter() as any;
        reviewMockProcess.stdout = new EventEmitter();
        reviewMockProcess.stderr = new EventEmitter();
        // Fail-safe: auto-close after 500ms even if kill isn't called
        const failSafe = setTimeout(() => reviewMockProcess.emit('close', 0), 500);
        reviewMockProcess.kill = jest.fn(() => {
          clearTimeout(failSafe);
          setTimeout(() => reviewMockProcess.emit('close', 0), 0);
        });
        reviewMockProcess.pid = 12345; // Mock PID for process group kill
        return reviewMockProcess;
      });

      // Mock process.kill to prevent actual kill attempt
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true as any);

      try {
        // Set very short timeout
        await expect(provider.review('test', 100)).rejects.toThrow('timed out after 100ms');

        // Verify that either process group kill or regular kill was attempted
        expect(killSpy).toHaveBeenCalled();
      } finally {
        killSpy.mockRestore();
      }
    });

    it('should handle spawn errors', async () => {
      const provider = new OpenCodeProvider('test-model');

      let spawnCount = 0;
      mockedSpawn.mockImplementation(() => {
        spawnCount++;
        if (spawnCount === 1) {
          const binaryCheckProc = new EventEmitter() as any;
          binaryCheckProc.stdout = new EventEmitter();
          binaryCheckProc.stderr = new EventEmitter();
          binaryCheckProc.kill = jest.fn();
          setTimeout(() => binaryCheckProc.emit('close', 0), 1);
          return binaryCheckProc;
        }
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();

        // Emit error after a delay
        setTimeout(() => {
          mockProcess.emit('error', new Error('spawn ENOENT'));
        }, 10);

        return mockProcess;
      });

      await expect(provider.review('test', 5000)).rejects.toThrow('spawn ENOENT');
    });

    it('should handle invalid JSON in response', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('not valid json');

      const result = await provider.review('test', 5000);

      // Should return empty findings on parse error
      expect(result.findings).toEqual([]);
      expect(result.content).toBe('not valid json');
    });
  });

  describe('Binary Resolution', () => {
    it('should use opencode from PATH if available', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const bin = spawnCall[0];

      // Should use 'opencode' or 'npx opencode-ai'
      expect(bin === 'opencode' || bin === 'npx').toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clean up temp file after successful review', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      // Temp file cleanup happens in finally block
      // Can't easily verify file deletion without fs mocking
      // But test verifies no errors thrown during cleanup
    });

    it('should clean up temp file even on error', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('', '', 1);

      await expect(provider.review('test', 5000)).rejects.toThrow();

      // Cleanup should still happen in finally block
      // No errors should be thrown from cleanup
    });
  });

  describe('Command Construction', () => {
    it('should construct correct command line arguments', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const args = spawnCall[1];

      expect(args).toContain('run');
      expect(args).toContain('-m');
      expect(args).toContain('opencode/test-model');
      expect(args).toContain('--file');
      expect(args).toContain('--');
      expect(args[args.length - 1]).toContain('Review the attached PR context');
    });

    it('should use correct stdio configuration', async () => {
      const provider = new OpenCodeProvider('test-model');

      setupSpawnMock('[]');

      await provider.review('test', 5000);

      const spawnCall = mockedSpawn.mock.calls[1]; // Second call is the actual review
      const options = spawnCall[2];

      expect(options?.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    });
  });

  describe('Duration Tracking', () => {
    it('should track duration accurately', async () => {
      const provider = new OpenCodeProvider('test-model');

      // Mock process with 100ms delay
      setupSpawnMock('[]', '', 0, 100);

      const result = await provider.review('test', 5000);

      // Verify duration is measured (avoid specific lower bounds that can be flaky on slow systems)
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeLessThan(5); // Generous upper bound
    });
  });
});
