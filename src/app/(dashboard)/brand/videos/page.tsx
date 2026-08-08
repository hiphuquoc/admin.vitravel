'use client';

import { videosApi } from '@/lib/services';
import { Badge } from '@/components/ui/Page';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

function providerLabel(provider: unknown): string | null {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'file') return 'File';
  if (provider === 'vimeo') return 'Vimeo';
  return null;
}

export default function VideosPage() {
  return (
    <ResourceListPage
      eyebrow="Thương hiệu"
      title="Video"
      queryKey="videos"
      createHref="/brand/videos/form/"
      editHref={(id) => `/brand/videos/form/?id=${id}`}
      createLabel="Thêm video"
      listFn={(q) => videosApi.list(q)}
      removeFn={(id) => videosApi.remove(id)}
      titleOf={(r) => String(r.title || r.youtube_id || `#${r.id}`)}
      thumbOf={(r) => {
        const t = r.thumbnail as { url_thumb?: string; url?: string } | null | undefined;
        return t?.url_thumb || t?.url || null;
      }}
      statusOptions={[
        { value: 'draft', label: 'Nháp' },
        { value: 'published', label: 'Xuất bản' },
      ]}
      badgeOf={(r) => {
        const provider = providerLabel(r.provider);
        return (
          <>
            <Badge tone={r.status === 'published' ? 'success' : 'neutral'}>
              {r.status === 'published' ? 'Xuất bản' : 'Nháp'}
            </Badge>
            {provider ? <Badge tone="neutral">{provider}</Badge> : null}
            {r.show_on_home ? <Badge tone="success">Trang chủ</Badge> : null}
          </>
        );
      }}
    />
  );
}
