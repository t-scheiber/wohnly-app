#!/bin/bash
# API Health Check — runs via cron on the VPS.
# Checks the /api/health endpoint. If down:
#   1. Pull latest code from git
#   2. Install deps + prisma generate
#   3. Restart API via PM2
#   4. Email t@wohnly.app with status
# Also deploys the web frontend if git had changes.

HEALTH_URL="http://localhost:3001/api/health"
EXTERNAL_URL="https://api.wohnly.app/api/health"
ALERT_EMAIL="t@wohnly.app"
FROM_EMAIL="noreply@wohnly.app"
STATE_FILE="/tmp/wohnly-api-health-state"
PM2_APP="wohnly-api"
REPO_DIR="/var/www/wohnly"
WEB_DIR="/var/www/wohnly-web"

# Check both internal (Node process) and external (reverse proxy + SSL) endpoints
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)
EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$EXTERNAL_URL" 2>/dev/null)

# If external fails but internal passes, it's a reverse proxy / SSL issue
if [ "$HTTP_CODE" = "200" ] && [ "$EXT_CODE" != "200" ]; then
  # Try restarting nginx/caddy
  systemctl restart nginx 2>/dev/null || systemctl restart caddy 2>/dev/null || true
  sleep 2
  EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$EXTERNAL_URL" 2>/dev/null)
  if [ "$EXT_CODE" != "200" ]; then
    echo -e "Subject: [Wohnly] Reverse proxy is down!\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\nAPI is running (localhost:3001 -> $HTTP_CODE) but external URL is failing ($EXTERNAL_URL -> $EXT_CODE).\nRestarted reverse proxy but it's still down.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" | sendmail -t -f "$FROM_EMAIL" 2>/dev/null || true
  fi
fi

# Use external status as the overall health (catches more failure modes)
[ "$EXT_CODE" != "200" ] && HTTP_CODE="$EXT_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  # API is healthy — clear any previous down state
  if [ -f "$STATE_FILE" ]; then
    rm -f "$STATE_FILE"
    echo -e "Subject: [Wohnly] API recovered\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\nThe Wohnly API is back online.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nHealth: $HEALTH_URL -> $HTTP_CODE" | sendmail -t -f "$FROM_EMAIL" 2>/dev/null || true
  fi
  exit 0
fi

# API is down — check if we already alerted recently (avoid spam)
if [ -f "$STATE_FILE" ]; then
  LAST_ALERT=$(cat "$STATE_FILE")
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_ALERT))
  # Re-alert every 30 minutes if still down
  if [ "$DIFF" -lt 1800 ]; then
    pm2 restart "$PM2_APP" 2>/dev/null || true
    exit 0
  fi
fi

# Record alert timestamp
date +%s > "$STATE_FILE"

# Full recovery: pull latest code, rebuild, restart
cd "$REPO_DIR" || exit 1
export GIT_SSH_COMMAND="ssh -i /root/.ssh/wohnly_deploy -o StrictHostKeyChecking=no"

# Pull latest
git stash 2>/dev/null || true
git fetch origin main 2>/dev/null
BEFORE=$(git rev-parse HEAD)
git reset --hard origin/main 2>/dev/null
AFTER=$(git rev-parse HEAD)

# Install deps
npm ci --silent 2>/dev/null

# Prisma
cd apps/api
npx prisma generate 2>/dev/null
npx prisma db push --accept-data-loss 2>/dev/null
cd "$REPO_DIR"

# Restart API
pm2 delete "$PM2_APP" 2>/dev/null || true
pm2 start deploy/pm2.api.config.cjs --only "$PM2_APP" --update-env 2>/dev/null
pm2 save 2>/dev/null

# If code changed, also rebuild and deploy web
if [ "$BEFORE" != "$AFTER" ]; then
  cd apps/mobile
  npx expo export --platform web 2>/dev/null
  node scripts/inject-adsense.mjs 2>/dev/null
  cp -r dist/* "$WEB_DIR/" 2>/dev/null
  cd "$REPO_DIR"
fi

# Wait and re-check
sleep 5
HTTP_RECHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_RECHECK" = "200" ]; then
  BODY="The Wohnly API was down but has been auto-recovered.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nOriginal status: $HTTP_CODE\nAfter recovery: $HTTP_RECHECK\n\nRecovery steps taken:\n- git pull ($(git log --oneline -1))\n- npm ci + prisma generate\n- pm2 restart"
  [ "$BEFORE" != "$AFTER" ] && BODY="$BODY\n- Web frontend redeployed (code changed)"
  rm -f "$STATE_FILE"
else
  BODY="The Wohnly API is DOWN and auto-recovery FAILED.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nHealth check: $HEALTH_URL -> $HTTP_CODE\nAfter recovery attempt: $HTTP_RECHECK\n\nManual intervention required:\n  ssh vps 'pm2 logs wohnly-api --lines 50 --nostream'"
fi

# Send alert email
echo -e "Subject: [Wohnly] API is down!\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\n$BODY" | sendmail -t -f "$FROM_EMAIL" 2>/dev/null || true
