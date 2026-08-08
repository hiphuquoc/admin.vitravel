'use client';

import { articlesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function ArticlesPage() {
  return (
    <ResourceListPage
      eyebrow="Nội dung"
      title="Chi tiết Blog"
      queryKey="articles"
      createHref="/content/articles/form/"
      editHref={(id) => `/content/articles/form/?id=${id}`}
      createLabel="Thêm chi tiết"
      listFn={(q) => articlesApi.list(q)}
      removeFn={(id) => articlesApi.remove(id)}
      titleOf={(r) => String(r.title || `#${r.id}`)}
      slugOf={(r) => (r.seo as { slug_full?: string } | undefined)?.slug_full}
      thumbOf={(r) => {
        const c = r.cover as { url_thumb?: string; url?: string } | null | undefined;
        return c?.url_thumb || c?.url || null;
      }}
      statusOptions={[
        { value: 'draft', label: 'Nháp' },
        { value: 'published', label: 'Xuất bản' },
        { value: 'archived', label: 'Lưu trữ' },
      ]}
      badgeOf={(r) => <Badge>{String(r.status || '')}</Badge>}
    />
  );
}
