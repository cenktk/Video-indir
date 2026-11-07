#!/bin/bash
# Builds Video-indir.app, a small launcher: double-click starts the local UI and opens it in the browser.
# The app points at this checkout, so rebuild it if you move the folder.
# Usage: bash mac/build-app.sh [output-dir]      (default: the repo root)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$REPO}"
APP="$OUT/Video-indir.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Video-indir</string>
  <key>CFBundleDisplayName</key><string>Video-indir</string>
  <key>CFBundleIdentifier</key><string>local.video-indir.launcher</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# The launcher is written with the repo path filled in; everything else is literal.
{
  echo '#!/bin/bash'
  printf 'REPO=%q\n' "$REPO"
  cat <<'LAUNCHER'
PORT="${UI_PORT:-4747}"
URL="http://localhost:$PORT"
LOG="$HOME/Library/Logs/Video-indir.log"
# Apps started from Finder get a minimal PATH, so add the usual tool folders.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

say() { [ -n "$VIDEO_INDIR_TEST" ] && { echo "$1"; return; }; osascript -e "display dialog \"$1\" buttons {\"Tamam\"} default button 1 with icon caution" >/dev/null 2>&1; }
running() { curl -s -m 2 -o /dev/null "$URL/"; }

if running; then
  [ -n "$VIDEO_INDIR_TEST" ] && { echo "already running"; exit 0; }
  CHOICE=$(osascript -e 'button returned of (display dialog "Video-indir çalışıyor." buttons {"Durdur","Aç"} default button "Aç")' 2>/dev/null)
  if [ "$CHOICE" = "Durdur" ]; then pkill -f "ui/server.js"; else open "$URL"; fi
  exit 0
fi

[ -d "$REPO/node_modules" ] || { say "Önce kurulum gerekli: terminalde $REPO klasöründe 'npm install' çalıştır."; exit 1; }
# A login shell picks up Node from nvm, fnm or similar.
/bin/zsh -ilc 'command -v node' >/dev/null 2>&1 || command -v node >/dev/null 2>&1 || { say "Node.js bulunamadı. https://nodejs.org adresinden kur."; exit 1; }

mkdir -p "$(dirname "$LOG")"
cd "$REPO" && nohup /bin/zsh -ilc 'exec node ui/server.js' >>"$LOG" 2>&1 &

for _ in $(seq 1 40); do running && break; sleep 0.25; done
running || { say "Sunucu başlamadı. Ayrıntı: $LOG"; exit 1; }
[ -n "$VIDEO_INDIR_TEST" ] || open "$URL"
LAUNCHER
} > "$APP/Contents/MacOS/launcher"
chmod +x "$APP/Contents/MacOS/launcher"

codesign --force --sign - "$APP" >/dev/null 2>&1 || true
echo "Built: $APP"
