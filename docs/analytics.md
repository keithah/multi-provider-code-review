# Analytics & Reporting Guide

Track costs, performance, and ROI with built-in analytics dashboard.

## Overview

Multi-Provider Code Review includes comprehensive analytics to help you:
- **Track costs** across providers and over time
- **Measure performance** (review speed, cache hit rates)
- **Calculate ROI** (cost vs time saved)
- **Analyze findings** by category and severity
- **Monitor providers** for reliability and cost-effectiveness

## Quick Start

### Enable Analytics

Analytics are enabled by default. To configure:

```bash
# .env or GitHub Actions secrets
ANALYTICS_ENABLED=true
ANALYTICS_MAX_REVIEWS=1000  # Keep last 1000 reviews
```

### Generate Dashboard

#### CLI Mode

```bash
# Generate HTML dashboard
mpr analytics generate

# Generate CSV export
mpr analytics generate --format csv

# Generate JSON export
mpr analytics generate --format json --days 7

# View summary in terminal
mpr analytics summary
mpr analytics summary --days 30
```

#### Docker Mode

```bash
# Enter container
docker exec -it mpr-review sh

# Generate dashboard
node dist/cli/index.js analytics generate

# View in browser
# Copy reports/analytics-dashboard.html to your machine
# or mount reports directory
```

#### GitHub Actions

```yaml
- name: Generate Analytics Dashboard
  run: |
    npx mpr analytics generate

- name: Upload Dashboard
  uses: actions/upload-artifact@v3
  with:
    name: analytics-dashboard
    path: reports/analytics-dashboard.html
```

## Dashboard Features

### Summary Cards

The dashboard shows key metrics at a glance:

- **Total Reviews**: Number of reviews completed
- **Total Cost**: Cumulative cost across all reviews
- **Average Cost**: Cost per review
- **Total Findings**: Issues discovered across all reviews
- **Cache Hit Rate**: Percentage of reviews using cache
- **ROI**: Return on investment (time saved / cost)

### Cost Trends Chart

Line chart showing:
- Daily cost over time
- Number of reviews per day
- Cost per review trend

**Use cases:**
- Identify cost spikes
- Track cost optimization efforts
- Budget forecasting

### Performance Trends Chart

Track review performance:
- Average review duration over time
- Speed improvements from caching and incremental reviews

**Use cases:**
- Measure optimization impact
- Identify performance regressions
- Developer experience improvements

### Findings Distribution

Pie chart showing:
- Findings by severity (Critical, Major, Minor)
- Findings by category (Security, Performance, Style, etc.)

**Use cases:**
- Focus engineering effort on common issues
- Track improvement in code quality over time
- Identify training opportunities

### Provider Performance Table

Compare providers by:
- Number of reviews
- Success rate
- Average cost
- Average duration

**Use cases:**
- Optimize provider selection
- Identify unreliable providers
- Cost/performance tradeoffs

### ROI Analysis

Automatic ROI calculation:
```
Time Saved = Reviews × 30 minutes (avg manual review time)
Cost = Sum of all review costs
ROI = Time Saved / Cost

Example: 100 reviews × 30 min = 50 hours saved
         Cost: $2.50
         ROI: 50 hours / $2.50 = 20x return
```

## CLI Commands

### Summary Command

Show quick statistics in terminal:

```bash
# Last 30 days (default)
mpr analytics summary

# Custom time range
mpr analytics summary --days 7
mpr analytics summary --days 90

# Output:
# === Analytics Summary ===
#
# Total Reviews: 150
# Total Cost: $3.45
# Average Cost per Review: $0.0230
# Total Findings: 1,247
# Cache Hit Rate: 68.0%
#
# ROI:
#   Total Cost: $3.45
#   Estimated Time Saved: 75.0 hours
#   ROI: 2,174x
#
# Top Providers:
#   1. gemini-2.0-flash-exp: 85 reviews, 98.8% success
#   2. devstral-2512: 82 reviews, 96.3% success
```

### Generate Command

Create analytics reports:

```bash
# HTML dashboard (default)
mpr analytics generate

# Specify output directory
mpr analytics generate --output ./custom-reports

# CSV export
mpr analytics generate --format csv

# JSON export
mpr analytics generate --format json

# Custom time range
mpr analytics generate --days 7 --format csv
```

**Output files:**
- `analytics-dashboard.html` - Interactive HTML dashboard
- `analytics-export.csv` - Spreadsheet-compatible data
- `analytics-metrics.json` - Raw metrics for further processing

## Data Storage

### Location

Analytics data is stored in GitHub Actions cache:

```
Cache Key: analytics-metrics-data
Location: .cache/analytics/
Size: ~50KB per 1000 reviews
```

### Data Retention

```bash
# Maximum reviews stored (prevents unbounded growth)
ANALYTICS_MAX_REVIEWS=1000  # Default

# Older reviews are automatically pruned
# Only the most recent N reviews are kept
```

### Data Structure

```typescript
interface ReviewMetric {
  timestamp: number;          // Unix timestamp
  prNumber: number;           // PR number
  filesReviewed: number;      // Files analyzed
  findingsCount: number;      // Total findings
  costUsd: number;            // Review cost in USD
  durationSeconds: number;    // Review duration
  providersUsed: number;      // Number of providers
  cacheHit: boolean;          // Whether cache was used
}
```

### Export Data

```bash
# Export to CSV for analysis in Excel/Sheets
mpr analytics generate --format csv

# Export to JSON for custom processing
mpr analytics generate --format json

# Process JSON with jq
cat reports/analytics-metrics.json | jq '.[] | select(.costUsd > 0.05)'
```

## Integration Examples

### GitHub Actions Workflow

