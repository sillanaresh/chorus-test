#!/usr/bin/env bash
#
# Builds an unsigned iOS .ipa for sideloading (Sideloadly, AltStore, etc.).
#
# The bundle is self-contained: the production frontend is built and embedded,
# so the installed app does NOT depend on a local development server.
#
# The output .ipa is unsigned on purpose. Sideloadly / AltStore re-sign it with
# your own Apple ID when you install it. Code signing is disabled for the iOS
# target in src-tauri/gen/apple/project.yml. If you later get an Apple Developer
# account and want a signed build, remove those settings and set a team, then
# use `pnpm run tauri:ios:build`.
#
# How it works: `tauri ios build` compiles the Rust library and produces an
# unsigned .xcarchive. Its final export step needs a signing team and fails,
# which is expected. We ignore that and package the .app from the archive.
#
# Usage:
#   ./script/build-unsigned-ipa.sh
#
# Optional override:
#   OUT_IPA=/path/to/Chorus.ipa ./script/build-unsigned-ipa.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT_IPA="${OUT_IPA:-$ROOT/Chorus-unsigned.ipa}"
ARCHIVE="$ROOT/src-tauri/gen/apple/build/chorus_iOS.xcarchive"

rm -rf "$ARCHIVE"

echo "==> Building unsigned iOS archive via tauri (export step is expected to fail)"
# tauri archives the app, then tries to export an IPA. The export needs a
# signing team and fails; we tolerate that and package the archive ourselves.
VITE_CHORUS_MOBILE=1 pnpm tauri ios build \
    --ignore-version-mismatches \
    --target aarch64 \
    --ci \
    --export-method debugging || true

if [ ! -d "$ARCHIVE" ]; then
    echo "ERROR: archive was not produced at $ARCHIVE" >&2
    exit 1
fi

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
