'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import toast from '@/lib/toast';

export default function CatalogRebuildPage() {
  const stats = useQuery({ queryKey: ['catalog-rebuild-stats'], queryFn: () => catalogApi.rebuildStats() });
  const [layer, setLayer] = useState('offline');
  const [limit, setLimit] = useState('0');
  const [report, setReport] = useState<unknown>(null);
  const run = useMutation({
    mutationFn: (dry: boolean) => catalogApi.rebuild({ layer, dry_run: dry, limit: Number(limit) || 0 }),
    onSuccess: (data, dry) => {
      setReport(data);
      toast.success(dry ? 'Dry-run xong' : 'Đã chạy tái xây');
      stats.refetch();
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Tái xây ~10k chỗ nghỉ"
        description="R1 offline (identity/geo/alias) → R2 area → properties → R4 improve chọn lọc. Không migrate:fresh, không cào lại 10k detail."
      />
      <pre className="ui-card" style={{ padding: 16, overflow: 'auto' }}>
        {JSON.stringify(stats.data, null, 2)}
      </pre>
      <div className="ui-toolbar" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Select
          label="Lớp"
          value={layer}
          onChange={setLayer}
          options={[
            { value: 'offline', label: 'R1 Offline identity/geo/alias' },
            { value: 'areas', label: 'R2 Gán area' },
            { value: 'properties', label: 'P6/P7 Materialize property' },
            { value: 'improve', label: 'R4 Improve completeness thấp' },
          ]}
        />
        <Input label="Limit (0 = hết)" value={limit} onChange={(e) => setLimit(e.target.value)} />
        <Button variant="secondary" onClick={() => run.mutate(true)} loading={run.isPending}>Dry-run</Button>
        <Button onClick={() => run.mutate(false)} loading={run.isPending}>Chạy</Button>
      </div>
      {report != null && (
        <pre className="ui-card" style={{ padding: 16, marginTop: 16, maxHeight: 420, overflow: 'auto' }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
