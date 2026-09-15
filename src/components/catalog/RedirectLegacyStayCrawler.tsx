'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/useAppRouter';

/** Bookmark cũ /services/stay-crawler → /catalog/jobs (P3.3). */
export function RedirectLegacyStayCrawler() {
  const path = usePathname() || '';
  const search = useSearchParams();
  const router = useAppRouter();

  useEffect(() => {
    if (!path.includes('/services/stay-crawler')) {
      return;
    }
    const qs = search.toString();
    let dest = '/catalog/jobs/';
    if (path.includes('/create')) {
      dest = '/catalog/jobs/create/';
    } else if (path.includes('/detail')) {
      dest = '/catalog/jobs/detail/';
    }
    router.replace(dest + (qs ? `?${qs}` : ''));
  }, [path, search, router]);

  return null;
}
