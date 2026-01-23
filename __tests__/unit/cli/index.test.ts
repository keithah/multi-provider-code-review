import { CLI } from '../../../src/cli/index';
import { GitReader } from '../../../src/cli/git-reader';
import { TerminalFormatter } from '../../../src/cli/formatter';

jest.mock('../../../src/cli/git-reader');
jest.mock('../../../src/cli/formatter');
jest.mock('../../../src/setup');

describe('CLI', () => {
  let cli: CLI;
  let mockGitReader: jest.Mocked<GitReader>;
  let mockFormatter: jest.Mocked<TerminalFormatter>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGitReader = {
      isGitRepo: jest.fn().mockReturnValue(true),
      getUncommittedChanges: jest.fn(),
      getCommitChanges: jest.fn(),
      getBranchChanges: jest.fn(),
    } as any;

    mockFormatter = {
      formatMessage: jest.fn((msg) => msg),
      format: jest.fn().mockReturnValue('formatted output'),
      getExitCode: jest.fn().mockReturnValue(0),
    } as any;

    (GitReader as unknown as jest.Mock).mockImplementation(() => mockGitReader);
    (TerminalFormatter as unknown as jest.Mock).mockImplementation(() => mockFormatter);

    cli = new CLI();
  });

  describe('parseArgs', () => {
    it('parses help command', () => {
      const result = (cli as any).parseArgs(['help']);
      expect(result.command).toBe('help');
      expect(result.target).toBeUndefined();
      expect(result.options).toEqual({});
    });

    it('parses version command', () => {
      const result = (cli as any).parseArgs(['version']);
      expect(result.command).toBe('version');
    });

    it('parses review command with no target', () => {
      const result = (cli as any).parseArgs(['review']);
      expect(result.command).toBe('review');
      expect(result.target).toBeUndefined();
    });

    it('parses review command with commit target', () => {
      const result = (cli as any).parseArgs(['review', 'HEAD~1']);
      expect(result.command).toBe('review');
      expect(result.target).toBe('HEAD~1');
    });

    it('parses review command with branch range', () => {
      const result = (cli as any).parseArgs(['review', 'main..feature']);
      expect(result.command).toBe('review');
      expect(result.target).toBe('main..feature');
    });

    it('parses review command with options', () => {
      const result = (cli as any).parseArgs(['review', '--dry-run']);
      expect(result.command).toBe('review');
      expect(result.options).toEqual({ 'dry-run': true });
    });

    it('parses review command with target and options', () => {
      const result = (cli as any).parseArgs(['review', 'HEAD~1', '--dry-run']);
      expect(result.command).toBe('review');
      expect(result.target).toBe('HEAD~1');
      expect(result.options).toEqual({ 'dry-run': true });
    });

    it('parses short options', () => {
      const result = (cli as any).parseArgs(['review', '-d']);
      expect(result.command).toBe('review');
      expect(result.options).toEqual({ d: true });
    });

    it('parses long options with values', () => {
      const result = (cli as any).parseArgs(['review', '--config=custom.yml']);
      expect(result.command).toBe('review');
      expect(result.options).toEqual({ config: 'custom.yml' });
    });
  });

  describe('run', () => {
    it('returns 0 for help command', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await cli.run(['help']);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('returns 0 for version command', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await cli.run(['version']);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('returns 1 when not in git repo', async () => {
      mockGitReader.isGitRepo.mockReturnValue(false);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const exitCode = await cli.run(['review']);

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('returns 1 for unknown command', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const exitCode = await cli.run(['unknown']);

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('showHelp', () => {
    it('displays help message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (cli as any).showHelp();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Multi-Provider Code Review CLI'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('mpr review'));

      consoleSpy.mockRestore();
    });
  });

  describe('showVersion', () => {
    it('displays version', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (cli as any).showVersion();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('multi-provider-code-review'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2.0.0'));

      consoleSpy.mockRestore();
    });
  });
});
