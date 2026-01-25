# Self-Hosted Deployment Guide

Deploy Multi-Provider Code Review in your own infrastructure using Docker.

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository:**
```bash
git clone https://github.com/keithah/multi-provider-code-review.git
cd multi-provider-code-review
```

2. **Create environment file:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Required
GITHUB_TOKEN=ghp_your_github_token_here
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional - Feature configuration
REVIEW_PROVIDERS=openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free
ANALYTICS_ENABLED=true
LEARNING_ENABLED=true
INCREMENTAL_ENABLED=true
```

3. **Start the service:**
```bash
docker-compose up -d
```

4. **Check logs:**
```bash
docker-compose logs -f multi-provider-review
```

5. **View analytics:**
```bash
# Access the container
docker exec -it mpr-review sh

# Generate analytics dashboard
node dist/cli/index.js analytics generate

# View reports
ls -la reports/
```

## Docker Deployment

### Build Image

```bash
docker build -t multi-provider-review:latest .
```

### Run Container

```bash
docker run -d \
  --name mpr-review \
  --restart unless-stopped \
  -e GITHUB_TOKEN=ghp_your_token \
  -e OPENROUTER_API_KEY=sk-or-v1-your-key \
  -v mpr-cache:/app/.cache \
  -v $(pwd)/reports:/app/reports \
  multi-provider-review:latest
```

## Webhook Mode (Optional)

Enable webhook server to automatically review PRs on GitHub events.

### 1. Update docker-compose.yml

Uncomment the webhook service:

```yaml
mpr-webhook:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: mpr-webhook
  restart: unless-stopped
  command: ["node", "dist/server/index.js"]
  environment:
    - GITHUB_TOKEN=${GITHUB_TOKEN}
    - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    - PORT=3000
  ports:
    - "3000:3000"
  volumes:
    - mpr-cache:/app/.cache
  networks:
    - mpr-network
```

### 2. Generate Webhook Secret

```bash
ruby -rsecurerandom -e 'puts SecureRandom.hex(20)'
```

Add to `.env`:
```bash
WEBHOOK_SECRET=your_generated_secret_here
```

### 3. Configure GitHub Webhook

1. Go to your repository → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-domain.com/webhook`
3. **Content type**: `application/json`
4. **Secret**: Your webhook secret from above
5. **Events**: Select "Pull requests"
6. Click "Add webhook"

### 4. Start Webhook Server

```bash
docker-compose up -d mpr-webhook
```

### 5. Test Webhook

```bash
# Check webhook health
curl http://localhost:3000/health

# View logs
docker-compose logs -f mpr-webhook
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | ✅ | - | GitHub personal access token |
| `OPENROUTER_API_KEY` | ✅ | - | OpenRouter API key |
| `REVIEW_PROVIDERS` | ❌ | See defaults | Comma-separated provider list |
| `ANALYTICS_ENABLED` | ❌ | `true` | Enable analytics collection |
| `ANALYTICS_MAX_REVIEWS` | ❌ | `1000` | Max reviews to store |
| `LEARNING_ENABLED` | ❌ | `true` | Enable feedback learning |
| `INCREMENTAL_ENABLED` | ❌ | `true` | Enable incremental review |
| `GRAPH_ENABLED` | ❌ | `true` | Enable code graph analysis |
| `QUIET_MODE_ENABLED` | ❌ | `false` | Enable quiet mode filtering |
| `PLUGINS_ENABLED` | ❌ | `false` | Enable custom provider plugins |
| `PLUGIN_DIR` | ❌ | `./plugins` | Plugin directory path |
| `WEBHOOK_SECRET` | ❌ | - | GitHub webhook secret (webhook mode) |
| `PORT` | ❌ | `3000` | Webhook server port |
| `LOG_LEVEL` | ❌ | `info` | Log level (debug, info, warn, error) |

### Feature Flags

```bash
# Enable all advanced features
ENABLE_AST_ANALYSIS=true
ENABLE_SECURITY=true
ENABLE_CACHING=true
INCREMENTAL_ENABLED=true
LEARNING_ENABLED=true
GRAPH_ENABLED=true
ANALYTICS_ENABLED=true
```

### Provider Configuration

```bash
# Use specific free providers
REVIEW_PROVIDERS=openrouter/google/gemini-2.0-flash-exp:free,openrouter/mistralai/devstral-2512:free

