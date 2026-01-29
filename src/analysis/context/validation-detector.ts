/**
 * Validation Detector - Auto-detects defensive programming patterns
 *
 * Reduces false positives by recognizing:
 * - Input validation (typeof checks, null checks, range checks)
 * - Error handling (try-catch, error returns)
 * - Defensive programming (existence checks, fallbacks)
 * - Data flow tracking across lines
 *
 * This helps LLM reviewers understand code is actually safe/correct.
 */

export interface ValidationPattern {
  type:
    | 'type_check'
    | 'null_check'
    | 'range_check'
    | 'try_catch'
    | 'existence_check'
    | 'error_return'
    | 'locking'
    | 'timeout_enforcement'
    | 'param_validation'
    | 'intentionally_unused';
  line: number;
  variable?: string;
  description: string;
}

export interface DefensiveProgrammingContext {
  validations: ValidationPattern[];
  errorHandling: {
    hasTryCatch: boolean;
    hasErrorReturn: boolean;
    hasGracefulDegradation: boolean;
  };
  dataFlow: {
    variable: string;
    initialized: boolean;
    checkedBeforeUse: boolean;
    lines: number[];
  }[];
}

/**
 * Detect validation patterns in code to reduce false positives
 */
export class ValidationDetector {
  /**
   * Analyze a code snippet for defensive programming patterns
   * Returns context that can be added to LLM prompts to reduce false positives
   */
  analyzeDefensivePatterns(code: string, startLine: number = 1): DefensiveProgrammingContext {
    const lines = code.split('\n');
    const validations: ValidationPattern[] = [];
    const variables = new Map<string, { initialized: boolean; checkedBeforeUse: boolean; lines: number[] }>();

    let hasTryCatch = false;
    let hasErrorReturn = false;
    let hasGracefulDegradation = false;

    // Check for graceful degradation patterns in full code (multiline)
    if (/\/\/\s*(ignore|best effort|graceful|fallback)/i.test(code)) {
      hasGracefulDegradation = true;
    }
    // Check for return statements inside catch blocks (multiline pattern)
    if (/catch\s*\([^)]*\)\s*{[^}]*return[^}]*}/s.test(code)) {
      hasGracefulDegradation = true;
      hasErrorReturn = true;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = startLine + i;
      const trimmed = line.trim();

      // Detect typeof checks
      const typeofMatch = trimmed.match(/typeof\s+(\w+)\s*(!==?|===?)\s*['"](\w+)['"]/);
      if (typeofMatch) {
        const [, variable, operator, type] = typeofMatch;
        validations.push({
          type: 'type_check',
          line: lineNum,
          variable,
          description: `Validates ${variable} is ${operator.includes('!') ? 'not' : ''} a ${type}`,
        });
        this.trackVariable(variables, variable, lineNum, true);
      }

      // Detect null/undefined checks
      if (
        /\s+(===?|!==?)\s+(null|undefined)/.test(trimmed) ||
        /\s+(null|undefined)\s+(===?|!==?)/.test(trimmed) ||
        /if\s*\(\s*!\s*\w+\s*\)/.test(trimmed) ||
        /\w+\s*==\s*null/.test(trimmed)
      ) {
        const varMatch = trimmed.match(/(\w+)\s*(!==?|===?)\s*(null|undefined)/);
        validations.push({
          type: 'null_check',
          line: lineNum,
          variable: varMatch?.[1],
          description: `Null/undefined check for ${varMatch?.[1] || 'value'}`,
        });
      }

      // Detect range/bounds checks
      if (/[<>]=?/.test(trimmed) && /\d+/.test(trimmed)) {
        const varMatch = trimmed.match(/(\w+)\s*[<>]=?\s*\d+/);
        if (varMatch) {
          validations.push({
            type: 'range_check',
            line: lineNum,
            variable: varMatch[1],
            description: `Range validation for ${varMatch[1]}`,
          });
        }
      }

      // Detect try-catch blocks
      if (/^try\s*{/.test(trimmed)) {
        hasTryCatch = true;
      }

      // Detect error returns
      if (/return\s+(null|undefined|false|'invalid'|"invalid"|-1)/.test(trimmed)) {
        hasErrorReturn = true;
        validations.push({
          type: 'error_return',
          line: lineNum,
          description: 'Returns error value on invalid input',
        });
      }

      // Detect existence checks (file/directory checks, etc.)
      if (
        /fs\.(exists|access|stat|mkdir)/.test(trimmed) ||
        /\.\w+\s*\|\|\s*/.test(trimmed) ||
        /\?\?\s*/.test(trimmed)
      ) {
        validations.push({
          type: 'existence_check',
          line: lineNum,
          description: 'Checks existence before use',
        });
      }

      // Detect graceful degradation patterns (line-level)
      if (
        /\|\|/.test(trimmed) ||
        /\?\?/.test(trimmed)
      ) {
        hasGracefulDegradation = true;
      }

      // Detect locking mechanisms (Promise-based locks, mutexes)
      if (
        /await\s+.*\.acquire|lockPromise|acquireLock|releaseLock|mutex/.test(trimmed) ||
        /locks\.get|locks\.set|locks\.delete/.test(trimmed)
      ) {
        validations.push({
          type: 'locking',
          line: lineNum,
          description: 'Uses locking mechanism for concurrency safety',
        });
      }

      // Detect timeout enforcement (Promise.race with timeout)
      if (/Promise\.race\s*\(/.test(trimmed) && /timeout|setTimeout/i.test(code.slice(i * 100, (i + 10) * 100))) {
        validations.push({
          type: 'timeout_enforcement',
          line: lineNum,
          description: 'Enforces timeout using Promise.race',
        });
      }

      // Detect parameter validation at function entry
      // Check for validation patterns: if (condition) throw Error
      const nextFewLines = lines.slice(i, Math.min(i + 4, lines.length)).join('\n');
      if (
        /if\s*\([^)]*[<>!=]/.test(trimmed) &&
        /throw\s+(new\s+)?Error/.test(nextFewLines)
      ) {
        validations.push({
          type: 'param_validation',
          line: lineNum,
          description: 'Validates parameters with throw on invalid input',
        });
      }

      // Detect intentionally unused parameters (prefixed with _)
      const unusedParamMatch = trimmed.match(/\b_(\w+)\b/);
      if (unusedParamMatch) {
        validations.push({
          type: 'intentionally_unused',
          line: lineNum,
          variable: `_${unusedParamMatch[1]}`,
          description: `Parameter _${unusedParamMatch[1]} is intentionally unused (indicated by _ prefix)`,
        });
      }

      // Track variable initialization
      const initMatch = trimmed.match(/(?:let|const|var)\s+(\w+)\s*[:=]/);
      if (initMatch) {
        const varName = initMatch[1];
        this.trackVariable(variables, varName, lineNum, false);
      }
    }

    return {
      validations,
      errorHandling: {
        hasTryCatch,
        hasErrorReturn,
        hasGracefulDegradation,
      },
      dataFlow: Array.from(variables.entries()).map(([variable, data]) => ({
        variable,
        ...data,
      })),
    };
  }

  private trackVariable(
    variables: Map<string, { initialized: boolean; checkedBeforeUse: boolean; lines: number[] }>,
    varName: string,
    line: number,
    checked: boolean
  ): void {
    const existing = variables.get(varName) || {
      initialized: false,
      checkedBeforeUse: false,
      lines: [],
    };
    existing.lines.push(line);
    if (checked) {
      existing.checkedBeforeUse = true;
    }
    variables.set(varName, existing);
  }

  /**
   * Generate additional context for LLM prompts to reduce false positives
   */
  generatePromptContext(context: DefensiveProgrammingContext): string {
    if (context.validations.length === 0) {
      return '';
    }

    const parts: string[] = [
      '\n## Defensive Programming Context (Auto-Detected)',
      'The following defensive patterns were detected in this code:',
    ];

    // Group validations by type
    const byType = new Map<string, ValidationPattern[]>();
    for (const validation of context.validations) {
      const list = byType.get(validation.type) || [];
      list.push(validation);
      byType.set(validation.type, list);
    }

    for (const [type, patterns] of byType) {
      const typeName = type.replace(/_/g, ' ');
      parts.push(`\n**${typeName.charAt(0).toUpperCase() + typeName.slice(1)}** (${patterns.length}):`);
      for (const pattern of patterns) {
        parts.push(`- Line ${pattern.line}: ${pattern.description}`);
      }
    }

    if (context.errorHandling.hasTryCatch) {
      parts.push('\n**Error Handling**: Code uses try-catch for exception handling');
    }

    if (context.errorHandling.hasGracefulDegradation) {
      parts.push('**Graceful Degradation**: Code has fallback logic for error cases');
    }

    if (context.dataFlow.length > 0) {
      parts.push('\n**Data Flow Tracking**:');
      for (const flow of context.dataFlow) {
        if (flow.checkedBeforeUse) {
          parts.push(`- ${flow.variable}: Validated before use (lines ${flow.lines.join(', ')})`);
        }
      }
    }

    parts.push(
      '\n**Reviewer Note**: When flagging issues, verify these defensive patterns don\'t already address the concern.'
    );

    return parts.join('\n');
  }

  /**
   * Check if a specific line has validation coverage
   * This can suppress false positives for lines that are already validated
   */
  hasValidationCoverage(
    context: DefensiveProgrammingContext,
    targetLine: number,
    variable?: string
  ): boolean {
    // Check if there's validation near the target line
    const nearbyValidations = context.validations.filter(
      v => Math.abs(v.line - targetLine) <= 5 && (!variable || v.variable === variable)
    );

    return nearbyValidations.length > 0;
  }
}
