'use client';

import { reviewsApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function ReviewsPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Cảm nhận khách hàng"
      queryKey="reviews"
      createHref="/brand/reviews/form/"
      editHref={(id) => `/brand/reviews/form/?id=${id}`}
      createLabel="Thêm cảm nhận KH"
      listFn={(q) => reviewsApi.list(q)}
      removeFn={(id) => reviewsApi.remove(id)}
      titleOf={(r) => String(r.author_name || `#${r.id}`)}
      thumbOf={(r) => {
        const a = r.avatar as { url_thumb?: string; url?: string } | null | undefined;
        return a?.url_thumb || a?.url || null;
      }}
      statusOptions={[
        { value: 'published', label: 'Xuất bản' },
        { value: 'draft', label: 'Nháp' },
        { value: 'hidden', label: 'Ẩn' },
      ]}
      badgeOf={(r) => <Badge>{String(r.status || '')}</Badge>}
    />
  );
}
