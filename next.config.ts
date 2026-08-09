import type { NextConfig } from 'next';

/** Admin chạy trên host riêng (admin.vitravel.dev / .net) — không còn prefix /he-thong. */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const isProdBuild = process.env.ADMIN_BUILD === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(basePath ? { basePath } : {}),
  // Chỉ static export khi build production (npm run build). Dev = live HMR.
  ...(isProdBuild ? { output: 'export' as const } : {}),
  trailingSlash: true,
  // Không 308 /api/* → .../ (làm gãy POST login qua rewrite)
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  sassOptions: {
    includePaths: ['./src/styles'],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_API_BASE:
      process.env.NEXT_PUBLIC_API_BASE ||
      (process.env.ADMIN_API_ORIGIN
        ? `${process.env.ADMIN_API_ORIGIN.replace(/\/$/, '')}/api/v1/admin`
        : '') ||
      (process.env.NEXT_PUBLIC_SITE_ORIGIN
        ? `${process.env.NEXT_PUBLIC_SITE_ORIGIN.replace(/\/$/, '')}/api/v1/admin`
        : ''),
    NEXT_PUBLIC_SITE_ORIGIN:
      process.env.NEXT_PUBLIC_SITE_ORIGIN || process.env.ADMIN_API_ORIGIN || '',
  },
  async rewrites() {
    if (isProdBuild) return [];
    const origin = (
      process.env.ADMIN_API_ORIGIN ||
      process.env.NEXT_PUBLIC_SITE_ORIGIN ||
      ''
    ).replace(/\/$/, '');
    if (!origin) {
      // Dev không set origin → không rewrite; dùng NEXT_PUBLIC_API_BASE absolute.
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${origin}/api/:path*`,
        ...(basePath ? { basePath: false as const } : {}),
      },
    ];
  },
};

export default nextConfig;
