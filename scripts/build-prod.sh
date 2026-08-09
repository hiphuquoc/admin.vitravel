#!/usr/bin/env bash
# Build production static export cho host admin riêng.
# NEXT_PUBLIC_* được bake vào JS lúc build — sửa .env.local rồi PHẢI build lại.
set -euo pipefail
cd "$(dirname "$0")/.."

# Nạp .env.local / .env.production vào shell (không ghi đè biến đã export sẵn).
load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      # Bỏ quote bao ngoài
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ -z "${!key+x}" ]]; then
        export "$key=$val"
      fi
    fi
  done < "$f"
}

load_env_file .env.production
load_env_file .env.local

export ADMIN_BUILD=1
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"

# Absolute API bắt buộc khi admin ≠ origin Laravel (static export).
if [[ -z "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  if [[ -n "${ADMIN_API_ORIGIN:-}" ]]; then
    export NEXT_PUBLIC_API_BASE="${ADMIN_API_ORIGIN%/}/api/v1/admin"
  elif [[ -n "${NEXT_PUBLIC_SITE_ORIGIN:-}" ]]; then
    export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_SITE_ORIGIN%/}/api/v1/admin"
  else
    echo "ERROR: Thiếu NEXT_PUBLIC_API_BASE (hoặc ADMIN_API_ORIGIN / NEXT_PUBLIC_SITE_ORIGIN)." >&2
    echo "  Tạo .env.local hoặc .env.production, ví dụ:" >&2
    echo "    NEXT_PUBLIC_API_BASE=https://vitravel.net/api/v1/admin" >&2
    echo "    NEXT_PUBLIC_SITE_ORIGIN=https://vitravel.net" >&2
    echo "    ADMIN_API_ORIGIN=https://vitravel.net" >&2
    exit 1
  fi
fi

if [[ -z "${NEXT_PUBLIC_SITE_ORIGIN:-}" && -n "${ADMIN_API_ORIGIN:-}" ]]; then
  export NEXT_PUBLIC_SITE_ORIGIN="${ADMIN_API_ORIGIN%/}"
fi

echo "==> Build admin"
echo "    NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}"
echo "    NEXT_PUBLIC_SITE_ORIGIN=${NEXT_PUBLIC_SITE_ORIGIN:-"(empty)"}"

npx next build

if [[ -n "${ADMIN_PUBLIC_DIR:-}" ]]; then
  node scripts/sync-to-public.cjs
  echo "Synced out/ → ${ADMIN_PUBLIC_DIR}"
else
  echo "Build OK → $(pwd)/out/"
  echo "Trỏ Nginx root của admin.vitravel.* vào out/ (hoặc set ADMIN_PUBLIC_DIR)."
fi
