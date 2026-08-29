'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { serviceCategoriesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';
import { resolveProjectServiceCluster, serviceClusterTitle } from '@/lib/nav';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';

function Inner() {
  const search = useSearchParams();
  const router = useAppRouter();
  const { serviceClusters } = useAuth();
  const requested = search.get('cluster') || '';
  const cluster = resolveProjectServiceCluster(requested, serviceClusters);

  useEffect(() => {
    if (!requested || requested === cluster) return;
    const next = new URLSearchParams(search.toString());
    next.set('cluster', cluster);
    router.replace(`/services/categories/?${next.toString()}`);
  }, [requested, cluster, router, search]);

  const kind = serviceClusterTitle(cluster);

  return (
    <ResourceListPage
      eyebrow={kind}
      title={`Danh mục ${kind}`}
      description={
        cluster === 'stay'
          ? 'Sửa một danh mục để dán URL Booking.com và cào chỗ nghỉ con (URL/cấp trang kế thừa danh mục).'
          : cluster === 'experience'
            ? 'Danh mục trải nghiệm/du thuyền — có thể cào từ Booking.com (card & hạng phòng giống lưu trú).'
            : 'Nhóm danh mục theo cụm dịch vụ.'
      }
      queryKey={`service-categories-${cluster || 'all'}`}
      createHref={
        cluster
          ? `/services/categories/form/?cluster=${cluster}`
          : '/services/categories/form/'
      }
      editHref={(id) =>
        cluster
          ? `/services/categories/form/?id=${id}&cluster=${cluster}`
          : `/services/categories/form/?id=${id}`
      }
      createLabel="Thêm danh mục"
      unitLabel="danh mục"
      extraQuery={cluster ? { cluster } : undefined}
      listFn={(q) => serviceCategoriesApi.list(q)}
      removeFn={(id) => serviceCategoriesApi.remove(id)}
      titleOf={(r) => String(r.name || `#${r.id}`)}
      slugOf={(r) => (r.seo as { slug_full?: string } | undefined)?.slug_full}
      thumbOf={(r) => {
        const b = r.banner as { url_thumb?: string; url?: string } | null | undefined;
        return b?.url_thumb || b?.url || null;
      }}
      badgeOf={(r) => (
        <>
          <Badge>{String(r.cluster_label || r.cluster || '')}</Badge>
          <Badge tone={r.is_active ? 'success' : 'neutral'}>
            {r.is_active ? 'Đang bật' : 'Tắt'}
          </Badge>
        </>
      )}
    />
  );
}

export default function ServiceCategoriesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <Inner />
    </Suspense>
  );
}
