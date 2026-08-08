'use client';

import { companyValuesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function ValuesPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Giá trị cốt lõi"
      queryKey="company-values"
      createHref="/brand/values/form/"
      editHref={(id) => `/brand/values/form/?id=${id}`}
      createLabel="Thêm giá trị"
      listFn={(q) => companyValuesApi.list(q)}
      removeFn={(id) => companyValuesApi.remove(id)}
      titleOf={(r) => String(r.name || `#${r.id}`)}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
