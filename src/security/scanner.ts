import { FileChange, Finding } from '../types';
import { detectSecrets } from './secrets';

export class SecurityScanner {
  scan(files: FileChange[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      findings.push(...detectSecrets(file));
    }
    return findings;
  }
}
