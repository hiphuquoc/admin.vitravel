'use client';

import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { PageHeader, Badge } from '@/components/ui/Page';

export default function CatalogTaxonsPage() {
  const q = useQuery({ queryKey: ['catalog-taxons'], queryFn: () => catalogApi.taxons({ per_page: 80 }) });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Taxon"
        description="Nhãn catalog từ filter Booking. Ẩn/sửa nhãn — không hardcode id facility."
      />
      <table className="ui-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Code</th>
            <th>Tên</th>
            <th>Area</th>
            <th>SEO page</th>
          </tr>
        </thead>
        <tbody>
          {(q.data?.items ?? []).map((t) => (
            <tr key={String(t.id)}>
              <td>{String(t.group)}</td>
              <td><code>{String(t.code)}</code></td>
              <td>{String(t.name)}</td>
              <td>{String(t.area || '—')}</td>
              <td>{t.create_page ? <Badge tone="success">có</Badge> : <Badge>không</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
