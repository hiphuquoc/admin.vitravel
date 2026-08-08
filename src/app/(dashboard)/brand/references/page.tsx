'use client';

import { referencePersonsApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function ReferencesPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Đại diện nước ngoài"
      queryKey="reference-persons"
      createHref="/brand/references/form/"
      editHref={(id) => `/brand/references/form/?id=${id}`}
      createLabel="Thêm đại diện NN"
      listFn={(q) => referencePersonsApi.list(q)}
      removeFn={(id) => referencePersonsApi.remove(id)}
      titleOf={(r) => String(r.name || `#${r.id}`)}
      thumbOf={(r) => {
        const p = r.photo as { url_thumb?: string; url?: string } | null | undefined;
        return p?.url_thumb || p?.url || null;
      }}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
