import type { AdminUser } from './types';

/**
 * Nav path → required permission (mirrors config/admin_permissions.php nav_permissions).
 * `null` = always visible when authenticated.
 */
export const NAV_PERMISSIONS: Record<string, string | null> = {
  '/': 'dashboard.view',
  '/tours/packages': 'packages.view',
  '/tours/destinations': 'countries.view',
  '/tours/categories': 'tour_categories.view',
  '/tours/themes': 'travel_styles.view',
  '/cruises/packages': 'packages.view',
  '/cruises/types': 'cruise_types.view',
  '/services/products': 'services.view',
  '/services/categories': 'service_categories.view',
  '/settings/hubs': 'settings.view',
  '/content/slides': 'content.view',
  '/content/home': 'content.view',
  '/content/articles': 'content.view',
  '/content/blog-categories': 'content.view',
  '/brand': 'brand.view',
  '/leads': 'leads.view',
  '/settings/site': 'settings.view',
  '/settings/languages': 'settings.view',
  '/settings/media': 'media.view',
  '/settings/users': 'users.view',
  '/account': null,
};

function normalizePath(pathname: string): string {
  const clean = pathname.replace(/\/$/, '') || '/';
  return clean;
}

function permissionsForProject(user: AdminUser, projectCode?: string | null): string[] {
  if (user.is_super_admin) {
    return user.permissions?.length ? user.permissions : ['*'];
  }

  const projects = user.projects ?? [];
  if (projectCode) {
    const match = projects.find((p) => p.code === projectCode);
    if (match?.permissions?.length) {
      return match.permissions;
    }
  }

  if (user.permissions?.length) {
    return user.permissions;
  }

  const first = projects[0];
  return first?.permissions ?? [];
}

export function can(
  user: AdminUser | null | undefined,
  permission: string,
  projectCode?: string | null,
): boolean {
  if (!user) return false;
  if (permission === '' || permission === '*') {
    return !!user.is_super_admin;
  }
  if (user.is_super_admin) return true;

  const perms = permissionsForProject(user, projectCode);
  if (perms.includes('*')) return true;

  return perms.includes(permission);
}

/** Resolve required permission for a nav path (longest prefix match). */
export function permissionForNavPath(pathname: string): string | null | undefined {
  const path = normalizePath(pathname);

  if (path === '/account' || path.startsWith('/account/')) {
    return null;
  }

  let matched: string | null | undefined;
  let matchedLen = -1;

  for (const [key, perm] of Object.entries(NAV_PERMISSIONS)) {
    const base = normalizePath(key);
    const hit = path === base || (base !== '/' && path.startsWith(`${base}/`));
    if (!hit) continue;
    if (base.length > matchedLen) {
      matchedLen = base.length;
      matched = perm;
    }
  }

  return matched;
}

export function navAllowed(
  pathname: string,
  user: AdminUser | null | undefined,
  projectCode?: string | null,
): boolean {
  if (!user) return false;

  const needed = permissionForNavPath(pathname);
  if (needed === null) return true;
  if (needed === undefined) return true;

  return can(user, needed, projectCode);
}
