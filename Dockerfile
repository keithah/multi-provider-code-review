# Multi-Provider Code Review - Self-Hosted Deployment
# Production-ready Docker image with all dependencies

# Build arguments for metadata
ARG BUILD_DATE
ARG VERSION=0.2.1

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

# Health check - verifies Node.js runtime, core modules, and application files
# Checks: 1) Node.js runtime works, 2) Core modules load, 3) Application dist exists
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "const fs=require('fs'); const path=require('path'); if(!fs.existsSync('dist/index.js')) process.exit(1); process.exit(0)" || exit 1

# Default command (can be overridden)
CMD ["node", "dist/index.js"]
