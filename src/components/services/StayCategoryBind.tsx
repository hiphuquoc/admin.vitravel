'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Select, Switch } from '@/components/ui/Field';
import { FormSection } from '@/components/ui/FormSection';
import toast from '@/lib/toast';

export function StayCategoryBind({ categoryId }: { categoryId: number }) {
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ['stay-areas'], queryFn: () => catalogApi.publicAreas() });
  const taxons = useQuery({ queryKey: ['stay-taxons'], queryFn: () => catalogApi.publicTaxons({ per_page: 100 }) });
  const bindings = useQuery({
    queryKey: ['catalog-cat-bindings', categoryId],
    queryFn: () => catalogApi.categoryBindings(categoryId),
    enabled: categoryId > 0,
  });
  const [areaId, setAreaId] = useState('');
  const [taxonId, setTaxonId] = useState('');
  const [includeChild, setIncludeChild] = useState(true);
  const bind = useMutation({
    mutationFn: () =>
      catalogApi.bindCategory(categoryId, {
        stay_area_id: Number(areaId),
        stay_taxon_id: taxonId ? Number(taxonId) : null,
        include_child_areas: includeChild,
        sync: true,
      }),
    onSuccess: () => {
      toast.success('Đã bind nguồn catalog — không cào lại');
      qc.invalidateQueries({ queryKey: ['catalog-cat-bindings', categoryId] });
    },
  });

  if (!categoryId) {
    return (
      <FormSection title="Nguồn catalog">
        <p className="ui-muted">Lưu danh mục trước, rồi bind khu vực catalog (Cát Bà / Hạ Long…).</p>
      </FormSection>
    );
  }

  return (
    <FormSection title="Nguồn catalog">
      <p className="ui-muted">Bind area ± taxon — chỗ nghỉ catalog hiện trên danh mục này, không dán URL Booking.</p>
      {(bindings.data?.items ?? []).map((b) => {
        const area = b.area as { name?: string; slug?: string } | undefined;
        const taxon = b.taxon as { name?: string } | undefined;
        return (
          <p key={String(b.id)}>
            {area?.name || area?.slug} {taxon?.name ? `· ${taxon.name}` : ''}
          </p>
        );
      })}
      <Select
        label="Khu vực"
        value={areaId}
        onChange={setAreaId}
        options={[
          { value: '', label: 'Chọn area' },
          ...(areas.data?.items ?? []).map((a) => ({ value: String(a.id), label: `${a.name} (${a.slug})` })),
        ]}
      />
      <Select
        label="Taxon (tuỳ chọn)"
        value={taxonId}
        onChange={setTaxonId}
        options={[
          { value: '', label: 'Mọi loại' },
          ...(taxons.data?.items ?? []).map((t) => ({ value: String(t.id), label: `${t.group}: ${t.name}` })),
        ]}
      />
      <Switch label="Gồm khu con" checked={includeChild} onChange={setIncludeChild} />
      <Button onClick={() => bind.mutate()} disabled={!areaId} loading={bind.isPending}>
        Bind + sync projection
      </Button>
    </FormSection>
  );
}
