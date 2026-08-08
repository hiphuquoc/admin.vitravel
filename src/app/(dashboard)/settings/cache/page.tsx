'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Trang cũ — xóa cache giờ chạy trực tiếp từ menu sidebar. */
export default function CachePageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
