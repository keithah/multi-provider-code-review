import {
  formatSuggestionBlock,
  countMaxConsecutiveBackticks,
} from '../../../src/utils/suggestion-formatter';

describe('countMaxConsecutiveBackticks', () => {
  it('returns 0 for string with no backticks', () => {
    expect(countMaxConsecutiveBackticks('hello world')).toBe(0);
  });

  it('returns 1 for single backtick', () => {
    expect(countMaxConsecutiveBackticks('const x = `template`;')).toBe(1);
  });

  it('returns 3 for triple backticks', () => {
    expect(countMaxConsecutiveBackticks('```typescript\ncode\n```')).toBe(3);
  });

  it('returns 4 for quadruple backticks', () => {
    expect(countMaxConsecutiveBackticks('````nested````')).toBe(4);
  });

  it('returns max count when multiple sequences exist', () => {
    expect(countMaxConsecutiveBackticks('`single` and ```triple```')).toBe(3);
  });

  it('handles empty string', () => {
    expect(countMaxConsecutiveBackticks('')).toBe(0);
  });
});

describe('formatSuggestionBlock', () => {
  it('formats simple single-line code', () => {
    const result = formatSuggestionBlock('const x = 1;');
    expect(result).toBe('```suggestion\nconst x = 1;\n```');
  });

  it('formats code with single backticks using triple delimiter', () => {
    const result = formatSuggestionBlock('const x = `template`;');
    expect(result).toBe('```suggestion\nconst x = `template`;\n```');
  });

  it('formats code with triple backticks using quadruple delimiter', () => {
    const content = '```typescript\ncode\n```';
    const result = formatSuggestionBlock(content);
    expect(result).toBe('````suggestion\n```typescript\ncode\n```\n````');
  });

  it('formats code with quadruple backticks using quintuple delimiter', () => {
    const content = '````nested````';
    const result = formatSuggestionBlock(content);
    expect(result).toBe('`````suggestion\n````nested````\n`````');
  });

  it('returns empty string for empty input', () => {
    expect(formatSuggestionBlock('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(formatSuggestionBlock('   ')).toBe('');
    expect(formatSuggestionBlock('\n\t  ')).toBe('');
  });

  it('preserves trailing newlines in content', () => {
    const result = formatSuggestionBlock('const x = 1;\n');
    expect(result).toBe('```suggestion\nconst x = 1;\n\n```');
  });

  it('handles multi-line content', () => {
    const content = 'function test() {\n  return true;\n}';
    const result = formatSuggestionBlock(content);
    expect(result).toBe('```suggestion\nfunction test() {\n  return true;\n}\n```');
  });

  it('handles content with mixed backtick sequences', () => {
    const content = 'const a = `x`;\nconst b = ```y```;';
    const result = formatSuggestionBlock(content);
    // Max backticks is 3, so needs 4
    expect(result).toBe('````suggestion\nconst a = `x`;\nconst b = ```y```;\n````');
  });
});
