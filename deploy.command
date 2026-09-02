#!/bin/zsh
set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "     Starting Auto-Deployment to GitHub"
echo "=========================================="

echo "[1/3] Adding files..."
git add -A

if git diff --cached --quiet; then
  echo "[2/3] No local changes to commit."
else
  echo "[2/3] Committing changes..."
  timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  git commit -m "Auto-update: $timestamp"
fi

echo "[3/3] Pushing to GitHub..."
git push

echo "=========================================="
echo "     Success! Website updated."
echo "=========================================="

if [[ -t 0 ]]; then
  echo
  read -k 1 "?Press any key to close..."
  echo
fi
