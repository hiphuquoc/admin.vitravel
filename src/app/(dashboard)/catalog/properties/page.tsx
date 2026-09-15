'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Input } from '@/components/ui/Field';
import { PageHeader, Badge } from '@/components/ui/Page';

export default function CatalogPropertiesPage() {
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['catalog-properties', search],
    queryFn: () => catalogApi.properties({ search: search || undefined, per_page: 30 }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Kho chỗ nghỉ"
        description="Canonical stay_properties. Trước khi materialize, chạy Tái xây → properties."
      />
      <Input label="Tìm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="key / URL / tên" />
      <table className="ui-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Tên</th>
            <th>Type</th>
            <th>Area</th>
            <th>Completeness</th>
          </tr>
        </thead>
        <tbody>
          {(q.data?.items ?? []).map((p) => (
            <tr key={String(p.id)}>
              <td><code>{String(p.source_hotel_key)}</code></td>
              <td>{String(p.title || '—')}</td>
              <td>{String(p.property_type || '—')}</td>
              <td>{String(p.area || '—')}</td>
              <td>
                <Badge>{String((p.completeness as { score?: number } | undefined)?.score ?? '—')}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
