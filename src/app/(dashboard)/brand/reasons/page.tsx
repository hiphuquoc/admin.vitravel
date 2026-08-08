'use client';

import { reasonsApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function ReasonsPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Lý do chọn"
      queryKey="reasons"
      createHref="/brand/reasons/form/"
      editHref={(id) => `/brand/reasons/form/?id=${id}`}
      createLabel="Thêm lý do"
      listFn={(q) => reasonsApi.list(q)}
      removeFn={(id) => reasonsApi.remove(id)}
      titleOf={(r) => String(r.title || `#${r.id}`)}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
