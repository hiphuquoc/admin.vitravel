'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Page';
import toast from '@/lib/toast';

export default function CatalogBindingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['catalog-bindings'], queryFn: () => catalogApi.bindings() });
  const sync = useMutation({
    mutationFn: (id: number) => catalogApi.syncBinding(id),
    onSuccess: () => {
      toast.success('Đã sync projection');
      qc.invalidateQueries({ queryKey: ['catalog-bindings'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Bind dự án"
        description="Danh mục local ↔ area ± taxon. Sync tạo projection trên domain con, không cào lại."
      />
      <table className="ui-table">
        <thead>
          <tr>
            <th>Danh mục</th>
            <th>Area</th>
            <th>Taxon</th>
            <th>Sync</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(q.data?.items ?? []).map((b) => {
            const cat = b.category as { name?: string } | undefined;
            const area = b.area as { name?: string; slug?: string } | undefined;
            const taxon = b.taxon as { name?: string } | undefined;
            return (
              <tr key={String(b.id)}>
                <td>{cat?.name || `#${b.service_category_id}`}</td>
                <td>{area?.name || area?.slug}</td>
                <td>{taxon?.name || '—'}</td>
                <td>{String(b.sync_mode)} {b.last_synced_at ? String(b.last_synced_at) : ''}</td>
                <td>
                  <Button variant="secondary" onClick={() => sync.mutate(Number(b.id))} loading={sync.isPending}>
                    Sync
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
