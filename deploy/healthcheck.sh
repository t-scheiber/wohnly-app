#!/bin/bash
# API Health Check — runs via cron on the VPS.
# Checks the /api/health endpoint and emails t@wohnly.app if the API is down.
# Also auto-restarts the API via PM2 if it's not running.

HEALTH_URL="http://localhost:3001/api/health"
ALERT_EMAIL="t@wohnly.app"
FROM_EMAIL="noreply@wohnly.app"
STATE_FILE="/tmp/wohnly-api-health-state"
PM2_APP="wohnly-api"

# Check health endpoint (2 second timeout)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
  # API is healthy — clear any previous down state
  if [ -f "$STATE_FILE" ]; then
    rm -f "$STATE_FILE"
    # Send recovery email
    echo -e "Subject: [Wohnly] API recovered\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\nThe Wohnly API is back online.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nHealth: $HEALTH_URL -> $HTTP_CODE" | sendmail -t -f "$FROM_EMAIL" 2>/dev/null || true
  fi
  exit 0
fi

# API is down — check if we already alerted
if [ -f "$STATE_FILE" ]; then
  # Already alerted, don't spam. But try to restart.
  LAST_ALERT=$(cat "$STATE_FILE")
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_ALERT))

  # Re-alert every 30 minutes if still down
  if [ "$DIFF" -lt 1800 ]; then
    # Just try restart, no email
    pm2 restart "$PM2_APP" 2>/dev/null || true
    exit 0
  fi
fi

# Record alert timestamp
date +%s > "$STATE_FILE"

# Try to restart the API
pm2 restart "$PM2_APP" 2>/dev/null || pm2 start /var/www/wohnly/deploy/pm2.api.config.cjs --only "$PM2_APP" --update-env 2>/dev/null

# Wait a moment and re-check
sleep 5
HTTP_RECHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_RECHECK" = "200" ]; then
  BODY="The Wohnly API was down but has been auto-restarted successfully.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nOriginal status: $HTTP_CODE\nAfter restart: $HTTP_RECHECK"
  rm -f "$STATE_FILE"
else
  BODY="The Wohnly API is DOWN and auto-restart failed.\n\nTimestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nHealth check: $HEALTH_URL -> $HTTP_CODE\nAfter restart attempt: $HTTP_RECHECK\n\nPlease check the server manually:\n  ssh root@$(hostname) 'pm2 logs wohnly-api --lines 30 --nostream'"
fi

# Send alert email
echo -e "Subject: [Wohnly] API is down!\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\n$BODY" | sendmail -t -f "$FROM_EMAIL" 2>/dev/null || true
