#!/bin/bash
# Build the Expo web export and add PWA support
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$SCRIPT_DIR/../mobile"
DIST_DIR="$MOBILE_DIR/dist"
DESKTOP_DIR="$SCRIPT_DIR"

echo "Building Expo web export..."
cd "$MOBILE_DIR"
npx expo export --platform web

echo "Adding PWA manifest..."
cp "$DESKTOP_DIR/manifest.json" "$DIST_DIR/manifest.json"

# Copy icons (use existing favicon as fallback)
mkdir -p "$DIST_DIR/icons"
if [ -f "$MOBILE_DIR/assets/images/icon.png" ]; then
  cp "$MOBILE_DIR/assets/images/icon.png" "$DIST_DIR/icons/icon-512.png"
  cp "$MOBILE_DIR/assets/images/icon.png" "$DIST_DIR/icons/icon-512-maskable.png"
fi
if [ -f "$MOBILE_DIR/assets/images/favicon.png" ]; then
  cp "$MOBILE_DIR/assets/images/favicon.png" "$DIST_DIR/icons/icon-192.png"
fi

# Add manifest link and meta tags to index.html
sed -i 's|<link rel="icon" href="/favicon.ico" />|<link rel="icon" href="/favicon.ico" />\n    <link rel="manifest" href="/manifest.json" />\n    <meta name="theme-color" content="#6db5a8" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="default" />\n    <meta name="apple-mobile-web-app-title" content="Wohnly" />\n    <link rel="apple-touch-icon" href="/icons/icon-192.png" />|' "$DIST_DIR/index.html"

# Create service worker
cat > "$DIST_DIR/sw.js" << 'SWEOF'
const CACHE_NAME = 'wohnly-v1';
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
SWEOF

# Add SW registration to index.html
sed -i 's|</body>|<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js")}</script>\n</body>|' "$DIST_DIR/index.html"

echo "PWA build complete in $DIST_DIR"
echo "Deploy the dist/ folder to your web server."