```yaml
name: Weekly Analytics Report

on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9am
  workflow_dispatch:

jobs:
  analytics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate Analytics
        run: |
          npx mpr analytics generate --days 7

      - name: Upload Dashboard
        uses: actions/upload-artifact@v3
        with:
          name: weekly-analytics
          path: reports/analytics-dashboard.html

      - name: Post Summary
        run: |
          npx mpr analytics summary --days 7 > analytics.txt
          gh issue create \
            --title "Weekly Analytics Report" \
            --body "$(cat analytics.txt)" \
            --label "analytics"
        env:
          GH_TOKEN: ${{ github.token }}
```

### Slack Notifications

```yaml
- name: Send to Slack
  run: |
    SUMMARY=$(npx mpr analytics summary --days 7)
    curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Weekly Code Review Analytics:\n\`\`\`$SUMMARY\`\`\`\"}"
```

### Email Reports

```yaml
- name: Email Report
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.MAIL_USERNAME }}
    password: ${{ secrets.MAIL_PASSWORD }}
    subject: Weekly Analytics Report
    to: team@company.com
    from: GitHub Actions
    body: file://analytics.txt
    attachments: reports/analytics-dashboard.html
```

### Custom Processing

```bash
# Get cost by day
cat analytics-metrics.json | jq '
  group_by(.timestamp / 86400000 | floor) |
  map({
    date: .[0].timestamp,
    reviews: length,
    cost: map(.costUsd) | add
  })
'

# Find expensive reviews
cat analytics-metrics.json | jq '
  map(select(.costUsd > 0.05)) |
  sort_by(-.costUsd)
'

# Calculate monthly spend
cat analytics-metrics.json | jq '
  map(.costUsd) | add
'
```

## Cost Optimization

### Identify Cost Drivers

```bash
# Generate detailed report
mpr analytics generate --format csv

# Open in Excel/Sheets
# Pivot by: Provider, Date, PR Number
# Sum by: Cost
```

### Optimize Provider Selection

1. **Review provider performance:**
   - Check success rates
   - Compare costs per provider
   - Identify slow providers

2. **Adjust provider list:**
```bash
# Use only top-performing free providers
REVIEW_PROVIDERS=openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free

# Reduce provider count
PROVIDER_LIMIT=3
```

3. **Enable cost controls:**
```bash
# Set budget limit
BUDGET_MAX_USD=1.0

# Use more free providers
# See available free providers:
# https://openrouter.ai/models?order=newest&supported_parameters=tools&max_price=0
```

### Leverage Caching

```bash
# Enable all caching features
ENABLE_CACHING=true
INCREMENTAL_ENABLED=true
GRAPH_ENABLED=true
GRAPH_CACHE_ENABLED=true

# Check cache hit rate in dashboard
# Target: >60% cache hit rate
```

## Performance Monitoring

### Track Review Speed

```bash
# View performance trends in dashboard
mpr analytics generate

# Check average duration
mpr analytics summary | grep "Duration"
```

### Benchmark Against Targets

| Metric | Target | Actual (Your Data) |
|--------|--------|--------------------|
| Review Duration | <60s | Check dashboard |
| Cache Hit Rate | >60% | Check dashboard |
| Cost per Review | <$0.05 | Check dashboard |
| Findings per Review | 8-12 | Check dashboard |

### Alerts

Set up alerts for anomalies:

```bash
# Check if cost is above threshold
COST=$(mpr analytics summary --days 1 | grep "Total Cost" | awk '{print $3}' | tr -d '$')
if (( $(echo "$COST > 1.0" | bc -l) )); then
  echo "⚠️ Daily cost exceeded $1.00: $$COST"
  # Send alert
fi
```

## Privacy & Security

### What Data is Collected?

Analytics collect only metadata:
- ✅ Review timestamp
- ✅ PR number
- ✅ File count
- ✅ Finding count
- ✅ Cost and duration
- ✅ Provider names
- ✅ Cache hit status

**Not collected:**
- ❌ Code content
- ❌ Finding details
- ❌ PR descriptions
- ❌ User names (except in PR number context)
- ❌ Repository names

### Data Storage

- Stored in GitHub Actions cache (if using Actions)
- Stored in Docker volume (if self-hosted)
- Never sent to external analytics services
- Fully under your control

### Disable Analytics

```bash
# Disable completely
ANALYTICS_ENABLED=false

# Or clear data
rm -rf .cache/analytics/
```

## Troubleshooting

### No Data in Dashboard

```bash
# Check if analytics is enabled
echo $ANALYTICS_ENABLED

# Check cache
ls -la .cache/analytics/

# Verify reviews have run
mpr analytics summary
```

### Dashboard Not Generating

```bash
# Check for errors
LOG_LEVEL=debug mpr analytics generate

# Ensure reports directory exists
mkdir -p reports

# Check permissions
chmod 755 reports
```

### Inaccurate Costs

- Cost data comes from OpenRouter API
- Free providers show $0.00 cost
- Custom providers may not report costs
- Check provider pricing: https://openrouter.ai/models

## Best Practices

1. **Generate reports weekly** - Track trends over time
2. **Set budget alerts** - Prevent cost overruns
3. **Monitor cache hit rates** - Optimize for performance
4. **Review provider performance** - Remove underperforming providers
5. **Export data regularly** - Backup for long-term analysis
6. **Share with team** - Make data-driven decisions
7. **Celebrate wins** - Show ROI to stakeholders

## Support

For analytics questions:
- Example dashboard: `reports/analytics-dashboard.html`
- GitHub Issues: https://github.com/keithah/multi-provider-code-review/issues
- Analytics code: `src/analytics/`

## License

MIT License - See LICENSE file for details
