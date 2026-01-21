import { Finding, FileChange } from '../types';

export interface RuleContext {
  file: FileChange;
}

export interface Rule {
  id: string;
  description: string;
  apply: (context: RuleContext) => Finding[];
}
