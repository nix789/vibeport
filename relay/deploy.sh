#!/usr/bin/env bash
# ============================================================
# Vibeport Relay — VPS Deploy Script
# Run this ON your DigitalOcean droplet (147.182.152.76)
# from the nixdataserver SSH key:
#
#   ssh -i ~/Desktop/nixdataserver root@147.182.152.76 'bash -s' < deploy.sh
# ============================================================
set -euo pipefail

RELAY_PORT=4444
RELAY_DIR="/opt/vibeport-relay"
NODE_MIN="18"

echo "=== Vibeport Relay Deployer ==="

# ── 1. Check Node.js ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[setup] Installing Node.js via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$NODE_MIN" ]; then
  echo "[error] Node $NODE_MIN+ required (got $NODE_VER)"
  exit 1
fi
echo "[ok] Node $(node --version)"

# ── 2. Check disk space (need at least 200 MB) ───────────────
FREE_KB=$(df / | awk 'NR==2{print $4}')
if [ "$FREE_KB" -lt 204800 ]; then
  echo "[warn] Less than 200 MB free — relay will still run but cache will fill fast"
fi
echo "[ok] Disk: $(df -h / | awk 'NR==2{print $4}') free"

# ── 3. Copy relay source ─────────────────────────────────────
mkdir -p "$RELAY_DIR"
# Copy only source + package files (not node_modules)
rsync -av --exclude node_modules --exclude data . "$RELAY_DIR/"
cd "$RELAY_DIR"
npm install --omit=dev
echo "[ok] Dependencies installed"

# ── 4. Open firewall port ────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow "$RELAY_PORT/tcp" comment "vibeport-relay" 2>/dev/null || true
  echo "[ok] ufw: port $RELAY_PORT allowed"
fi

# ── 5. Install & start pm2 ───────────────────────────────────
npm install -g pm2 2>/dev/null || true

pm2 delete vibeport-relay 2>/dev/null || true
PORT=$RELAY_PORT pm2 start src/index.js \
  --name vibeport-relay \
  --interpreter node \
  --restart-delay 3000 \
  --max-memory-restart 256M \
  --log "$RELAY_DIR/data/relay.log"

pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "============================================"
echo " Relay is LIVE at:"
echo "   ws://147.182.152.76:$RELAY_PORT"
echo ""
echo " Add this to Vibeport clients:"
echo "   wss://147.182.152.76:$RELAY_PORT"
echo "   (use wss:// after you point a domain + TLS)"
echo "============================================"
echo ""
echo "Logs: pm2 logs vibeport-relay"
echo "Stop: pm2 stop vibeport-relay"
