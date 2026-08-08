'use client';

import { teamMembersApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function TeamPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Đội ngũ"
      queryKey="team-members"
      createHref="/brand/team/form/"
      editHref={(id) => `/brand/team/form/?id=${id}`}
      createLabel="Thêm thành viên"
      listFn={(q) => teamMembersApi.list(q)}
      removeFn={(id) => teamMembersApi.remove(id)}
      titleOf={(r) => String(r.name || `#${r.id}`)}
      slugOf={(r) => (r.seo as { slug_full?: string } | undefined)?.slug_full}
      thumbOf={(r) => {
        const a = r.avatar as { url_thumb?: string; url?: string } | null | undefined;
        return a?.url_thumb || a?.url || null;
      }}
      badgeOf={(r) => (
        <Badge tone={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Đang bật' : 'Tắt'}
        </Badge>
      )}
    />
  );
}
