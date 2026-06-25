#!/usr/bin/env bash
#
# Builds an unsigned iOS .ipa for sideloading (Sideloadly, AltStore, etc.).
#
# The bundle is self-contained: the production frontend is built and embedded,
# so the installed app does NOT depend on a local development server.
#
# The output .ipa is unsigned on purpose. Sideloadly / AltStore re-sign it with
# your own Apple ID when you install it. If you later get an Apple Developer
# account, use `pnpm run tauri:ios:build` with a signing team instead.
#
# Usage:
#   ./script/build-unsigned-ipa.sh
#
# Optional overrides:
#   ARCHIVE=/path/to/Chorus.xcarchive OUT_IPA=/path/to/Chorus.ipa ./script/build-unsigned-ipa.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCHIVE="${ARCHIVE:-/tmp/Chorus.xcarchive}"
OUT_IPA="${OUT_IPA:-$ROOT/Chorus-unsigned.ipa}"

echo "==> Building frontend (production, mobile)"
VITE_CHORUS_MOBILE=1 pnpm build

echo "==> Archiving iOS app (unsigned)"
rm -rf "$ARCHIVE"
xcodebuild \
    -project src-tauri/gen/apple/chorus.xcodeproj \
    -scheme chorus_iOS \
    -configuration release \
    -sdk iphoneos \
    -archivePath "$ARCHIVE" \
    archive \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    DEVELOPMENT_TEAM=""

APP_PATH="$(ls -d "$ARCHIVE"/Products/Applications/*.app | head -1)"
if [ -z "$APP_PATH" ]; then
    echo "ERROR: no .app found in archive" >&2
    exit 1
fi

echo "==> Packaging IPA from $APP_PATH"
WORK="$(mktemp -d)"
mkdir -p "$WORK/Payload"
cp -R "$APP_PATH" "$WORK/Payload/"
rm -f "$OUT_IPA"
( cd "$WORK" && zip -qr "$OUT_IPA" Payload )
rm -rf "$WORK"

echo "==> Done"
ls -lh "$OUT_IPA"
