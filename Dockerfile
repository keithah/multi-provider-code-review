# Multi-Provider Code Review - Self-Hosted Deployment
# Production-ready Docker image with all dependencies

# Build arguments for metadata
ARG BUILD_DATE
ARG VERSION=0.2.1

# Use node:20-alpine for Docker builds (pinned to Node.js v20.x LTS, not "latest")
# Node.js 20 is the active LTS version with long-term support until 2026-04-30
# Alpine provides a minimal, secure base image (~50MB vs ~1GB for full node image)
# GitHub Actions workflow uses runner's built-in Node.js (typically Node 20+)
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build application
RUN npm run build:prod

# Remove devDependencies after build (keeps only production dependencies)
# This significantly reduces the final image size by removing TypeScript, build tools, etc.
RUN npm prune --production

# Production image
FROM node:20-alpine

# Pass build arguments to production stage
ARG BUILD_DATE
ARG VERSION=0.2.1

# Add metadata labels (OCI standard)
LABEL org.opencontainers.image.title="Multi-Provider Code Review"
LABEL org.opencontainers.image.description="AI-powered code review with multiple LLM providers"
LABEL org.opencontainers.image.vendor="multi-provider-code-review"
LABEL org.opencontainers.image.source="https://github.com/keithah/multi-provider-code-review"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

# Install runtime dependencies
RUN apk add --no-cache git

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose webhook port (if using webhook mode)
EXPOSE 3000

# Health check - verifies the application can be loaded and initialized
# Checks that Node.js can successfully load the bundle, not just file existence
# This catches build errors, missing dependencies, and runtime initialization issues
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "try { require('./dist/index.js'); process.exit(0); } catch(e) { console.error('Health check failed:', e.message); process.exit(1); }"

# Default command (can be overridden)
CMD ["node", "dist/index.js"]
