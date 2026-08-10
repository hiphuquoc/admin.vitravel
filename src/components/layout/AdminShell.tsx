'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, LogOut, Menu, UserRound } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS, isNavActive, type NavItem } from '@/lib/nav';
import { navAllowed } from '@/lib/permissions';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { ProjectSwitcher } from '@/components/ui/ProjectSwitcher';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAppRouter } from '@/hooks/useAppRouter';
import toast from '@/lib/toast';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { clearHtmlCacheWithProgress } from '@/lib/clearHtmlCache';
import { AiFormTranslateProvider } from '@/hooks/useAiFormTranslate';
import { AiFilledFieldsProvider } from '@/hooks/useAiFilledFields';
import { MediaUploadBusyProvider } from '@/hooks/useMediaUploadBusy';

function buildCrumbs(pathname: string, hasId: boolean, searchParams: URLSearchParams) {
  const crumbs: { label: string; href?: string }[] = [{ label: 'Admin', href: '/' }];

  if (pathname.startsWith('/account')) {
    crumbs.push({ label: 'Tài khoản' });
    crumbs.push({ label: 'Hồ sơ của tôi', href: '/account/' });
    return crumbs;
  }

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavActive(pathname, item, searchParams)) {
        crumbs.push({ label: group.title });
        crumbs.push({ label: item.pageTitle || item.label, href: item.href });
        if (pathname.includes('/form')) {
          crumbs.push({ label: hasId ? 'Chỉnh sửa' : 'Thêm mới' });
        }
        return crumbs;
      }
    }
  }

  crumbs.push({ label: 'Bảng điều khiển' });
  return crumbs;
}

function ShellInner({ children }: { children: ReactNode }) {
  const { user, logout, can, projectCode } = useAuth();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useAppRouter();
  const [open, setOpen] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const progress = useBlockingProgress();

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.action === 'clear-html-cache') {
          return can('settings.update');
        }
        const path = item.match || item.href.split('?')[0] || item.href;
        return navAllowed(path, user, projectCode);
      }),
    })).filter((group) => group.items.length > 0);
  }, [user, projectCode, can]);

  const crumbs = buildCrumbs(pathname, !!search.get('id'), search);
  const pageTitle = crumbs[crumbs.length - 1]?.label || 'Admin';

  const searchKey = search.toString();

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const active = nav.querySelector<HTMLElement>('.sidebar__link--active');
    if (!active) return;

    const frame = window.requestAnimationFrame(() => {
      const navRect = nav.getBoundingClientRect();
      const linkRect = active.getBoundingClientRect();
      const pad = 12;

      if (linkRect.top < navRect.top + pad) {
        nav.scrollBy({ top: linkRect.top - navRect.top - pad, behavior: 'smooth' });
      } else if (linkRect.bottom > navRect.bottom - pad) {
        nav.scrollBy({ top: linkRect.bottom - navRect.bottom + pad, behavior: 'smooth' });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchKey]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const runNavAction = async (item: NavItem) => {
    if (item.action !== 'clear-html-cache') return;
    if (cacheClearing) return;

    setCacheClearing(true);
    setOpen(false);
    try {
      const cleared = await clearHtmlCacheWithProgress(progress);
      if (cleared > 0) {
        toast.success(`Đã xóa ${cleared.toLocaleString('vi-VN')} file cache HTML`);
      }
    } catch (err) {
      await progress.fail({
        title: 'Xóa cache thất bại',
        detail: err instanceof Error ? err.message : 'Không rõ lỗi',
      });
      toast.error(err instanceof Error ? err.message : 'Xóa cache thất bại');
    } finally {
      setCacheClearing(false);
    }
  };

  return (
    <div className="shell">
      <div
        className={clsx('sidebar-backdrop', open && 'sidebar-backdrop--open')}
        onClick={() => setOpen(false)}
      />

      <aside className={clsx('sidebar', open && 'sidebar--open')}>
        <div className="sidebar__brand">
          <div className="sidebar__mark">V</div>
          <div>
            <div className="sidebar__wordmark">ViTravel</div>
            <div className="sidebar__tagline">Admin Console</div>
          </div>
        </div>

        <nav ref={navRef} className="sidebar__nav">
          {visibleGroups.map((group) => (
            <div key={group.key} className="sidebar__group">
              <div className="sidebar__group-title">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item, search);
                const key = `${item.action || item.href}-${item.matchQuery ? JSON.stringify(item.matchQuery) : ''}`;

                if (item.action) {
                  const busy = item.action === 'clear-html-cache' && cacheClearing;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={clsx(
                        'sidebar__link',
                        'sidebar__link--action',
                        busy && 'sidebar__link--busy',
                      )}
                      disabled={busy}
                      onClick={() => void runNavAction(item)}
                    >
                      <Icon />
                      {busy ? 'Đang xóa cache…' : item.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={key}
                    href={item.href}
                    className={clsx('sidebar__link', active && 'sidebar__link--active')}
                    onClick={() => setOpen(false)}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {user ? (
          <div className="sidebar__user">
            <Link href="/account/" className="sidebar__avatar" title="Hồ sơ của tôi">
              {user.name.slice(0, 1).toUpperCase()}
            </Link>
            <Link href="/account/" className="sidebar__user-link" title="Hồ sơ của tôi">
              <div className="sidebar__user-name">{user.name}</div>
              <div className="sidebar__user-email">{user.email}</div>
            </Link>
            <Link
              href="/account/"
              className="sidebar__user-icon-link"
              aria-label="Hồ sơ của tôi"
              title="Hồ sơ của tôi"
            >
              <UserRound size={18} color="rgba(255,255,255,0.7)" />
            </Link>
            <button type="button" onClick={handleLogout} aria-label="Đăng xuất" title="Đăng xuất">
              <LogOut size={18} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        ) : null}
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="topbar__menu"
              onClick={() => setOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={18} />
            </button>

            <div className="topbar__trail">
              <nav className="breadcrumb" aria-label="Breadcrumb">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <span key={`${c.label}-${i}`} className="breadcrumb__item">
                      {i > 0 ? (
                        <ChevronRight size={14} className="breadcrumb__sep" aria-hidden />
                      ) : null}
                      {c.href && !last ? (
                        <Link href={c.href} className="breadcrumb__link">
                          {c.label}
                        </Link>
                      ) : (
                        <span
                          className={clsx(
                            'breadcrumb__current',
                            last && 'breadcrumb__current--strong',
                          )}
                        >
                          {c.label}
                        </span>
                      )}
                    </span>
                  );
                })}
              </nav>
              <div className="topbar__page-title">{pageTitle}</div>
            </div>
          </div>

          <div className="topbar__right">
            <ProjectSwitcher />
            <ThemeSwitcher />
          </div>
        </header>
        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader variant="screen" />}>
      <AiFormTranslateProvider>
        <AiFilledFieldsProvider>
          <MediaUploadBusyProvider>
            <ShellInner>{children}</ShellInner>
          </MediaUploadBusyProvider>
        </AiFilledFieldsProvider>
      </AiFormTranslateProvider>
    </Suspense>
  );
}
