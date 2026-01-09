import { execSync } from "child_process"

type ReviewResult = {
  provider: string
  output: string
}

const REVIEW_PROVIDERS = process.env.REVIEW_PROVIDERS?.split(",").map((p) => p.trim()).filter(Boolean) || []
const PR_NUMBER = process.env.PR_NUMBER || ""
const PR_TITLE = process.env.PR_TITLE || ""
const REPO = process.env.GITHUB_REPOSITORY || ""

if (!REVIEW_PROVIDERS.length) {
  console.error("REVIEW_PROVIDERS not set")
  process.exit(1)
}

async function runReview(provider: string): Promise<ReviewResult> {
  console.log(`Starting review with provider: ${provider}`)

  try {
    const result = execSync(`opencode run -m ${provider} -- "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: "utf8",
      timeout: 180000,
    })
    return {
      provider,
      output: result,
    }
  } catch (error) {
    console.error(`Error with ${provider}:`, error)
    return {
      provider,
      output: `Error: Review failed for ${provider}`,
    }
  }
}

async function synthesize(reviews: ReviewResult[]): Promise<string> {
  const aggregated = reviews.map((r) => `## Review from ${r.provider}\n\n${r.output}`).join("\n\n---\n\n")

  const synthesisPrompt = `You are an expert code reviewer. Please synthesize these reviews into one comprehensive review.

Rules:
- Combine overlapping feedback
- Highlight unique insights from each review
- Remove duplicates
- Present a clear, actionable review
- Maintain the tone and suggestions from the reviews

Reviews to synthesize:
${aggregated}

Provide a synthesized review:`

  try {
    return execSync(`opencode run -m opencode/big-pickle -- "${synthesisPrompt.replace(/"/g, '\\"')}"`, {
      encoding: "utf8",
      timeout: 180000,
    })
  } catch (error) {
    console.error("Synthesis error:", error)
    return aggregated
  }
}

async function main() {
  console.log(`Running reviews with ${REVIEW_PROVIDERS.length} providers: ${REVIEW_PROVIDERS.join(", ")}`)

  const results = await Promise.all(REVIEW_PROVIDERS.map((provider) => runReview(provider)))

  console.log("\nAll reviews completed. Synthesizing...")
  const synthesis = await synthesize(results)

  console.log("\n=== SYNTHESIS ===\n")
  console.log(synthesis)

  // Post as PR comment
  const escaped = synthesis.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  execSync(`gh api --method POST -H "Accept: application/vnd.github+json" /repos/${REPO}/issues/${PR_NUMBER}/comments -f "body=${escaped}"`, {
    encoding: "utf8",
  })
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})