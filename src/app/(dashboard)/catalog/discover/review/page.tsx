'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { PageHeader, Badge } from '@/components/ui/Page';
import toast from '@/lib/toast';

type FilterRow = {
  group: string;
  nflt: string;
  label: string;
  count: number;
  policy: string;
  create_page_default?: boolean;
  crawl_default?: boolean;
  create_page?: boolean;
  crawl?: boolean;
  expanded?: boolean;
  filter_url?: string;
};

function ReviewInner() {
  const search = useSearchParams();
  const id = Number(search.get('id') || 0);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['catalog-discover', id],
    queryFn: () => catalogApi.showDiscover(id),
    enabled: id > 0,
    refetchInterval: (query) => {
      const status = (query.state.data?.job as { status?: string } | undefined)?.status;
      return status === 'crawling' || status === 'pending' ? 2500 : false;
    },
  });
  const job = q.data?.job as Record<string, unknown> | undefined;
  const discover = (job?.discover ?? {}) as Record<string, unknown>;
  const rawFilters = (discover.filters as FilterRow[] | undefined) ?? [];
  const [rows, setRows] = useState<FilterRow[] | null>(null);
  const filters = rows ?? rawFilters.map((f) => ({
    ...f,
    create_page: f.create_page ?? f.create_page_default,
    crawl: f.crawl ?? f.crawl_default,
  }));

  const expand = (discover.expand as { group: string; clicks: number; items_before: number; items_after: number }[] | undefined) ?? [];
  const weakExpand = expand.filter((e) => e.clicks === 0 && ['ht_id', 'di', 'hotelfacility'].includes(e.group));

  const rerun = useMutation({
    mutationFn: () => catalogApi.rerunDiscover(id),
    onSuccess: () => {
      toast.success('Đã cào lại filter');
      setRows(null);
      qc.invalidateQueries({ queryKey: ['catalog-discover', id] });
    },
  });
  const save = useMutation({
    mutationFn: () => catalogApi.saveDiscoverReview(id, { filters }),
    onSuccess: () => toast.success('Đã lưu tick review'),
  });
  const confirm = useMutation({
    mutationFn: () => catalogApi.confirmDiscover(id, filters),
    onSuccess: (data) => {
      toast.success(`Đã tạo ${data.pages} trang; spawn ${data.spawned_now ?? data.lists} list, còn ${data.queued ?? 0} chờ slot Chrome`);
      qc.invalidateQueries({ queryKey: ['catalog-discover', id] });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, FilterRow[]>();
    for (const f of filters) {
      const list = map.get(f.group) || [];
      list.push(f);
      map.set(f.group, list);
    }
    return map;
  }, [filters]);

  function patch(nflt: string, field: 'create_page' | 'crawl', value: boolean) {
    setRows(filters.map((f) => (f.nflt === nflt ? { ...f, [field]: value } : f)));
  }

  if (!id) return <p>Thiếu id job discover.</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title={`Review filter #${id}`}
        description="Xác nhận mới tạo trang SEO + spawn list-crawl. Discover không được gộp spawn."
        actions={
          <>
            <Button variant="secondary" onClick={() => rerun.mutate()} loading={rerun.isPending}>Cào lại filter</Button>
            <Button variant="secondary" onClick={() => save.mutate()} loading={save.isPending}>Lưu tick</Button>
            <Button
              onClick={() => confirm.mutate()}
              loading={confirm.isPending}
              disabled={job?.status !== 'review' || Boolean((discover as { spawned?: boolean }).spawned)}
            >
              Xác nhận tạo trang + cào
            </Button>
          </>
        }
      />
      <p>
        Trạng thái: <Badge>{String(job?.status || '…')}</Badge>{' '}
        Dest: {String((discover.dest as { ss?: string } | undefined)?.ss || '—')} /{' '}
        {(discover.dest as { dest_id?: string } | undefined)?.dest_id}
      </p>
      {job?.child_progress ? (
        <p className="ui-muted">
          List con: {(job.child_progress as { done?: number }).done ?? 0}/{(job.child_progress as { total?: number }).total ?? 0} xong
          {' · '}cào {(job.child_progress as { crawling?: number }).crawling ?? 0}
          {' · '}chờ {(job.child_progress as { pending?: number }).pending ?? 0}
        </p>
      ) : null}
      {weakExpand.length > 0 && (
        <p className="ui-muted">Cảnh báo chưa bung: {weakExpand.map((e) => e.group).join(', ')} (clicks=0).</p>
      )}
      {Array.from(grouped.entries()).map(([group, items]) => (
        <section key={group} style={{ marginTop: 20 }}>
          <h3>
            {group} <Badge>{items[0]?.policy}</Badge> ({items.length})
          </h3>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nhãn</th>
                <th>nflt</th>
                <th>Count</th>
                <th>Trang SEO</th>
                <th>List-crawl</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.nflt}>
                  <td>{item.label}</td>
                  <td><code>{item.nflt}</code></td>
                  <td>{item.count}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(item.create_page)}
                      onChange={(e) => patch(item.nflt, 'create_page', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(item.crawl)}
                      onChange={(e) => patch(item.nflt, 'crawl', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export default function CatalogDiscoverReviewPage() {
  return (
    <Suspense>
      <ReviewInner />
    </Suspense>
  );
}
