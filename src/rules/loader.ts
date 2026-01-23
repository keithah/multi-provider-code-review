import { RulesEngine } from './engine';

export class RuleLoader {
  static load(): RulesEngine {
    // Placeholder for configurable rules; returns empty engine for now.
    return new RulesEngine([]);
  }
}
