'use client';

import { countriesApi } from '@/lib/services';
import { ResourceListPage } from '@/components/admin/ResourceListPage';

export default function DestinationsPage() {
  return (
    <ResourceListPage
      eyebrow="Thông tin"
      title="Điểm đến"
      description="Khu vực / điểm đến — trang cha listing tour. Không gắn vé tàu / máy bay."
      queryKey="countries"
      createHref="/tours/destinations/form/"
      editHref={(id) => `/tours/destinations/form/?id=${id}`}
      createLabel="Thêm điểm đến"
      unitLabel="điểm đến"
      listFn={(q) => countriesApi.list(q)}
      removeFn={(id) => countriesApi.remove(id)}
      titleOf={(r) => String(r.name || r.code || `#${r.id}`)}
      slugOf={(r) => (r.seo as { slug_full?: string } | undefined)?.slug_full}
      thumbOf={(r) => {
        const b = r.banner as { url_thumb?: string; url?: string } | null | undefined;
        return b?.url_thumb || b?.url || null;
      }}
      activeToggle={{
        of: (r) => !!r.is_active,
        onChange: (r, next) => countriesApi.setActive(r.id, next),
      }}
    />
  );
}
