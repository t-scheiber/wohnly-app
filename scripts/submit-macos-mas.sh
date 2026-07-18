#!/usr/bin/env bash
# Re-sign a Tauri DMG for Mac App Store and upload to App Store Connect.
# Requires: 1Password CLI (op), curl, codesign, productbuild, and either:
#   - Transporter (iTMSTransporter), or full Xcode (xcrun altool).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(jq -r '.version' "$ROOT/apps/desktop/tauri/tauri.conf.json")"
DMG="${1:-}"
OUT_DIR="${OUT_DIR:-$ROOT/apps/desktop/release}"
ASC_KEY="${ASC_KEY:-$ROOT/AuthKey_C5QRM2S8XQ.p8}"
ASC_KEY_ID="${ASC_KEY_ID:-C5QRM2S8XQ}"
ASC_ISSUER="${ASC_ISSUER:-5f00ed40-b6d3-4426-8584-9fcd845087cd}"
OP_VAULT="${OP_VAULT:-Wohnly}"

if [[ -z "$DMG" ]]; then
  DMG="$(find "$ROOT/apps/desktop/tauri/target" "$ROOT" -name "Wohnly_${VERSION}_*.dmg" 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "Usage: $0 [path/to/Wohnly_${VERSION}_aarch64.dmg]" >&2
  echo "Build first: npm run build:web && npm run build:macos" >&2
  exit 1
fi

command -v op >/dev/null || { echo "1Password CLI (op) required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq required" >&2; exit 1; }
[[ -f "$ASC_KEY" ]] || { echo "Missing ASC API key: $ASC_KEY" >&2; exit 1; }

export OP_ACCOUNT="${OP_ACCOUNT:-my.1password.com}"
MAS_PW="$(op read "op://${OP_VAULT}/p12 Cert Password/password")"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"; security delete-keychain mas.keychain 2>/dev/null || true' EXIT

KEYCHAIN_PW="wohnly-mas-$$"
security delete-keychain mas.keychain 2>/dev/null || true
security create-keychain -p "$KEYCHAIN_PW" mas.keychain
security list-keychains -d user -s mas.keychain
security unlock-keychain -p "$KEYCHAIN_PW" mas.keychain

python3 <<'PY' "$ROOT" "$WORKDIR"
import base64, json, subprocess, sys
root, workdir = sys.argv[1], sys.argv[2]
vault = __import__("os").environ.get("OP_VAULT", "Wohnly")
for name, out in [
    ("base64 encoded mac_app_dist.p12", f"{workdir}/mas_app.p12"),
    ("base64 encoded mac_installer_dist.p12", f"{workdir}/mas_installer.p12"),
]:
    data = json.loads(subprocess.check_output(
        ["op", "item", "get", name, "--vault", vault, "--format", "json"], text=True))
    notes = next(f["value"] for f in data["fields"] if f.get("id") == "notesPlain")
    open(out, "wb").write(base64.b64decode("".join(notes.split())))
PY

WWDR="$WORKDIR/AppleWWDRCAG3.cer"
curl -fsSL -o "$WWDR" https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
security import "$WWDR" -k mas.keychain -A
security import "$WORKDIR/mas_app.p12" -k mas.keychain -P "$MAS_PW" -T /usr/bin/codesign -T /usr/bin/productbuild
security import "$WORKDIR/mas_installer.p12" -k mas.keychain -P "$MAS_PW" -T /usr/bin/codesign -T /usr/bin/productbuild
security set-key-partition-list -S apple-tool:,apple:,codesign:,productbuild: -s -k "$KEYCHAIN_PW" mas.keychain

MOUNT="/tmp/wohnly-dmg-$$"
hdiutil attach "$DMG" -nobrowse -mountpoint "$MOUNT"
cp -R "$MOUNT"/Wohnly.app "$WORKDIR/Wohnly.app"
hdiutil detach "$MOUNT"

MAS_APP_IDENTITY="$(security find-identity -v -p codesigning mas.keychain | grep '3rd Party Mac Developer Application' | head -1 | sed 's/.*"\(.*\)".*/\1/')"
MAS_INSTALLER_IDENTITY="$(security find-identity -v mas.keychain | grep '3rd Party Mac Developer Installer' | head -1 | sed 's/.*"\(.*\)".*/\1/')"

cat > "$WORKDIR/entitlements.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.app-sandbox</key><true/>
<key>com.apple.security.network.client</key><true/>
<key>com.apple.security.files.user-selected.read-write</key><true/>
<key>com.apple.developer.applesignin</key>
<array><string>Default</string></array>
<key>com.apple.application-identifier</key>
<string>8RSPLFN63L.app.wohnly</string>
<key>com.apple.developer.team-identifier</key>
<string>8RSPLFN63L</string>
</dict></plist>
PLIST

/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$WORKDIR/Wohnly.app/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$WORKDIR/Wohnly.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :ITSEncryptionExportComplianceCode" "$WORKDIR/Wohnly.app/Contents/Info.plist" 2>/dev/null || true

codesign --keychain mas.keychain --deep --force --options runtime \
  --sign "$MAS_APP_IDENTITY" --entitlements "$WORKDIR/entitlements.plist" "$WORKDIR/Wohnly.app"

mkdir -p "$OUT_DIR"
PKG="$OUT_DIR/Wohnly-${VERSION}-mas.pkg"
productbuild --sign "$MAS_INSTALLER_IDENTITY" --keychain mas.keychain \
  --component "$WORKDIR/Wohnly.app" /Applications "$PKG"
echo "Created $PKG"

mkdir -p ~/.private_keys
cp "$ASC_KEY" "$HOME/.private_keys/AuthKey_${ASC_KEY_ID}.p8"

UPLOAD=1
if [[ "${SKIP_UPLOAD:-0}" == "1" ]]; then
  UPLOAD=0
fi

if [[ "$UPLOAD" == "1" ]]; then
  if [[ -x "/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter" ]]; then
  "/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter" \
    -m upload -assetFile "$PKG" -apiKey "$ASC_KEY_ID" -apiIssuer "$ASC_ISSUER" -v eXtreme
  elif xcrun altool --help >/dev/null 2>&1; then
    xcrun altool --upload-app --type macos --file "$PKG" \
      --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER" --verbose
  else
    echo ""
    echo "No upload tool found. Install Transporter from the Mac App Store, or full Xcode."
    echo "Then upload manually: open Transporter and drop:"
    echo "  $PKG"
    echo "Or re-run without SKIP_UPLOAD after installing Transporter."
    exit 0
  fi
  echo "Upload started. In App Store Connect, link build $VERSION to the macOS version when processing completes."
fi
