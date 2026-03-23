#!/bin/bash
set -euo pipefail

# ============================================================
# The Signal — Deployment Pipeline
# 1. Build Docker images locally
# 2. Test locally (health + login + client)
# 3. Save & transfer images to Azure VM
# 4. Deploy on production
# ============================================================

REMOTE_USER="azureuser"
REMOTE_HOST="20.197.2.111"
PEM_KEY="${PEM_KEY:-C:/Users/sanjo/Downloads/Client-Projects/PwC/pwctesttobedeleted_key.pem}"
SSH_OPTS="-i $PEM_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15"
REMOTE_DIR="/home/azureuser/the-signal"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $1"; }
fail() { echo -e "${RED}[FAIL  ]${NC} $1"; exit 1; }

# ============================================================
# STEP 1: Build Docker images locally
# ============================================================
log "Step 1/5 — Building Docker images locally..."

docker compose build 2>&1 | tail -5
ok "Docker images built"

# ============================================================
# STEP 2: Local smoke test
# ============================================================
log "Step 2/5 — Running local smoke test..."

docker compose up -d 2>&1

# Wait for API health
MAX_WAIT=60; WAITED=0
until curl -sf http://localhost:5000/api/health > /dev/null 2>&1; do
  sleep 2; WAITED=$((WAITED + 2))
  if [ $WAITED -ge $MAX_WAIT ]; then
    docker compose logs signal-api --tail=30
    docker compose down
    fail "API did not start within ${MAX_WAIT}s"
  fi
done
ok "API health check passed"

# Test client
CLIENT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:4000 2>&1 || echo "000")
if [ "$CLIENT_STATUS" = "200" ]; then
  ok "Client responding on port 4000"
else
  warn "Client returned HTTP $CLIENT_STATUS (may still be starting)"
fi

docker compose down 2>&1
ok "Local test passed — containers stopped"

# ============================================================
# STEP 3: Save and transfer images
# ============================================================
log "Step 3/5 — Saving Docker images..."

docker save signal-outreach-signal-api:latest signal-outreach-signal-client:latest | gzip > /tmp/signal-images.tar.gz
IMAGE_SIZE=$(du -h /tmp/signal-images.tar.gz | cut -f1)
ok "Images saved ($IMAGE_SIZE)"

log "Step 4/5 — Transferring to $REMOTE_HOST..."

ssh $SSH_OPTS $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR"
scp $SSH_OPTS /tmp/signal-images.tar.gz $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/signal-images.tar.gz
scp $SSH_OPTS docker-compose.prod.yml $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/docker-compose.yml

# Transfer .env file so docker-compose can interpolate API keys
if [ -f .env ]; then
  scp $SSH_OPTS .env $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env
  ok ".env file transferred"
else
  warn "No .env file found — API keys won't be available on production"
fi

ok "Transfer complete"

rm -f /tmp/signal-images.tar.gz

# ============================================================
# STEP 5: Deploy on production
# ============================================================
log "Step 5/5 — Deploying on production..."

ssh $SSH_OPTS $REMOTE_USER@$REMOTE_HOST << 'REMOTE_DEPLOY'
set -euo pipefail
cd /home/azureuser/the-signal

echo "[REMOTE] Loading Docker images..."
docker load < signal-images.tar.gz
rm -f signal-images.tar.gz

echo "[REMOTE] Stopping old signal containers..."
docker compose down 2>/dev/null || true

echo "[REMOTE] Starting services..."
docker compose up -d

echo "[REMOTE] Waiting for API..."
MAX_WAIT=90; WAITED=0
until curl -sf http://localhost:5000/api/health > /dev/null 2>&1; do
  sleep 3; WAITED=$((WAITED + 3))
  if [ $WAITED -ge $MAX_WAIT ]; then
    docker compose logs signal-api --tail=20
    exit 1
  fi
done
echo "[REMOTE] API healthy!"

echo "[REMOTE] Seeding users..."
docker exec signal-api node /app/scripts/seed-docker.js 2>&1 || true

echo "[REMOTE] Checking client..."
curl -sf -o /dev/null http://localhost:4000 && echo "[REMOTE] Client OK" || echo "[REMOTE] Client not ready yet"

echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(signal|mongo|NAMES)"
echo "[REMOTE] Done!"
REMOTE_DEPLOY

ok "Deployment complete!"
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  The Signal is live!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  App:     http://20.197.2.111:4000"
echo -e "  API:     http://20.197.2.111:5000/api/health"
echo -e "  Swagger: http://20.197.2.111:5000/api-docs"
echo ""
