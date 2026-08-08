'use client';

import { useQuery } from '@tanstack/react-query';
import { languagesApi } from '@/lib/services';
import { EmptyState, PageHeader } from '@/components/ui/Page';
import { EntityList, EntityMain, EntityRow } from '@/components/ui/EntityList';

export default function LanguagesPage() {
  const query = useQuery({
    queryKey: ['languages'],
    queryFn: () => languagesApi.list(),
  });

  const items = (query.data?.items ?? []) as Record<string, unknown>[];

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        title="Ngôn ngữ"
        description="Danh sách từ bảng languages (seed/config). Read-only."
      />
      <EntityList
        loading={query.isLoading}
        empty={
          items.length === 0 ? (
            <EmptyState
              title="Chưa có ngôn ngữ"
              description="Chạy LanguageSeeder hoặc migrate."
            />
          ) : undefined
        }
      >
        {items.map((lang) => (
          <EntityRow key={String(lang.id)}>
            <EntityMain
              title={`${String(lang.code || '').toUpperCase()} — ${String(lang.name || '')}`}
              facts={
                <>
                  <span>{String(lang.name_native || '')}</span>
                  <span> · sort {String(lang.sort ?? 0)}</span>
                  {lang.is_default ? <span> · default</span> : null}
                  {!lang.is_active ? <span> · inactive</span> : null}
                </>
              }
            />
          </EntityRow>
        ))}
      </EntityList>
    </div>
  );
}
