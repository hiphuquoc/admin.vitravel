'use client';

import { galleryAlbumsApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function GalleryPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Thư viện ảnh"
      queryKey="gallery-albums"
      createHref="/brand/gallery/form/"
      editHref={(id) => `/brand/gallery/form/?id=${id}`}
      createLabel="Thêm album"
      listFn={(q) => galleryAlbumsApi.list(q)}
      removeFn={(id) => galleryAlbumsApi.remove(id)}
      titleOf={(r) => String(r.title || r.customer_name || `#${r.id}`)}
      thumbOf={(r) => {
        const c = r.cover as { url_thumb?: string; url?: string } | null | undefined;
        return c?.url_thumb || c?.url || null;
      }}
      statusOptions={[
        { value: 'draft', label: 'Nháp' },
        { value: 'published', label: 'Xuất bản' },
      ]}
      badgeOf={(r) => <Badge>{String(r.status || '')}</Badge>}
    />
  );
}
