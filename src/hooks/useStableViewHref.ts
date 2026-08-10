'use client';

import { useRef } from 'react';

/**
 * Giữ href nút «Xem» ổn định khi detail refetch / slug tạm null sau Lưu —
 * tránh unmount nút → nhảy layout footer / header.
 */
export function useStableViewHref(href: string | null | undefined): string | null {
  const last = useRef<string | null>(null);
  if (href) {
    last.current = href;
  }
  return href || last.current;
}
