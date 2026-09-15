'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function RedirectInner({ to }: { to: string }) {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(q ? `${to}?${q}` : to);
  }, [router, search, to]);
  return <p>Chuyển tới Catalog chỗ nghỉ…</p>;
}

export function CatalogJobsRedirect({ to = '/catalog/jobs/' }: { to?: string }) {
  return (
    <Suspense>
      <RedirectInner to={to} />
    </Suspense>
  );
}
