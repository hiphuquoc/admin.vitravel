'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { languagesApi } from '@/lib/services';
import type { LocaleOption } from '@/lib/locale';
import { createScopedQueryFn, useScopedQueryKey } from '@/hooks/useScopedQueryKey';

function mapLanguages(items: Record<string, unknown>[]): LocaleOption[] {
  return items.map((l) => ({
    code: String(l.code || ''),
    name: String(l.name || l.code || ''),
    name_native: String(l.name_native || ''),
    is_default: !!l.is_default,
  }));
}

/**
 * Danh sách ngôn ngữ cho LocaleSwitcher — cache theo dự án, giữ data cũ khi refetch/đổi key
 * để thanh tab không nhảy layout.
 */
export function useLanguagesOptions(enabled = true) {
  const queryKey = useScopedQueryKey('languages-options');

  const query = useQuery({
    queryKey,
    queryFn: createScopedQueryFn(async () => {
      const res = await languagesApi.list();
      return mapLanguages(res.items || []);
    }),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  return {
    languages: query.data ?? [],
    isFetching: query.isFetching,
    isPending: query.isPending,
  };
}
