'use client';

import { homeSlidesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function SlidesPage() {
  return (
    <ResourceListPage
      eyebrow="Nội dung"
      title="Slider trang chủ"
      queryKey="home-slides"
      createHref="/content/slides/form/"
      editHref={(id) => `/content/slides/form/?id=${id}`}
      createLabel="Thêm slide"
      listFn={(q) => homeSlidesApi.list(q)}
      removeFn={(id) => homeSlidesApi.remove(id)}
      titleOf={(r) => String(r.title || `Slide #${r.id}`)}
      thumbOf={(r) => {
        const i = r.image as { url_thumb?: string; url?: string } | null | undefined;
        return i?.url_thumb || i?.url || null;
      }}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
