/**
 * Build public site URL from SEO slug_full (+ locale prefix when non-default).
 * Prefer NEXT_PUBLIC_SITE_ORIGIN (dev: same as ADMIN_API_ORIGIN).
 *
 * When admin has an active project (localStorage) and query override is enabled
 * (default on), appends ?project={code} so shared-origin previews resolve the
 * correct tenant (avoids 404 when cookie/host still points at another project).
 */
import { getProjectCode } from '@/lib/api';

function appendProjectQuery(url: string): string {
  const code = typeof window !== 'undefined' ? getProjectCode() : null;
  if (!code) return url;

  // Opt out: NEXT_PUBLIC_PUBLIC_PROJECT_QUERY=0|false
  const flag = (process.env.NEXT_PUBLIC_PUBLIC_PROJECT_QUERY || '1').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return url;

  try {
    const abs = url.startsWith('http')
      ? new URL(url)
      : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    abs.searchParams.set('project', code);
    if (url.startsWith('http')) return abs.toString();
    return `${abs.pathname}${abs.search}${abs.hash}`;
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}project=${encodeURIComponent(code)}`;
  }
}

export function publicPageUrl(
  slugFull: string | null | undefined,
  locale = 'vi',
  defaultLocale = 'vi',
): string | null {
  if (!slugFull || !String(slugFull).trim()) return null;

  const path = `/${String(slugFull).replace(/^\/+/, '')}`;
  const localized =
    locale && locale !== defaultLocale ? `/${locale}${path === '/' ? '' : path}` : path;

  const origin = (process.env.NEXT_PUBLIC_SITE_ORIGIN || '').replace(/\/$/, '');
  let url: string;
  if (origin) {
    url = `${origin}${localized}`;
  } else if (typeof window !== 'undefined') {
    url = `${window.location.origin}${localized}`;
  } else {
    url = localized;
  }

  return appendProjectQuery(url);
}
