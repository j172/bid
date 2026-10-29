#!/bin/sh
# One-off remote execution script for Issue #375:
# 1. Exports a 0600 JSON snapshot of all @example.com rows into ~/bid_app/.backups/
# 2. Runs cleanup-example-data.mjs --dry-run to log the before-state
# 3. Runs cleanup-example-data.mjs --confirm inside a single MySQL transaction
# 4. Runs cleanup-example-data.mjs --dry-run again to verify 0 remaining rows

set -eu

NODE_VERSION="v24.19.0"
NVM_NODE_DIR="$HOME/.nvm/versions/node/$NODE_VERSION"
APP_DIR="$HOME/bid_app"
NODE_BIN="$NVM_NODE_DIR/bin/node"

cd "$APP_DIR"

umask 077
mkdir -p "$APP_DIR/.backups"
BACKUP_FILE="$APP_DIR/.backups/example-cleanup-backup-$(date +%Y%m%d-%H%M%S).json"

echo "=== [1/4] Backing up @example.com records to $BACKUP_FILE ==="
"$NODE_BIN" scripts/cleanup-example-data.mjs --backup "$BACKUP_FILE"
test -s "$BACKUP_FILE"
ls -la "$BACKUP_FILE"

echo "=== [2/4] Pre-cleanup dry-run ==="
"$NODE_BIN" scripts/cleanup-example-data.mjs --dry-run

echo "=== [3/4] Executing transactional cleanup (--confirm) ==="
"$NODE_BIN" scripts/cleanup-example-data.mjs --confirm

echo "=== [4/4] Post-cleanup verification dry-run ==="
"$NODE_BIN" scripts/cleanup-example-data.mjs --dry-run
