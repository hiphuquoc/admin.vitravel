# ViTravel Admin Console

Next.js 15 admin app — **host riêng**: `admin.vitravel.dev` (local) / `admin.vitravel.net` (prod).

API Laravel: `/api/v1/admin/*` trên domain public (CORS).

## Dev

```bash
cp .env.local.example .env.local
# ADMIN_API_ORIGIN + NEXT_PUBLIC_API_BASE trỏ Laravel
# Laravel .env: CORS_ALLOWED_ORIGINS=http://localhost:3100,https://admin.vitravel.dev

npm ci
npm run dev   # → http://localhost:3100/
```

## Production build (static)

```bash
# API absolute — bắt buộc khi admin ≠ origin Laravel
export NEXT_PUBLIC_API_BASE=https://vitravel.net/api/v1/admin
export NEXT_PUBLIC_SITE_ORIGIN=https://vitravel.net
npm run build
# → out/  — Nginx root của admin.vitravel.net trỏ vào đây
# hoặc: ADMIN_PUBLIC_DIR=/www/wwwroot/admin.vitravel/out npm run build
```

## Routes

| Trang | Path |
|-------|------|
| Đăng nhập | `/login/` |
| Dashboard | `/` |
| Gói Tour | `/tours/packages/` |
| Users | `/settings/users/` |

Legacy URL trên domain public (`/he-thong/*`, `/loginAdmin`) redirect sang `ADMIN_APP_URL`.

Docs deploy: `vitravel.dev/docs/13-deploy-aapanel-vps.md`.
