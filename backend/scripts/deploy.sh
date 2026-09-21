#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest changes"
git pull

echo "==> Installing dependencies"
npm ci

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart orbit-backend

echo "==> Done"
sudo systemctl status orbit-backend --no-pager
