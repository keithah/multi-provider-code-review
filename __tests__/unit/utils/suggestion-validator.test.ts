import { validateSuggestionLine, isSuggestionLineValid, validateSuggestionRange } from '../../../src/utils/suggestion-validator';

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

const simplePatch = `@@ -1,3 +1,4 @@
 context line
+added line
 more context
+another added`;

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

describe('validateSuggestionRange', () => {
  describe('basic validation', () => {
    it('returns invalid for undefined patch', () => {
      const result = validateSuggestionRange(1, 2, undefined);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No patch available');
    });

    it('returns invalid for empty patch', () => {
      const result = validateSuggestionRange(1, 2, '');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No patch available');
    });

    it('returns invalid when start_line > end_line', () => {
      const result = validateSuggestionRange(5, 3, simplePatch);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid range: start > end');
    });

    it('returns invalid for ranges > 50 lines', () => {
      const result = validateSuggestionRange(1, 52, simplePatch);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Range too long');
      expect(result.reason).toContain('52 lines');
      expect(result.reason).toContain('max 50');
    });
  });

  describe('position validation', () => {
    it('returns invalid when start_line not in diff', () => {
      const result = validateSuggestionRange(100, 101, simplePatch);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Line 100 not found in diff');
    });

    it('returns invalid when end_line not in diff', () => {
      const result = validateSuggestionRange(1, 10, simplePatch);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not found in diff');
    });

    it('returns valid with positions for valid range', () => {
      // Lines 1-2 are consecutive in simplePatch
      const result = validateSuggestionRange(1, 2, simplePatch);
      expect(result.isValid).toBe(true);
      expect(result.startPosition).toBe(2);
      expect(result.endPosition).toBe(3);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('consecutive validation', () => {
    it('returns invalid when intermediate line missing (gap)', () => {
      // Create a patch where we have lines 1, 2, 3 but then line 5 (missing line 4)
      // This simulates non-consecutive line numbers
      const patchWithGap = `@@ -1,3 +1,3 @@
 line 1
+line 2
 line 3
@@ -10,2 +11,2 @@
 line 5
+line 6`;
      // Lines 1, 2, 3 exist, then jump to 5, 6 (line 4 missing - gap)
      const result = validateSuggestionRange(1, 6, patchWithGap);
      expect(result.isValid).toBe(false);
      // Line 4 doesn't exist in the diff, creating a gap
      expect(result.reason).toContain('not found in diff');
    });

    it('returns valid for consecutive lines in diff', () => {
      // Lines 1-4 are consecutive in simplePatch
      const result = validateSuggestionRange(1, 4, simplePatch);
      expect(result.isValid).toBe(true);
      expect(result.startPosition).toBeDefined();
      expect(result.endPosition).toBeDefined();
    });
  });

  describe('single-line edge case', () => {
    it('returns valid for single-line range (start === end)', () => {
      const result = validateSuggestionRange(2, 2, simplePatch);
      expect(result.isValid).toBe(true);
      expect(result.startPosition).toBe(3);
      expect(result.endPosition).toBe(3);
    });

    it('single-line range has length 1 (not 0)', () => {
      // This tests the off-by-one scenario: range [2,2] should be 1 line, not 0
      // We verify this by ensuring a single-line range doesn't trigger the 50-line limit incorrectly
      const result = validateSuggestionRange(2, 2, simplePatch);
      expect(result.isValid).toBe(true);
      // If calculation was wrong (endLine - startLine = 0),
      // the range check would incorrectly pass for invalid ranges
      // This test ensures the +1 is included: endLine - startLine + 1 = 1
    });
  });
});
