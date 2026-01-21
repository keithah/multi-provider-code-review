import { FileChange, Finding } from '../types';
import { Rule } from './pattern';

export class RulesEngine {
  constructor(private readonly rules: Rule[] = []) {}

  run(files: FileChange[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      for (const rule of this.rules) {
        findings.push(...rule.apply({ file }));
      }
    }
    return findings;
  }
}
