FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies
RUN npm ci --ignore-scripts

# Copy client source
COPY client/ client/

# Build client
WORKDIR /app/client
RUN npx vite build

# --- Production stage: serve with nginx ---
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Custom nginx config for SPA routing + API proxy
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 4000

CMD ["nginx", "-g", "daemon off;"]
