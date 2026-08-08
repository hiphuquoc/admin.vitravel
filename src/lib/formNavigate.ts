import { getBasePath } from '@/lib/api';

type RouterLike = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

function stripBase(pathname: string): string {
  const base = getBasePath().replace(/\/$/, '');
  let path = pathname || '/';
  if (base && path.startsWith(base)) {
    path = path.slice(base.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  // So sánh không phụ thuộc trailing slash
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

function urlKey(pathname: string, search: string): string {
  const path = stripBase(pathname);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = new URLSearchParams(sorted).toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * router.replace cho form save — không nhảy scroll lên đầu trang.
 * Bỏ qua navigation nếu URL không đổi.
 */
export function replaceFormUrl(router: RouterLike, href: string): void {
  if (typeof window === 'undefined') {
    router.replace(href, { scroll: false });
    return;
  }

  const next = new URL(href, window.location.origin);
  const currentKey = urlKey(window.location.pathname, window.location.search);
  const targetKey = urlKey(next.pathname, next.search);

  if (currentKey === targetKey) {
    return;
  }

  const y = window.scrollY;
  const root = document.documentElement;
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';

  router.replace(href, { scroll: false });

  const restore = () => window.scrollTo(0, y);
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      root.style.scrollBehavior = prevBehavior;
    });
  });
}
