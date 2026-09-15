'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAppRouter } from '@/hooks/useAppRouter';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import toast from '@/lib/toast';

export default function CatalogDiscoverPage() {
  const router = useAppRouter();
  const [url, setUrl] = useState('');
  const [areaId, setAreaId] = useState('');
  const areas = useQuery({ queryKey: ['catalog-areas'], queryFn: () => catalogApi.areas() });
  const start = useMutation({
    mutationFn: () =>
      catalogApi.discover({
        url,
        stay_area_id: areaId ? Number(areaId) : undefined,
      }),
    onSuccess: (data) => {
      const id = Number((data.job as { id?: number })?.id);
      toast.success('Đã tạo job discover — chưa tạo trang, chưa list-crawl.');
      if (id) router.push(`/catalog/discover/review/?id=${id}`);
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Cào filter khu vực"
        description="Dán 1 URL searchresults/city/region. Chrome bung «Hiển thị thêm» rồi dừng ở màn review. Không spawn list."
      />
      <div className="ui-card" style={{ padding: 20, maxWidth: 720 }}>
        <Input
          label="URL vùng Booking"
          placeholder="https://www.booking.com/searchresults.vi.html?ss=Cát+Bà&dest_id=-3712045&dest_type=city"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Select
          label="Khu vực catalog (tuỳ chọn)"
          value={areaId}
          onChange={setAreaId}
          options={[
            { value: '', label: 'Tự nhận từ dest_id / ss' },
            ...(areas.data?.items ?? []).map((a) => ({
              value: String(a.id),
              label: `${a.name} (${a.slug})`,
            })),
          ]}
        />
        <Button onClick={() => start.mutate()} disabled={!url.trim()} loading={start.isPending}>
          Bắt đầu discover
        </Button>
      </div>
    </div>
  );
}
