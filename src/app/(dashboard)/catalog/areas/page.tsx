'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import toast from '@/lib/toast';

export default function CatalogAreasPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['catalog-areas'], queryFn: () => catalogApi.areas() });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const seed = useMutation({
    mutationFn: () => catalogApi.seedAreas(),
    onSuccess: () => {
      toast.success('Đã seed cây VN / Cát Bà / Hạ Long / Phú Quốc');
      qc.invalidateQueries({ queryKey: ['catalog-areas'] });
    },
  });
  const create = useMutation({
    mutationFn: () => catalogApi.storeArea({ name, slug, level: 'destination', country_code: 'VN' }),
    onSuccess: () => {
      toast.success('Đã tạo khu vực');
      setName('');
      setSlug('');
      qc.invalidateQueries({ queryKey: ['catalog-areas'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Khu vực"
        description="Cây geo global — không dính X-Project-Code. stay_places vẫn là POI lân cận."
        actions={<Button onClick={() => seed.mutate()} loading={seed.isPending}>Seed cây VN</Button>}
      />
      <div className="ui-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input label="Tên" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={!name || !slug} loading={create.isPending}>Thêm destination</Button>
      </div>
      <table className="ui-table">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Tên</th>
            <th>Level</th>
            <th>dest_id</th>
            <th>Liên quan</th>
          </tr>
        </thead>
        <tbody>
          {(q.data?.items ?? []).map((a) => (
            <tr key={String(a.id)}>
              <td><code>{String(a.slug)}</code></td>
              <td>{String(a.name)}</td>
              <td>{String(a.level)}</td>
              <td>{String(a.booking_dest_id || '—')}</td>
              <td>{Array.isArray(a.related) ? (a.related as { slug: string }[]).map((r) => r.slug).join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
