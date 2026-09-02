'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getFormHydrationProjectScope } from '@/lib/formHydrationScope';

/**
 * Chỉ hydrate form khi đổi entity (id), locale hoặc dự án — bỏ qua refetch nền trên list.
 * Form edit còn tắt live refetch qua EDIT_FORM_QUERY_OPTIONS.
 *
 * Sau khi save thành công: gọi `markFormHydrationStale(ref)` để lần data mới được nạp lại.
 */
export function useFormHydrationKey(
  entityKey: string | number | null | undefined,
  locale?: string | null,
): MutableRefObject<string | null> {
  return useRef<string | null>(null);
}

export function formHydrationKey(
  entityKey: string | number | null | undefined,
  locale?: string | null,
): string | null {
  if (entityKey === null || entityKey === undefined || entityKey === '') {
    return null;
  }
  const project = getFormHydrationProjectScope();
  const loc = locale && locale !== '' ? String(locale) : '_';
  return `${project}:${entityKey}:${loc}`;
}

/** @returns true nếu nên chạy setForm từ server data lần này */
export function beginFormHydration(
  lastKeyRef: MutableRefObject<string | null>,
  entityKey: string | number | null | undefined,
  locale?: string | null,
): boolean {
  const key = formHydrationKey(entityKey, locale);
  if (!key) {
    return false;
  }
  if (lastKeyRef.current === key) {
    return false;
  }
  lastKeyRef.current = key;
  return true;
}

/** Cho phép hydrate lại sau save / đổi entity từ ngoài. */
export function markFormHydrationStale(lastKeyRef: MutableRefObject<string | null>): void {
  lastKeyRef.current = null;
}

/**
 * Xóa form ngay khi đổi dự án ở header — tránh lưu nhầm data dự án cũ trong lúc query mới đang tải.
 * Gọi cùng với useScopedQueryKey trên trang edit.
 */
export function useResetFormOnProjectChange(
  hydrateKeyRef: MutableRefObject<string | null>,
  onReset: () => void,
): void {
  const { projectCode } = useAuth();
  const prevProjectRef = useRef(projectCode);

  useEffect(() => {
    if (prevProjectRef.current === projectCode) return;
    prevProjectRef.current = projectCode;
    markFormHydrationStale(hydrateKeyRef);
    onReset();
  }, [projectCode, hydrateKeyRef, onReset]);
}

/**
 * Helper effect: hydrate một lần mỗi id+locale khi `data` có mặt.
 * `hydrate` chỉ được gọi khi key đổi — an toàn với refetch nền.
 */
export function useHydrateFormOnce(
  data: unknown,
  entityKey: string | number | null | undefined,
  locale: string | null | undefined,
  hydrate: () => void,
): MutableRefObject<string | null> {
  const lastKeyRef = useRef<string | null>(null);
  const { projectCode } = useAuth();

  useEffect(() => {
    if (!data) {
      return;
    }
    if (!beginFormHydration(lastKeyRef, entityKey, locale)) {
      return;
    }
    hydrate();
    // hydrate cố ý không đưa vào deps — caller ổn định bằng closure snapshot của data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, entityKey, locale, projectCode]);

  return lastKeyRef;
}
