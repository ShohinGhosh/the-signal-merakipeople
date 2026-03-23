FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies (workspaces need root install)
RUN npm ci --ignore-scripts

# Copy server source
COPY server/ server/

# Build server TypeScript
WORKDIR /app/server
RUN npx tsc

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts --workspace=server 2>/dev/null || npm ci --omit=dev --ignore-scripts

# Copy compiled JS
COPY --from=builder /app/server/dist server/dist

# Copy prompt YAML files (needed at runtime)
# promptManager resolves from dist/services/ai/../../prompts → dist/prompts
COPY server/src/prompts server/dist/prompts

# Copy seed script
COPY scripts/seed-docker.js scripts/seed-docker.js

WORKDIR /app/server

EXPOSE 5000

CMD ["node", "dist/index.js"]
