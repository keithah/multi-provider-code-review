import { execSync, existsSync, readFileSync } from "fs"

type ReviewResult = {
  provider: string
  output: string
}

const REVIEW_PROVIDERS = process.env.REVIEW_PROVIDERS?.split(",").map((p) => p.trim()).filter(Boolean) || []
const PR_NUMBER = process.env.PR_NUMBER || ""
const PR_TITLE = process.env.PR_TITLE || ""

if (!REVIEW_PROVIDERS.length) {
  console.error("REVIEW_PROVIDERS not set")
  process.exit(1)
}

async function buildPrompt(): Promise<string> {
  const prBody = execSync("jq -r .body pr_data.json", { encoding: "utf8" })?.trim() || ""
  
  const hasAgents = existsSync("AGENTS.md")
  
  let agentsSection = ""
  if (hasAgents) {
    const agentsContent = readFileSync("AGENTS.md", "utf8").substring(0, 2000)
    agentsSection = `\n\n## Project Guidelines (from AGENTS.md)\n${agentsContent}`
  }
  
  return `REPO: ${process.env.GITHUB_REPOSITORY || ""}
PR NUMBER: ${PR_NUMBER}
PR TITLE: ${PR_TITLE}
PR DESCRIPTION:
${prBody}

Please review this pull request and provide comprehensive code review focusing on:

## Code Quality & Best Practices
- Clean code principles and readability
- Proper error handling and edge cases
- TypeScript/JavaScript best practices
- Consistent naming conventions

## Bug Detection
- Logic errors and edge cases
- Unhandled error scenarios
- Race conditions and concurrency issues
- Input validation and sanitization

## Performance
- Inefficient algorithms or operations
- Memory leaks and unnecessary allocations
- Large file handling

## Security
- SQL injection, XSS, CSRF vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure

## Testing
- Test coverage gaps
- Missing edge case handling

## Output Format
- Use \`gh pr comment\` to leave review comments on specific files
- Include specific line numbers and code suggestions
- Provide actionable recommendations
- Summarize key findings at the end

IMPORTANT: Only create comments for actual issues. If the code follows all guidelines, respond with 'lgtm' only.${agentsSection}

##  Available Free Providers

| Provider | Model | Description |
|-----------|-------------|-----------|
| `opencode/big-pickle` | Large reasoning model | Deep analysis, comprehensive reviews |
| `opencode/grok-code` | Code-specialized model | Technical accuracy, code patterns |
| `opencode/minimax-m2.1-free` | Free tier model | Quick insights, general reviews |
| `opencode/glm-4.7-free` | Free GLM model | Balanced approach, good synthesis |

Find available providers at: https://models.dev
```

## Output Format

### Example Output

```markdown
## Multi-Provider Code Review

### 🔍 Key Findings
- **Security**: Potential SQL injection in `user.ts:45`
- **Performance**: Inefficient loop in `data.js:123`
- **Style**: Inconsistent naming in `utils.ts:67`

### 📝 Detailed Comments
- [user.ts:45] - Consider using parameterized queries
- [data.js:123] - Use map() instead of forEach() for better performance
- [utils.ts:67] - Follow camelCase convention

### ✅ Overall Assessment
The code is well-structured but needs security and performance improvements before merging.

---

## 🎯 Available Providers

Current free providers available through opencode:
- **Large reasoning**: `opencode/big-pickle` - For comprehensive analysis
- **Technical**: `opencode/grok-code` - For code-specific reviews  
- **General**: `opencode/minimax-m2.1-free` - For balanced insights
- **Creative**: `opencode/glm-4.7-free` - For synthesis and balance

### Custom Integration

You can add custom providers via environment variables or by extending the provider configuration in the workflow.
```

## 🔧 Advanced Configuration

### Provider Configuration

```typescript
interface Provider {
  name: string
  model?: string
  timeout?: number
  customPrompt?: string
}

const DEFAULT_PROVIDERS: Provider[] = [
  { name: "opencode/big-pickle", timeout: 300000 },
  { name: "opencode/grok-code", timeout: 180000 },
  { name: "opencode/minimax-m2.1-free", timeout: 180000 },
  { name: "opencode/glm-4.7-free", timeout: 180000 }
]
```

## 🤖 Monitoring

Built-in logging and error tracking:
- Review execution times
- Provider success/failure rates
- Synthesis performance metrics

---

**Made with ❤️ by [Keith Herrington](https://github.com/keithah)**

For questions or support, please open an issue in this repository.