/**
 * Build absolute public-site URLs for admin list chips + “Xem trang”.
 *
 * Origin priority:
 * 1. Active project's domain matching host mode (local → *.dev, prod → *.net/*.com/…)
 * 2. Project primary_domain / first domain
 * 3. NEXT_PUBLIC_SITE_ORIGIN fallback (shared ViTravel host)
 *
 * `?project=` is only appended when the URL still uses the shared SITE_ORIGIN
 * (multi-tenant preview on one host). Dedicated project hosts do not need it.
 */
import { getProjectCode, getStoredUser } from '@/lib/api';
import type { AdminProject, AdminUser } from '@/lib/types';

export type PublicHostMode = 'local' | 'prod';

function siteOriginFallback(): string {
  return (process.env.NEXT_PUBLIC_SITE_ORIGIN || '').replace(/\/$/, '');
}

/** local = bản .dev; prod = miền public (.net / .com / …). */
export function getPublicHostMode(): PublicHostMode {
  const explicit = (process.env.NEXT_PUBLIC_PUBLIC_HOST_MODE || '').toLowerCase().trim();
  if (explicit === 'local' || explicit === 'dev') return 'local';
  if (explicit === 'prod' || explicit === 'production') return 'prod';

  const site = siteOriginFallback();
  if (!site) return 'local';
  try {
    const host = new URL(site).hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.dev') || host.endsWith('.local')) {
      return 'local';
    }
  } catch {
    if (/\.dev\b/i.test(site) || /localhost/i.test(site)) return 'local';
  }
  return 'prod';
}

function normalizeHost(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function bareHost(host: string): string {
  return host.replace(/^www\./, '');
}

function isLocalHost(host: string): boolean {
  const h = bareHost(host);
  return h === 'localhost' || h.endsWith('.dev') || h.endsWith('.local');
}

function isProdHost(host: string): boolean {
  const h = bareHost(host);
  if (isLocalHost(h)) return false;
  return /\.(net|com|vn|org|io|app)$/i.test(h);
}

function originScheme(): string {
  const site = siteOriginFallback();
  if (site.startsWith('http://')) return 'http';
  return 'https';
}

function toOrigin(host: string): string {
  return `${originScheme()}://${host}`;
}

/**
 * Pick the best public host for a project given local/prod mode.
 * Prefer non-www. Exported for tests / reuse.
 */
export function pickProjectPublicHost(
  project: Pick<AdminProject, 'primary_domain' | 'domains'> | null | undefined,
  mode: PublicHostMode = getPublicHostMode(),
): string | null {
  if (!project) return null;

  const hosts: string[] = [];
  for (const row of project.domains || []) {
    const h = normalizeHost(row.domain);
    if (h) hosts.push(h);
  }
  const primary = normalizeHost(project.primary_domain || '');
  if (primary && !hosts.includes(primary)) hosts.push(primary);
  if (!hosts.length) return null;

  const unique = [...new Set(hosts)];
  const nonWww = unique.filter((h) => !h.startsWith('www.'));
  const pool = nonWww.length ? nonWww : unique;

  if (mode === 'local') {
    return pool.find(isLocalHost) || (primary && isLocalHost(primary) ? primary : null) || pool[0] || null;
  }

  return (
    pool.find(isProdHost) ||
    pool.find((h) => !isLocalHost(h)) ||
    (primary && !isLocalHost(primary) ? primary : null) ||
    pool[0] ||
    null
  );
}

/** Active project from session (login /me payload). */
export function getActiveAdminProject(): AdminProject | null {
  if (typeof window === 'undefined') return null;
  const code = getProjectCode();
  const user = getStoredUser<AdminUser>();
  const projects = user?.projects ?? [];
  if (!projects.length) return null;
  if (code) {
    const match = projects.find((p) => p.code === code);
    if (match) return match;
  }
  return projects[0] ?? null;
}

/**
 * Absolute origin for the active (or given) project.
 * Falls back to NEXT_PUBLIC_SITE_ORIGIN when the project has no domains.
 */
export function resolvePublicSiteOrigin(
  project?: Pick<AdminProject, 'code' | 'primary_domain' | 'domains'> | null,
): string {
  const active = project === undefined ? getActiveAdminProject() : project;
  const host = pickProjectPublicHost(active, getPublicHostMode());
  if (host) return toOrigin(host);

  const fallback = siteOriginFallback();
  if (fallback) return fallback;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

function shouldAppendProjectQuery(absoluteUrl: string, projectCode: string | null): boolean {
  if (!projectCode) return false;

  const flag = (process.env.NEXT_PUBLIC_PUBLIC_PROJECT_QUERY || '1').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;

  // Dedicated project host already identifies the tenant — skip ?project=.
  const shared = siteOriginFallback();
  if (!shared) return true;
  try {
    const pageHost = new URL(absoluteUrl).hostname.toLowerCase();
    const sharedHost = new URL(shared).hostname.toLowerCase();
    if (bareHost(pageHost) !== bareHost(sharedHost)) return false;
  } catch {
    /* keep append */
  }
  return true;
}

function appendProjectQuery(url: string): string {
  const code = typeof window !== 'undefined' ? getProjectCode() : null;
  if (!shouldAppendProjectQuery(url, code)) return url;

  try {
    const abs = url.startsWith('http')
      ? new URL(url)
      : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    abs.searchParams.set('project', code!);
    if (url.startsWith('http')) return abs.toString();
    return `${abs.pathname}${abs.search}${abs.hash}`;
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}project=${encodeURIComponent(code!)}`;
  }
}

export type PublicPageUrlOptions = {
  /**
   * Bản nháp / chưa publish — thêm `?preview=1` để public local mở được
   * (ViewDataService + SeoService chỉ bỏ published-only khi preview trên local).
   */
  preview?: boolean;
};

/**
 * Shared builder: list slug chips, SeoBox preview, ViewPublicButton, FormFooter.
 */
export function publicPageUrl(
  slugFull: string | null | undefined,
  locale = 'vi',
  defaultLocale = 'vi',
  options?: PublicPageUrlOptions,
): string | null {
  if (slugFull == null || !String(slugFull).trim()) return null;

  const raw = String(slugFull).trim();
  // Allow passing "/" for homepage while treating empty-after-slash as home.
  const trimmedPath = raw === '/' ? '/' : `/${raw.replace(/^\/+/, '')}`;
  const localized =
    locale && locale !== defaultLocale
      ? `/${locale}${trimmedPath === '/' ? '' : trimmedPath}`
      : trimmedPath;

  const origin = resolvePublicSiteOrigin().replace(/\/$/, '');
  let url: string;
  if (origin) {
    url = `${origin}${localized}`;
  } else if (typeof window !== 'undefined') {
    url = `${window.location.origin}${localized}`;
  } else {
    url = localized;
  }

  url = appendProjectQuery(url);

  if (options?.preview) {
    try {
      const abs = url.startsWith('http')
        ? new URL(url)
        : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      abs.searchParams.set('preview', '1');
      if (url.startsWith('http')) return abs.toString();
      return `${abs.pathname}${abs.search}${abs.hash}`;
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}preview=1`;
    }
  }

  return url;
}
