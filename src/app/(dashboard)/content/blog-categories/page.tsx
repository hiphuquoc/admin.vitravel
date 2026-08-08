'use client';

import { blogCategoriesApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function BlogCategoriesPage() {
  return (
    <ResourceListPage
      eyebrow="Nội dung"
      title="Danh mục Blog"
      queryKey="blog-categories"
      createHref="/content/blog-categories/form/"
      editHref={(id) => `/content/blog-categories/form/?id=${id}`}
      createLabel="Thêm danh mục"
      listFn={(q) => blogCategoriesApi.list(q)}
      removeFn={(id) => blogCategoriesApi.remove(id)}
      titleOf={(r) => String(r.name || `#${r.id}`)}
      slugOf={(r) => (r.seo as { slug_full?: string } | undefined)?.slug_full}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
