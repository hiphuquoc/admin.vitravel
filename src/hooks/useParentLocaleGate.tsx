'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE } from '@/lib/locale';
import type { SeoParentOption } from '@/components/ui/SeoBox';

export type ParentLocaleGateState = {
  /** Trang cha đã chọn nhưng chưa có bản dịch đúng locale đang sửa. */
  blocked: boolean;
  parent: SeoParentOption | null;
  locale: string;
  defaultLocale: string;
};

const emptyGate: ParentLocaleGateState = {
  blocked: false,
  parent: null,
  locale: DEFAULT_LOCALE,
  defaultLocale: DEFAULT_LOCALE,
};

const ParentLocaleGateContext = createContext<ParentLocaleGateState>(emptyGate);

/** True khi trang cha thiếu bản dịch locale hiện tại. */
export function isParentLocaleMissing(
  parentId: string | null | undefined,
  parents: SeoParentOption[] | null | undefined,
  locale: string,
  defaultLocale = DEFAULT_LOCALE,
): { blocked: boolean; parent: SeoParentOption | null } {
  const id = String(parentId || '').trim();
  if (!id) {
    return { blocked: false, parent: null };
  }

  const list = Array.isArray(parents) ? parents : [];
  const parent = list.find((p) => String(p.id) === id) ?? null;

  // Meta thường theo locale tab — thiếu has_locale / slug_full = chưa dịch.
  if (!parent) {
    // Không tìm thấy trong list (meta lệch) → khóa an toàn khi ≠ mặc định.
    const blocked =
      String(locale || '').toLowerCase() !== String(defaultLocale || DEFAULT_LOCALE).toLowerCase();
    return { blocked, parent: null };
  }

  const hasLocale =
    typeof parent.has_locale === 'boolean'
      ? parent.has_locale
      : Boolean(String(parent.slug_full || '').trim());

  return { blocked: !hasLocale, parent };
}

type GateProviderProps = {
  children: ReactNode;
  seoParentId?: string | null;
  seoParents?: SeoParentOption[] | null;
  locale?: string;
  defaultLocale?: string;
};

/** Cung cấp trạng thái khóa khi trang cha thiếu locale đang chọn. */
export function ParentLocaleGateProvider({
  children,
  seoParentId,
  seoParents,
  locale = DEFAULT_LOCALE,
  defaultLocale = DEFAULT_LOCALE,
}: GateProviderProps) {
  const value = useMemo<ParentLocaleGateState>(() => {
    const { blocked, parent } = isParentLocaleMissing(
      seoParentId,
      seoParents,
      locale,
      defaultLocale,
    );
    return { blocked, parent, locale, defaultLocale };
  }, [seoParentId, seoParents, locale, defaultLocale]);

  return (
    <ParentLocaleGateContext.Provider value={value}>{children}</ParentLocaleGateContext.Provider>
  );
}

export function useParentLocaleGate(): ParentLocaleGateState {
  return useContext(ParentLocaleGateContext);
}

export function useParentLocaleBlocked(): boolean {
  return useContext(ParentLocaleGateContext).blocked;
}
