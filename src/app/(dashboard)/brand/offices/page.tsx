'use client';

import { officesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function OfficesPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Văn phòng"
      queryKey="offices"
      createHref="/brand/offices/form/"
      editHref={(id) => `/brand/offices/form/?id=${id}`}
      createLabel="Thêm văn phòng"
      listFn={(q) => officesApi.list(q)}
      removeFn={(id) => officesApi.remove(id)}
      titleOf={(r) => String(r.city_label || `#${r.id}`)}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
