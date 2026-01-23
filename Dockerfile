# Multi-Provider Code Review - Self-Hosted Deployment
# Production-ready Docker image with all dependencies

FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build application
RUN npm run build:prod

# Production image
FROM node:20-alpine

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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "console.log('healthy')" || exit 1

# Default command (can be overridden)
CMD ["node", "dist/index.js"]
