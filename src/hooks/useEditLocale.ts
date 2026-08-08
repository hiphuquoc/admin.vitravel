'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/lib/locale';
import { useAppRouter } from '@/hooks/useAppRouter';

/** Locale edit từ query `?locale=` — đồng bộ URL + reload bản dịch */
export function useEditLocale(defaultLocale = DEFAULT_LOCALE) {
  const router = useAppRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const locale = useMemo(() => {
    const raw = (search.get('locale') || defaultLocale).toLowerCase();
    return raw || defaultLocale;
  }, [search, defaultLocale]);

  const setLocale = useCallback(
    (code: string, options?: { confirmIfDirty?: boolean; isDirty?: boolean }) => {
      if (code === locale) return false;
      if (options?.confirmIfDirty && options.isDirty) {
        const ok = window.confirm(
          'Bạn có thay đổi chưa lưu. Đổi ngôn ngữ sẽ mất các thay đổi đó. Tiếp tục?',
        );
        if (!ok) return false;
      }
      const params = new URLSearchParams(search.toString());
      params.set('locale', code);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return true;
    },
    [locale, pathname, router, search],
  );

  return { locale, setLocale };
}
