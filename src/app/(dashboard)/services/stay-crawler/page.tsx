'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  FolderKanban,
  Layers,
  ListFilter,
  Maximize2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Search,
  SlidersHorizontal,
  Terminal,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import toast from '@/lib/toast';
import { serviceCategoriesApi, stayCrawlsApi, type StayCrawlJob } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, EmptyState, PageHeader } from '@/components/ui/Page';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityPagination,
} from '@/components/ui/EntityList';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';
import { CrawlerTerminalLog } from '@/components/services/CrawlerTerminalLog';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'done' || status === 'imported' || status === 'ai_done') return 'success';
  if (status === 'failed' || status === 'blocked') return 'danger';
  if (status === 'crawling' || status === 'running' || status === 'processing') return 'primary';
  if (status === 'pending' || status === 'queued') return 'warning';
  return 'neutral';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Đang chờ xử lý',
    crawling: 'Đang quét dữ liệu',
    running: 'Đang chạy đa luồng',
    processing: 'Đang bóc tách dữ liệu',
    ready: 'Sẵn sàng',
    done: 'Hoàn tất',
    failed: 'Có lỗi',
    blocked: 'Bị chặn bot',
  };
  return map[status] || status;
}

function hotelLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const m = parsed.pathname.match(/\/hotel\/[a-z]{2}\/([^/]+)\.html/i);
    if (m?.[1]) {
      return m[1].replace(/-/g, ' ');
    }
    const ss = parsed.searchParams.get('ss');
    if (ss) {
      return `Tìm kiếm: ${ss}`;
    }
    return 'Chỗ nghỉ Booking.com';
  } catch {
    return url.length > 60 ? url.substring(0, 60) + '…' : url;
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StayCrawlerListPageInner() {
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canCreate = can('services.create');
  const canDelete = can('services.delete') || can('services.create');

  const paramCategoryId = searchParams.get('category_id');
  const [selectedCategory, setSelectedCategory] = useState<string>(paramCategoryId || '');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(12);

  // Modal Xóa Job
  const [jobToDelete, setJobToDelete] = useState<StayCrawlJob | null>(null);

  // Modal Xem Live Log của Job
  const [liveLogJob, setLiveLogJob] = useState<StayCrawlJob | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['stay-categories-list'],
    queryFn: () => serviceCategoriesApi.list({ cluster: 'stay', per_page: 100 }),
  });

  const categories = categoriesQuery.data?.items ?? [];

  // Query danh sách Job
  const jobsQuery = useQuery({
    queryKey: [
      'stay-crawls-jobs',
      {
        service_category_id: selectedCategory ? Number(selectedCategory) : undefined,
        search: searchKeyword || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        per_page: perPage,
      },
    ],
    queryFn: () =>
      stayCrawlsApi.jobs({
        service_category_id: selectedCategory ? Number(selectedCategory) : undefined,
        search: searchKeyword || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        per_page: perPage,
      }),
    refetchInterval: 4500,
  });

  const jobsList: StayCrawlJob[] = jobsQuery.data?.items ?? [];
  const meta = jobsQuery.data?.meta;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['stay-crawls-jobs'] });
  };

  // Mutation Xóa Job
  const deleteJobMutation = useMutation({
    mutationFn: (id: number) => stayCrawlsApi.deleteJob(id),
    onSuccess: () => {
      toast.success('Đã xóa Job crawler thành công');
      setJobToDelete(null);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Thử lại tất cả item lỗi trong Job
  const retryFailedMutation = useMutation({
    mutationFn: (id: number) => stayCrawlsApi.retryFailed(id),
    onSuccess: (data) => {
      toast.success(data.message || `Đã kích hoạt lại ${data.retried_count} URL lỗi`);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Tổng hợp số liệu thống kê nhanh
  const statsOverview = useMemo(() => {
    let runningCount = 0;
    let totalHotels = 0;
    let doneHotels = 0;
    let failedHotels = 0;

    for (const j of jobsList) {
      if (j.status === 'crawling' || j.status === 'running' || j.worker_alive) {
        runningCount++;
      }
      if (j.stats) {
        totalHotels += j.stats.total || 0;
        doneHotels += j.stats.done || 0;
        failedHotels += j.stats.failed || 0;
      } else {
        totalHotels += j.items_count || j.items_found || 0;
      }
    }

    return {
      totalJobs: meta?.total ?? jobsList.length,
      runningCount,
      totalHotels,
      doneHotels,
      failedHotels,
    };
  }, [jobsList, meta]);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '100%', overflowX: 'hidden', paddingBottom: '3rem' }}>
      <PageHeader
        eyebrow="Lưu trú (Stay)"
        title="Quản lý Job Crawler Booking.com"
        description="Theo dõi tiến trình cào dữ liệu, xem danh sách khách sạn và quản lý các phiên cào tự động."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && (
              <Link href={selectedCategory ? `/services/stay-crawler/create/?category_id=${selectedCategory}` : '/services/stay-crawler/create/'}>
                <Button variant="primary" size="sm">
                  <Plus size={15} /> Khởi tạo Crawler mới
                </Button>
              </Link>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={jobsQuery.isFetching}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} /> Làm mới
            </Button>
          </div>
        }
      />

      {/* Hero KPI Grid */}
      <div className="ui-crawler-kpi-grid">
        <div className="ui-crawler-kpi-card">
          <div className="ui-crawler-kpi-card__head">
            <span className="ui-crawler-kpi-card__label">Tổng số phiên cào</span>
            <div className="ui-crawler-kpi-card__icon">
              <Layers size={18} />
            </div>
          </div>
          <div className="ui-crawler-kpi-card__val">{statsOverview.totalJobs}</div>
          <div className="ui-crawler-kpi-card__sub">
            <span>Toàn bộ các phiên trong hệ thống</span>
          </div>
        </div>

        <div className="ui-crawler-kpi-card">
          <div className="ui-crawler-kpi-card__head">
            <span className="ui-crawler-kpi-card__label">Đang xử lý ngầm</span>
            <div className="ui-crawler-kpi-card__icon ui-crawler-kpi-card__icon--primary">
              <Activity size={18} className={statsOverview.runningCount > 0 ? 'animate-spin' : ''} />
            </div>
          </div>
          <div className="ui-crawler-kpi-card__val" style={{ color: 'var(--admin-primary-600)' }}>
            {statsOverview.runningCount}
          </div>
          <div className="ui-crawler-kpi-card__sub">
            {statsOverview.runningCount > 0 ? (
              <span style={{ color: 'var(--admin-primary-600)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                <span className="ui-crawler-modal__pulse-dot" /> Worker Supervisor đang chạy
              </span>
            ) : (
              <span>Không có worker hoạt động</span>
            )}
          </div>
        </div>

        <div className="ui-crawler-kpi-card">
          <div className="ui-crawler-kpi-card__head">
            <span className="ui-crawler-kpi-card__label">Khách sạn đã hoàn tất</span>
            <div className="ui-crawler-kpi-card__icon ui-crawler-kpi-card__icon--success">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="ui-crawler-kpi-card__val" style={{ color: 'var(--admin-success)' }}>
            {statsOverview.doneHotels}
          </div>
          <div className="ui-crawler-kpi-card__sub">
            <span>Đã tạo thành trang sản phẩm</span>
          </div>
        </div>

        <div className="ui-crawler-kpi-card">
          <div className="ui-crawler-kpi-card__head">
            <span className="ui-crawler-kpi-card__label">Cào lỗi / Bị chặn</span>
            <div className="ui-crawler-kpi-card__icon ui-crawler-kpi-card__icon--danger">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="ui-crawler-kpi-card__val" style={{ color: 'var(--admin-danger)' }}>
            {statsOverview.failedHotels}
          </div>
          <div className="ui-crawler-kpi-card__sub">
            <span>Có thể bấm thử lại nhanh</span>
          </div>
        </div>
      </div>

      {/* Pro Toolbar: Search, Category Filter & Segmented Tabs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--admin-radius-lg)',
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-line)',
          boxShadow: '0 2px 8px -2px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          {/* Segmented Tabs */}
          <div className="ui-crawler-tabs">
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'all' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => { setPage(1); setStatusFilter('all'); }}
            >
              <span>Tất cả</span>
              <span className="ui-crawler-tabs__count">{statsOverview.totalJobs}</span>
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'crawling' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => { setPage(1); setStatusFilter('crawling'); }}
            >
              <span>Đang quét / Chạy</span>
              {statsOverview.runningCount > 0 && (
                <span className="ui-crawler-tabs__count" style={{ color: 'var(--admin-primary-600)' }}>
                  {statsOverview.runningCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'done' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => { setPage(1); setStatusFilter('done'); }}
            >
              <span>Hoàn tất</span>
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'failed' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => { setPage(1); setStatusFilter('failed'); }}
            >
              <span>Có lỗi</span>
              {statsOverview.failedHotels > 0 && (
                <span className="ui-crawler-tabs__count" style={{ color: 'var(--admin-danger)' }}>
                  {statsOverview.failedHotels}
                </span>
              )}
            </button>
          </div>

          {/* Category Selector */}
          <div style={{ minWidth: '16rem', maxWidth: '24rem', flex: '1 1 auto' }}>
            <Select
              label="Lọc theo Danh mục lưu trú"
              placeholder="— Tất cả danh mục —"
              options={[
                { value: '', label: 'Tất cả danh mục' },
                ...categories.map((c) => ({
                  value: String(c.id),
                  label: c.name ? `${c.name} (ID: ${c.id})` : `#${c.id}`,
                })),
              ]}
              value={selectedCategory}
              onChange={(v) => {
                setPage(1);
                setSelectedCategory(v);
              }}
            />
          </div>
        </div>

        {/* Search Input */}
        <div style={{ width: '100%' }}>
          <Input
            label="Tìm kiếm Job"
            placeholder="Nhập mã Job (#ID) hoặc liên kết nguồn Booking.com hoặc tên danh mục..."
            value={searchKeyword}
            onChange={(e) => {
              setPage(1);
              setSearchKeyword(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Pagination Top */}
      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? jobsList.length}
        perPage={perPage}
        unitLabel="Job"
        loading={jobsQuery.isLoading}
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPage(1);
          setPerPage(n);
        }}
      />

      {/* Danh sách các Job dạng Cards sang trọng */}
      {jobsList.length === 0 ? (
        <EmptyState
          title="Chưa có phiên cào nào"
          description="Hãy tạo một phiên crawler Booking.com mới để hệ thống tự động bóc tách và đồng bộ khách sạn."
          action={
            canCreate ? (
              <Link href="/services/stay-crawler/create/">
                <Button variant="primary">
                  <Plus size={16} /> Khởi tạo Crawler mới
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {jobsList.map((job) => {
            const isDeleting = deleteJobMutation.isPending && deleteJobMutation.variables === job.id;
            const isRetrying = retryFailedMutation.isPending && retryFailedMutation.variables === job.id;

            const total = job.stats?.total ?? job.items_count ?? job.items_found ?? 0;
            const done = job.stats?.done ?? 0;
            const failed = job.stats?.failed ?? 0;
            const queued = job.stats?.queued ?? 0;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;

            const isJobRunning =
              job.status === 'crawling' ||
              job.status === 'running' ||
              job.status === 'processing' ||
              Boolean(job.worker_alive);

            const categoryName = job.category?.name;

            return (
              <div key={job.id} className="ui-crawler-job-card">
                {/* Header Row */}
                <div className="ui-crawler-job-card__header">
                  <div className="ui-crawler-job-card__title-area">
                    <span className="ui-crawler-job-card__id-badge">#{job.id}</span>
                    <Link
                      href={`/services/stay-crawler/detail/?id=${job.id}`}
                      className="ui-crawler-job-card__name"
                    >
                      {hotelLabel(job.list_url || '')}
                    </Link>

                    {categoryName && (
                      <span className="ui-crawler-job-card__category-chip">
                        <FolderKanban size={12} /> {categoryName}
                      </span>
                    )}

                    <Badge tone={statusTone(job.status)}>
                      {statusLabel(job.status)}
                    </Badge>

                    {isJobRunning && (
                      <Badge tone="primary">
                        <span className="ui-crawler-modal__pulse-dot" style={{ marginRight: 4 }} />
                        Đang cào (Live)
                      </Badge>
                    )}
                  </div>

                  <a
                    href={job.list_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-crawler-job-card__url-link"
                    title="Mở liên kết Booking.com"
                  >
                    <span>{job.list_url}</span>
                    <ExternalLink size={13} style={{ flexShrink: 0 }} />
                  </a>
                </div>

                {/* Progress & Stats Bar */}
                <div className="ui-crawler-job-card__progress-wrap">
                  <div className="ui-crawler-job-card__progress-bar">
                    <div
                      className="ui-crawler-job-card__bar-done"
                      style={{ width: `${percent}%` }}
                    />
                    {failed > 0 && total > 0 && (
                      <div
                        className="ui-crawler-job-card__bar-failed"
                        style={{ width: `${(failed / total) * 100}%` }}
                      />
                    )}
                    {queued > 0 && total > 0 && (
                      <div
                        className="ui-crawler-job-card__bar-queued"
                        style={{ width: `${(queued / total) * 100}%` }}
                      />
                    )}
                  </div>

                  <div className="ui-crawler-job-card__stats-line">
                    <div className="ui-crawler-job-card__stats-pills">
                      <span className="ui-crawler-job-card__pill ui-crawler-job-card__pill--done">
                        ✓ <strong>{done}</strong> đã hoàn tất
                      </span>
                      {queued > 0 && (
                        <span className="ui-crawler-job-card__pill ui-crawler-job-card__pill--queued">
                          ⏱ <strong>{queued}</strong> đang chờ
                        </span>
                      )}
                      {failed > 0 && (
                        <span className="ui-crawler-job-card__pill ui-crawler-job-card__pill--failed">
                          ✗ <strong>{failed}</strong> lỗi
                        </span>
                      )}
                      <span className="ui-crawler-job-card__pill">
                        Tổng <strong>{total}</strong> khách sạn
                      </span>
                    </div>

                    <span style={{ fontWeight: 750, color: 'var(--admin-ink)' }}>
                      Tiến độ: {percent}%
                    </span>
                  </div>
                </div>

                {/* Footer with Actions */}
                <div className="ui-crawler-job-card__footer">
                  <span className="ui-crawler-job-card__time">
                    Tạo lúc: {formatDate(job.created_at)}
                  </span>

                  <div className="ui-crawler-job-card__actions">
                    <Link href={`/services/stay-crawler/detail/?id=${job.id}`}>
                      <Button size="sm" variant="secondary">
                        <Building2 size={13} /> Quản lý khách sạn ({total})
                      </Button>
                    </Link>

                    {failed > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={isRetrying}
                        loading={isRetrying}
                        title="Thử lại các khách sạn bị lỗi"
                        onClick={() => retryFailedMutation.mutate(job.id)}
                      >
                        <RotateCcw size={13} /> Thử lại {failed} lỗi
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Xem Live Console & Log"
                      onClick={() => setLiveLogJob(job)}
                    >
                      <Terminal size={14} /> Console Log
                    </Button>

                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        style={{ color: 'var(--admin-danger-500, #ef4444)' }}
                        disabled={isDeleting}
                        loading={isDeleting}
                        title="Xóa phiên cào này"
                        onClick={() => setJobToDelete(job)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xác nhận Xóa Job */}
      {jobToDelete && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div className="ui-modal__veil" onClick={() => setJobToDelete(null)} />
          <div className="ui-modal__card" style={{ maxWidth: '28rem' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title" style={{ color: 'var(--admin-danger-500, #ef4444)' }}>
                Xác nhận xóa Job #{jobToDelete.id}?
              </h2>
            </header>
            <div className="ui-modal__body">
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.55 }}>
                Bạn có chắc chắn muốn xóa <strong>Job #{jobToDelete.id}</strong> (
                <em>{hotelLabel(jobToDelete.list_url || '')}</em>)?
              </p>
              <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.84rem', color: 'var(--admin-muted, #64748b)' }}>
                Toàn bộ dữ liệu phiên cào và các khách sạn thuộc job này sẽ bị xóa khỏi lịch sử crawler.
              </p>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" onClick={() => setJobToDelete(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleteJobMutation.isPending}
                onClick={() => deleteJobMutation.mutate(jobToDelete.id)}
              >
                Xác nhận xóa
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Xem Console Log của 1 Job bất kỳ */}
      {liveLogJob && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div className="ui-modal__veil" onClick={() => setLiveLogJob(null)} />
          <div className="ui-crawler-modal" role="document">
            <header className="ui-crawler-modal__head">
              <div className="ui-crawler-modal__brand">
                <div className="ui-crawler-modal__icon-box">
                  <Terminal size={18} />
                </div>
                <div className="ui-crawler-modal__titles">
                  <p className="ui-crawler-modal__eyebrow">Booking.com Crawler Engine</p>
                  <h2 className="ui-crawler-modal__title">
                    Console Log — Job #{liveLogJob.id}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                style={{ padding: '0.4rem', borderRadius: '0.4rem' }}
                title="Đóng cửa sổ theo dõi"
                onClick={() => setLiveLogJob(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="ui-crawler-modal__body">
              <p className="ui-crawler-modal__hint">
                Nhật ký hoạt động và thông báo từ worker xử lý cho Job #{liveLogJob.id}.
              </p>
              <CrawlerTerminalLog
                logs={
                  ((liveLogJob as any)?.meta?.worker?.log || (liveLogJob as any)?.meta?.worker?.last_message)
                    ? [String((liveLogJob as any)?.meta?.worker?.last_message || (liveLogJob as any)?.meta?.worker?.log)]
                    : [`[${formatDate(liveLogJob.created_at)}] Khởi tạo Job #${liveLogJob.id}: ${liveLogJob.list_url}`, `Trạng thái: ${liveLogJob.status}`]
                }
                running={Boolean(liveLogJob.worker_alive)}
                maxHeight="min(52vh, 24rem)"
              />
            </div>
            <footer className="ui-crawler-modal__foot">
              <Link href={`/services/stay-crawler/detail/?id=${liveLogJob.id}&live=true`}>
                <Button type="button" variant="primary" size="sm">
                  <Maximize2 size={13} /> Mở trang chi tiết Job
                </Button>
              </Link>
              <Button type="button" variant="secondary" size="sm" onClick={() => setLiveLogJob(null)}>
                Đóng
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StayCrawlerListPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải danh sách Job Crawler...</div>}>
      <StayCrawlerListPageInner />
    </Suspense>
  );
}
