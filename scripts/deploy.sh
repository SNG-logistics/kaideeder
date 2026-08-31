#!/usr/bin/env bash
# =============================================================================
# KAIDEEDER.com — One-Shot Deployment Script for Hostinger (VPS / Node.js)
# =============================================================================
# Usage (on server via SSH):
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# First-time only (fresh server):
#   FIRST_DEPLOY=true ./scripts/deploy.sh
#
# Options via env vars:
#   SKIP_PULL=true    — skip git pull (useful if you pushed already)
#   SKIP_SEED=true    — skip prisma seed (skip if DB already has data)
# =============================================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[DEPLOY]${RESET} $1"; }
ok()   { echo -e "${GREEN}  ✅ $1${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${RESET}"; }
fail() { echo -e "${RED}  ❌ $1${RESET}"; exit 1; }

echo -e "\n${BOLD}🚀 KAIDEEDER Deployment — $(date '+%Y-%m-%d %H:%M:%S')${RESET}\n"

# ── 0. Check .env exists ─────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    fail ".env ไม่พบ! กรุณาสร้าง .env บนเซิร์ฟเวอร์ก่อน deploy"
fi
ok ".env found"

# ── 1. Git Pull ───────────────────────────────────────────────────────────────
if [ "${SKIP_PULL:-false}" != "true" ]; then
    log "Pulling latest code from GitHub..."
    git pull origin main || fail "git pull ล้มเหลว"
    ok "Git pulled"
else
    warn "SKIP_PULL=true — ข้าม git pull"
fi

# ── 2. Install Dependencies ───────────────────────────────────────────────────
log "Installing dependencies..."
npm install --omit=dev || fail "npm install ล้มเหลว"
ok "Dependencies installed"

# ── 3. Prisma Generate + DB Push ──────────────────────────────────────────────
log "Generating Prisma client..."
npx prisma generate || fail "prisma generate ล้มเหลว"
ok "Prisma client generated"

log "Syncing database schema (prisma db push)..."
npx prisma db push --accept-data-loss || fail "prisma db push ล้มเหลว"
ok "Database schema synced"

# ── 4. Seed (First deploy only) ───────────────────────────────────────────────
if [ "${FIRST_DEPLOY:-false}" == "true" ] && [ "${SKIP_SEED:-false}" != "true" ]; then
    log "Seeding initial data (tenant, users, categories)..."
    npx tsx prisma/seed.ts || warn "Seed มีข้อผิดพลาด (อาจมีข้อมูลอยู่แล้ว)"

    log "Creating SuperAdmin account..."
    npx tsx scripts/seed-admin.ts || warn "seed-admin มีข้อผิดพลาด (อาจมีอยู่แล้ว)"
    ok "Initial data seeded"
fi

# ── 5. Build Next.js ──────────────────────────────────────────────────────────
log "Building Next.js (standalone mode)..."
NODE_ENV=production npm run build || fail "npm run build ล้มเหลว"
ok "Build completed"

# ── 6. Copy Static Assets into Standalone ────────────────────────────────────
log "Copying static assets into standalone..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
ok "Static assets copied"

# ── 7. Install PM2 (if not installed) ────────────────────────────────────────
if ! command -v pm2 &> /dev/null; then
    log "Installing PM2 globally..."
    npm install -g pm2 || fail "ติดตั้ง PM2 ล้มเหลว"
    ok "PM2 installed"
else
    ok "PM2 already installed"
fi

# ── 8. Start / Restart with PM2 ──────────────────────────────────────────────
if pm2 list | grep -q "kaideeder"; then
    log "Restarting PM2 process..."
    pm2 restart kaideeder || fail "pm2 restart ล้มเหลว"
    ok "PM2 restarted"
else
    log "Starting new PM2 process from ecosystem.config.js..."
    pm2 start ecosystem.config.js --env production || fail "pm2 start ล้มเหลว"
    pm2 save
    ok "PM2 started and saved"
fi

# ── 9. Summary ────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}========================================${RESET}"
echo -e "${BOLD}${GREEN}  🎉 Deploy สำเร็จ!${RESET}"
echo -e "${BOLD}${GREEN}========================================${RESET}"
echo -e "  🌐 เว็บไซต์: https://kaideeder.com"
echo -e "  🔐 Admin:   https://kaideeder.com/admin/login"
echo -e "  📋 Log:     pm2 logs kaideeder"
echo -e "  📊 Status:  pm2 status\n"
