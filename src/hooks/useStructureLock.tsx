'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, isStructureLocked } from '@/lib/locale';
import {
  ParentLocaleGateProvider,
  useParentLocaleBlocked,
} from '@/hooks/useParentLocaleGate';
import type { SeoParentOption } from '@/components/ui/SeoBox';

const StructureLockContext = createContext(false);

type ProviderProps = {
  children: ReactNode;
  /** Ép khóa cấu trúc trực tiếp (ưu tiên hơn locale). */
  locked?: boolean;
  locale?: string;
  defaultLocale?: string;
  /** Trang cha SEO đang chọn — khóa hành động nếu thiếu bản dịch locale. */
  seoParentId?: string | null;
  seoParents?: SeoParentOption[] | null;
};

/**
 * Bọc form đa ngôn ngữ.
 * - Structure lock: ≠ locale mặc định → khóa trường cấu trúc.
 * - Parent locale gate: trang cha chưa có bản dịch locale → khóa Lưu / AI dịch.
 */
export function StructureLockProvider({
  children,
  locked,
  locale = DEFAULT_LOCALE,
  defaultLocale = DEFAULT_LOCALE,
  seoParentId,
  seoParents,
}: ProviderProps) {
  const value = locked ?? isStructureLocked(locale, defaultLocale);
  return (
    <StructureLockContext.Provider value={value}>
      <ParentLocaleGateProvider
        seoParentId={seoParentId}
        seoParents={seoParents}
        locale={locale}
        defaultLocale={defaultLocale}
      >
        {children}
      </ParentLocaleGateProvider>
    </StructureLockContext.Provider>
  );
}

export function useStructureLocked(): boolean {
  return useContext(StructureLockContext);
}

/** Khóa nút Lưu / AI / submit — trang cha thiếu locale. */
export function useFormActionsLocked(): boolean {
  return useParentLocaleBlocked();
}
