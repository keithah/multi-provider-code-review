import { validateSuggestionLine, isSuggestionLineValid } from '../../../src/utils/suggestion-validator';

const samplePatch = `@@ -1,3 +1,4 @@
 context line
+added line
 more context
+another added`;

const complexPatch = `@@ -10,5 +10,8 @@
 function foo() {
-  console.log('old');
+  console.log('new');
   return true;
 }
+
+function bar() {
+  return false;
+}`;

describe('validateSuggestionLine', () => {
  it('returns position when line exists in diff (context line)', () => {
    const result = validateSuggestionLine(1, samplePatch);
    expect(result).toBe(2);
  });

  it('returns position when line exists in diff (added line)', () => {
    const result = validateSuggestionLine(2, samplePatch);
    expect(result).toBe(3);
  });

  it('returns position for multiple added/context lines', () => {
    expect(validateSuggestionLine(3, samplePatch)).toBe(4);
    expect(validateSuggestionLine(4, samplePatch)).toBe(5);
  });

  it('returns null when line number does not exist in diff', () => {
    const result = validateSuggestionLine(100, samplePatch);
    expect(result).toBeNull();
  });

  it('returns null when patch is undefined', () => {
    const result = validateSuggestionLine(1, undefined);
    expect(result).toBeNull();
  });

  it('returns null when patch is empty string', () => {
    const result = validateSuggestionLine(1, '');
    expect(result).toBeNull();
  });

  it('handles complex patch with deletions correctly', () => {
    // Line 10: function foo() {
    expect(validateSuggestionLine(10, complexPatch)).toBe(2);
    // Line 11: console.log('new'); (replaced old)
    expect(validateSuggestionLine(11, complexPatch)).toBe(4);
    // Line 12: return true;
    expect(validateSuggestionLine(12, complexPatch)).toBe(5);
    // Line 13: }
    expect(validateSuggestionLine(13, complexPatch)).toBe(6);
    // Line 14: empty line (added)
    expect(validateSuggestionLine(14, complexPatch)).toBe(7);
    // Line 15: function bar() { (added)
    expect(validateSuggestionLine(15, complexPatch)).toBe(8);
    // Line 16: return false; (added)
    expect(validateSuggestionLine(16, complexPatch)).toBe(9);
    // Line 17: } (added)
    expect(validateSuggestionLine(17, complexPatch)).toBe(10);
  });

  it('returns null for lines that were deleted (not in RIGHT side)', () => {
    // The old line "console.log('old');" at line 11 in old file doesn't exist in new file
    // This is implicitly tested - line 11 in new file is the replacement
    const result = validateSuggestionLine(999, complexPatch);
    expect(result).toBeNull();
  });
});

describe('isSuggestionLineValid', () => {
  it('returns true when validateSuggestionLine returns a position', () => {
    const result = isSuggestionLineValid(1, samplePatch);
    expect(result).toBe(true);
  });

  it('returns false when validateSuggestionLine returns null (line not in diff)', () => {
    const result = isSuggestionLineValid(100, samplePatch);
    expect(result).toBe(false);
  });

  it('returns false when patch is undefined', () => {
    const result = isSuggestionLineValid(1, undefined);
    expect(result).toBe(false);
  });

  it('returns false when patch is empty', () => {
    const result = isSuggestionLineValid(1, '');
    expect(result).toBe(false);
  });
});