# Limit number of providers
PROVIDER_LIMIT=3

# Set budget limit (USD)
BUDGET_MAX_USD=1.0
```

## Persistent Storage

### Cache Volume

Reviews and learning data are stored in a Docker volume:

```bash
# Inspect cache
docker volume inspect mpr-cache

# Backup cache
docker run --rm -v mpr-cache:/data -v $(pwd):/backup alpine tar czf /backup/mpr-cache-backup.tar.gz -C /data .

# Restore cache
docker run --rm -v mpr-cache:/data -v $(pwd):/backup alpine tar xzf /backup/mpr-cache-backup.tar.gz -C /data
```

### Reports Volume

Analytics reports are saved to `./reports/`:

```bash
ls -la reports/
# analytics-dashboard.html
# analytics-export.csv
# multi-provider-review.sarif
# multi-provider-review.json
```

## Monitoring

### Health Checks

The Docker container includes health checks:

```bash
# Check container health
docker ps

# Manual health check
docker exec mpr-review node -e "console.log('healthy')"
```

### Logs

```bash
# View logs
docker-compose logs -f

# Filter by service
docker-compose logs -f multi-provider-review
docker-compose logs -f mpr-webhook

# Export logs
docker-compose logs > mpr-logs.txt
```

### Analytics Dashboard

Generate and view analytics:

```bash
# Enter container
docker exec -it mpr-review sh

# Generate HTML dashboard
node dist/cli/index.js analytics generate

# Generate CSV export
node dist/cli/index.js analytics generate --format csv

# View summary
node dist/cli/index.js analytics summary
```

## Security Best Practices

### 1. Use Secrets Management

Instead of `.env` files, use Docker secrets:

```yaml
secrets:
  github_token:
    file: ./secrets/github_token.txt
  openrouter_key:
    file: ./secrets/openrouter_key.txt

services:
  multi-provider-review:
    secrets:
      - github_token
      - openrouter_key
```

### 2. Enable HTTPS

Use a reverse proxy (nginx, Traefik) with SSL certificates:

```yaml
# docker-compose.yml with Traefik
services:
  mpr-webhook:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mpr.rule=Host(`mpr.example.com`)"
      - "traefik.http.routers.mpr.tls.certresolver=letsencrypt"
```

### 3. Network Isolation

Keep services on private network:

```yaml
networks:
  mpr-network:
    driver: bridge
    internal: true  # No external access
```

### 4. Resource Limits

Set memory and CPU limits:

```yaml
services:
  multi-provider-review:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs multi-provider-review

# Common issues:
# - Missing GITHUB_TOKEN or OPENROUTER_API_KEY
# - Invalid API keys
# - Permission issues with volumes
```

### Webhook Not Receiving Events

```bash
# Check webhook configuration in GitHub
# Verify webhook secret matches
# Check firewall rules
# View webhook deliveries in GitHub settings

# Test locally
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{"action":"opened","number":1}'
```

### Out of Memory

```bash
# Increase memory limit
docker-compose up -d --scale multi-provider-review=1 \
  --memory 4g multi-provider-review
```

### Cache Issues

```bash
# Clear cache
docker volume rm mpr-cache
docker-compose up -d
```

## Updating

### Pull Latest Image

```bash
# Pull updates
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Zero-Downtime Update

```bash
# Scale up new version
docker-compose up -d --scale multi-provider-review=2

# Wait for health check
sleep 10

# Scale down old version
docker-compose up -d --scale multi-provider-review=1
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/keithah/multi-provider-code-review/issues
- Documentation: https://github.com/keithah/multi-provider-code-review/tree/main/docs

## License

MIT License - See LICENSE file for details
