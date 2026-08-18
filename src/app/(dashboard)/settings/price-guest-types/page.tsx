'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { priceGuestTypesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Field';
import { EmptyState, PageHeader } from '@/components/ui/Page';
import { HeadActions, HeadCta } from '@/components/ui/HeadActions';
import {
  EntityActions,
  EntityList,
  EntityMain,
  EntityRow,
} from '@/components/ui/EntityList';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { metaApi } from '@/lib/services';

export default function PriceGuestTypesPage() {
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [name, setName] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const languagesQuery = useQuery({
    queryKey: ['meta-languages'],
    queryFn: () => metaApi.languages(),
  });

  const query = useQuery({
    queryKey: ['price-guest-types', locale],
    queryFn: () => priceGuestTypesApi.list(locale),
  });

  const items = query.data?.items ?? [];
  const editing = useMemo(
    () => items.find((row) => row.id === editingId) || null,
    [items, editingId],
  );

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        age_min: ageMin !== '' ? Number(ageMin) : null,
        age_max: ageMax !== '' ? Number(ageMax) : null,
        locale,
        is_active: editing ? editing.is_active : true,
      };
      return editingId
        ? priceGuestTypesApi.update(editingId, body)
        : priceGuestTypesApi.create(body);
    },
    onSuccess: async () => {
      toast.success(editingId ? 'Đã cập nhật' : 'Đã thêm đối tượng khách');
      setName('');
      setAgeMin('');
      setAgeMax('');
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['price-guest-types'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: (row: (typeof items)[number]) =>
      priceGuestTypesApi.update(row.id, {
        name: row.name,
        age_min: row.age_min,
        age_max: row.age_max,
        is_active: !row.is_active,
        locale,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['price-guest-types'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => priceGuestTypesApi.remove(id),
    onSuccess: async () => {
      toast.success('Đã xóa');
      await qc.invalidateQueries({ queryKey: ['price-guest-types'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nhập tên đối tượng khách');
      return;
    }
    save.mutate();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        title="Đối tượng khách (bảng giá)"
        description="Người lớn / trẻ em / cao tuổi hoặc loại tự tạo. Dùng làm cột trong bảng giá mọi chương trình."
        actions={
          <HeadActions
            primary={
              <HeadCta
                icon={Plus}
                title="Thêm mới"
                subtitle="Đối tượng khách"
                onClick={() => {
                  setEditingId(null);
                  setName('');
                  setAgeMin('');
                  setAgeMax('');
                }}
              />
            }
          />
        }
      />
      <LocaleSwitcher
        languages={languagesQuery.data?.items ?? []}
        value={locale}
        onChange={(c) => setLocale(c)}
      />

      <form onSubmit={onSubmit} className="ui-form-cluster" style={{ marginBottom: '1.5rem' }}>
        <div className="ui-form-cluster__title">{editingId ? 'Sửa đối tượng' : 'Thêm đối tượng'}</div>
        <div className="ui-form-grid ui-form-grid--2">
          <Input label="Tên" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Tuổi từ"
            type="number"
            min={0}
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
          />
          <Input
            label="Tuổi đến"
            type="number"
            min={0}
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            hint="Để trống = không giới hạn"
          />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <Button type="submit" loading={save.isPending}>
            {editingId ? 'Lưu' : 'Thêm'}
          </Button>
        </div>
      </form>

      <EntityList
        loading={query.isLoading}
        empty={
          items.length === 0 ? (
            <EmptyState
              title="Chưa có đối tượng khách"
              description="Thêm Người lớn / Trẻ em… hoặc chạy PriceGuestTypeSeeder."
            />
          ) : undefined
        }
      >
        {items.map((row) => (
          <EntityRow key={row.id}>
            <EntityMain
              title={row.name}
              facts={
                <>
                  <span>{row.code}</span>
                  {row.age_min != null || row.age_max != null ? (
                    <span>
                      {' '}
                      · {row.age_min ?? 0}–{row.age_max ?? '+'} tuổi
                    </span>
                  ) : null}
                  {!row.is_active ? <span> · ẩn</span> : null}
                </>
              }
            />
            <EntityActions
              onDelete={() => {
                if (confirm('Xóa đối tượng khách này?')) remove.mutate(row.id);
              }}
            >
              <button
                type="button"
                className="entity-actions__btn entity-actions__btn--edit"
                onClick={() => {
                  setEditingId(row.id);
                  setName(row.name);
                  setAgeMin(row.age_min != null ? String(row.age_min) : '');
                  setAgeMax(row.age_max != null ? String(row.age_max) : '');
                }}
              >
                Sửa
              </button>
              <button
                type="button"
                className="entity-actions__btn"
                onClick={() => toggle.mutate(row)}
              >
                {row.is_active ? 'Ẩn' : 'Hiện'}
              </button>
            </EntityActions>
          </EntityRow>
        ))}
      </EntityList>
    </div>
  );
}
