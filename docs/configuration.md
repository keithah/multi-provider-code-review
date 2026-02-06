# Configuration Reference

## Path-Based Intensity

Path-based intensity allows different review thoroughness for different parts of your codebase.

### Enabling Path-Based Intensity

```yaml
path_based_intensity: true
path_default_intensity: standard
```

### Pattern Precedence

When multiple patterns match a file, the **highest intensity wins**.

**Intensity order (highest to lowest):**
1. `thorough` - Full analysis, most providers, longest timeout
2. `standard` - Balanced approach (default)
3. `light` - Quick scan, fewer providers, shorter timeout

**Example:**
```yaml
path_intensity_patterns: |
  [
    {"pattern": "src/core/**", "intensity": "thorough"},
    {"pattern": "src/**", "intensity": "standard"}
  ]
```

For file `src/core/auth.ts`:
- Matches `src/core/**` (thorough)
- Matches `src/**` (standard)
- **Result: thorough** (highest intensity wins)

### Intensity Behavior Mappings

Each intensity level controls multiple behaviors:

| Behavior | Thorough | Standard | Light |
|----------|----------|----------|-------|
| Providers | 8 | 5 | 3 |
| Timeout | 3 min | 2 min | 1 min |
| Prompt | detailed | standard | brief |
| Consensus | 80% | 60% | 40% |
| Min Severity | minor | minor | major |

### Configuration Options

#### `intensity_consensus_thresholds`

Percentage of providers that must agree for a finding to be reported.

```yaml
intensity_consensus_thresholds:
  thorough: 80  # 80% agreement required
  standard: 60  # 60% agreement required
  light: 40     # 40% agreement required
```

**Validation:** Values outside 0-100 are clamped with a warning.

#### `intensity_severity_filters`

Minimum severity level for inline comments.

```yaml
intensity_severity_filters:
  thorough: minor    # Show all (minor, major, critical)
  standard: minor    # Show minor and above
  light: major       # Only major and critical
```

**Validation:** Invalid values fail with typo suggestions (e.g., "majr" -> "Did you mean 'major'?").

### Common Patterns

#### Critical paths get thorough review
```yaml
path_intensity_patterns: |
  [
    {"pattern": "src/auth/**", "intensity": "thorough"},
    {"pattern": "src/payments/**", "intensity": "thorough"},
    {"pattern": "src/api/**", "intensity": "thorough"}
  ]
```

#### Documentation gets light review
```yaml
path_intensity_patterns: |
  [
    {"pattern": "docs/**", "intensity": "light"},
    {"pattern": "*.md", "intensity": "light"},
    {"pattern": "examples/**", "intensity": "light"}
  ]
```

#### Test files get standard review
```yaml
path_intensity_patterns: |
  [
    {"pattern": "tests/**", "intensity": "standard"},
    {"pattern": "**/*.test.ts", "intensity": "standard"},
    {"pattern": "**/*.spec.ts", "intensity": "standard"}
  ]
```

See [examples/config/intensity-patterns.yml](../examples/config/intensity-patterns.yml) for a complete example.
