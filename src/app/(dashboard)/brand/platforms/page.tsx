'use client';

import { reviewPlatformsApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function PlatformsPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Nền tảng đánh giá"
      queryKey="review-platforms"
      createHref="/brand/platforms/form/"
      editHref={(id) => `/brand/platforms/form/?id=${id}`}
      createLabel="Thêm nền tảng ĐG"
      listFn={(q) => reviewPlatformsApi.list(q)}
      removeFn={(id) => reviewPlatformsApi.remove(id)}
      titleOf={(r) => String(r.name || r.code || `#${r.id}`)}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
