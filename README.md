# ViTravel Admin Console

Next.js 15 admin — host riêng: `admin.vitravel.dev` (local) / `admin.vitravel.net` (prod).

API Laravel: `/api/v1/admin/*` trên domain public (CORS).

## Quan trọng: env được bake lúc build

Static export (`out/`) **nhúng** `NEXT_PUBLIC_*` vào JS khi `npm run build`.  
Chỉ sửa `.env.local` trên server **không** đổi API URL — phải build lại.

## Dev

```bash
cp .env.local.example .env.local
# Trỏ Laravel local/staging (.dev)
# Laravel .env: CORS_ALLOWED_ORIGINS=http://localhost:3100,https://admin.vitravel.dev

npm ci
npm run dev   # → http://localhost:3100/
```

## Production build (static)

```bash
cp .env.production.example .env.production
# hoặc .env.local với:
#   NEXT_PUBLIC_API_BASE=https://vitravel.net/api/v1/admin
#   NEXT_PUBLIC_SITE_ORIGIN=https://vitravel.net
#   ADMIN_API_ORIGIN=https://vitravel.net

npm ci
npm run build
# → out/  — Nginx root admin.vitravel.net

# Kiểm tra URL đã bake:
grep -R "vitravel.net/api/v1/admin" out/_next/static/chunks | head -3
# Không còn vitravel.dev trong bundle:
# ! grep -R "vitravel.dev/api" out/_next/static/chunks
```

Laravel CORS (prod):

```env
CORS_ALLOWED_ORIGINS=https://admin.vitravel.net,https://admin.vitravel.dev,http://localhost:3100
ADMIN_APP_URL=https://admin.vitravel.net
```

## Routes

| Trang | Path |
|-------|------|
| Đăng nhập | `/login/` |
| Dashboard | `/` |
| Gói Tour | `/tours/packages/` |
| Users | `/settings/users/` |

Legacy URL trên domain public (`/he-thong/*`, `/loginAdmin`) redirect sang `ADMIN_APP_URL`.

Docs deploy: `vitravel` repo → `docs/13-deploy-aapanel-vps.md`.
