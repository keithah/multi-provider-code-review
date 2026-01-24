import * as context from '../../../../src/analysis/context';

describe('Context Module', () => {
  it('should export required components', () => {
    expect(context).toBeDefined();
    expect(context.CodeGraph).toBeDefined();
    expect(context.CodeGraphBuilder).toBeDefined();
  });
});
