import { mapAddedLines } from '../../src/utils/diff';

describe('mapAddedLines', () => {
  it('maps added lines to absolute new-file line numbers', () => {
    const patch = `@@ -1,3 +1,4 @@\n line1\n+addedA\n line2\n@@ -10,2 +11,3 @@\n old\n+addedB\n+addedC\n`;

    const lines = mapAddedLines(patch);
    expect(lines).toEqual([
      { line: 2, content: 'addedA' },
      { line: 12, content: 'addedB' },
      { line: 13, content: 'addedC' },
    ]);
  });
});
