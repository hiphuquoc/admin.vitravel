#!/usr/bin/env bash
# Build production static export cho host admin riêng (không còn /he-thong trên Laravel).
set -euo pipefail
cd "$(dirname "$0")/.."
export ADMIN_BUILD=1
# API absolute URL tới Laravel public (bắt buộc khi admin khác origin)
export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE_PROD:-${NEXT_PUBLIC_API_BASE:-https://vitravel.dev/api/v1/admin}}"
# Không set basePath — admin root = /
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"

npx next build

# Tuỳ chọn: copy out/ sang thư mục deploy (Nginx root của admin.vitravel.*)
# ADMIN_PUBLIC_DIR=/www/wwwroot/admin.vitravel/out npm run build
if [[ -n "${ADMIN_PUBLIC_DIR:-}" ]]; then
  node scripts/sync-to-public.cjs
  echo "Synced out/ → ${ADMIN_PUBLIC_DIR}"
else
  echo "Build OK → $(pwd)/out/"
  echo "Trỏ Nginx root của admin.vitravel.dev|.net vào thư mục out/ (hoặc set ADMIN_PUBLIC_DIR)."
fi
echo "Dev HMR: npm run dev → http://localhost:3100/"
