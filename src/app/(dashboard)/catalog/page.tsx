'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/services';
import { Badge, PageHeader } from '@/components/ui/Page';
import { HeadActions, HeadCta } from '@/components/ui/HeadActions';
import { ScanSearch, RefreshCw } from 'lucide-react';

export default function CatalogDashboardPage() {
  const q = useQuery({ queryKey: ['catalog-dashboard'], queryFn: () => catalogApi.dashboard() });
  const stats = q.data?.stats ?? {};
  const orch = q.data?.orchestrator ?? {};

  return (
    <div>
      <PageHeader
        eyebrow="Catalog chỗ nghỉ"
        title="Tổng quan"
        description="Nguồn chỗ nghỉ dùng chung — chỉ siêu quản trị. Discover filter không tự tạo trang."
        actions={
          <HeadActions
            primary={
              <HeadCta href="/catalog/discover/" icon={ScanSearch} title="Cào filter" subtitle="URL vùng" />
            }
            secondary={
              <HeadCta href="/catalog/rebuild/" icon={RefreshCw} title="Tái xây" subtitle="R1–R4" />
            }
          />
        }
      />
      <div className="ui-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {[
          ['Chỗ nghỉ', stats.stays],
          ['Có identity', stats.with_identity],
          ['Có toạ độ', stats.with_geo],
          ['Có area', stats.with_area],
          ['Chưa gán area', stats.unmatched_area],
          ['Completeness TB', stats.avg_completeness],
          ['Property catalog', stats.properties],
          ['Chờ review', q.data?.review_count ?? orch.discover_review],
          ['List đang cào', orch.list_crawling],
          ['List chờ spawn', orch.list_pending_spawn],
          ['Skip trùng (gần đây)', orch.recent_skipped_existing],
          ['Gắn taxon (gần đây)', orch.recent_taxon_attached],
        ].map(([label, value]) => (
          <div key={String(label)} className="ui-card" style={{ padding: 16 }}>
            <div className="ui-muted">{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{value ?? '—'}</div>
          </div>
        ))}
      </div>
      <p className="ui-muted" style={{ marginTop: 16 }}>
        Overlay listing: {stats.catalog_enabled ? <Badge tone="success">bật</Badge> : <Badge>tắt</Badge>}{' '}
        — <code>STAY_CATALOG_ENABLED</code>
      </p>
      <h2 style={{ marginTop: 24 }}>Job gần đây</h2>
      <ul>
        {(q.data?.recent_jobs as { id: number; job_type: string; status: string }[] | undefined)?.map((j) => (
          <li key={j.id}>
            <Link href={j.job_type === 'area_discover' ? `/catalog/discover/review/?id=${j.id}` : `/catalog/jobs/detail/?id=${j.id}`}>
              #{j.id} {j.job_type} — {j.status}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
