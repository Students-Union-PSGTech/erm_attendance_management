# syntax=docker/dockerfile:1

# ==========================================
# Stage 1: Build TypeScript application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for tsc)
RUN npm ci

# Copy TypeScript configuration and source files
COPY tsconfig.json ./
COPY src ./src

# Build compiled JavaScript output into dist/
RUN npm run build

# Prune development dependencies to keep production footprint minimal
RUN npm prune --omit=dev

# ==========================================
# Stage 2: Production runtime image
# ==========================================
FROM node:22-alpine AS runner

# Use dumb-init for proper signal handling and PID 1 reaping
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

# Set up non-root permissions
RUN chown -R node:node /app

# Copy production artifacts from builder stage with proper ownership
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Switch to non-root user for security
USER node

EXPOSE 4000

# Container healthcheck against /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4000}/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
