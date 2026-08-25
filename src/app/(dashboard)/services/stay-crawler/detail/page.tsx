'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  FolderKanban,
  Globe2,
  Layers,
  Maximize2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import toast from '@/lib/toast';
import { stayCrawlsApi, type StayCrawlItem, type StayCrawlJob } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Badge, PageHeader } from '@/components/ui/Page';
import { Input } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';
import { publicPageUrl } from '@/lib/publicUrl';
import { DEFAULT_LOCALE } from '@/lib/locale';
import { CrawlerTerminalLog } from '@/components/services/CrawlerTerminalLog';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'imported' || status === 'ai_done' || status === 'done') return 'success';
  if (status === 'blocked' || status === 'failed') return 'danger';
  if (status === 'queued') return 'warning';
  if (status === 'fetched' || status === 'extracted' || status === 'crawling' || status === 'running') return 'primary';
  return 'neutral';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'Chờ cào (Trong queue)',
    fetched: 'Đang cào dữ liệu',
    extracted: 'Đã lấy HTML',
    ai_done: 'Đã map dữ liệu',
    imported: 'Đã tạo trang sản phẩm',
    blocked: 'Bị chặn bot',
    failed: 'Cào lỗi',
    ready: 'Sẵn sàng',
    done: 'Hoàn tất',
    running: 'Đang chạy',
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

type ImproveFrom = 'basic' | 'gallery' | 'rooms' | 'rooms_modals';
type ItemRerunChoice = 'replace' | ImproveFrom;

const ITEM_RERUN_OPTIONS: {
  id: ItemRerunChoice;
  rerun: 'improve' | 'replace';
  from?: ImproveFrom;
  label: string;
  desc: string;
}[] = [
  {
    id: 'replace',
    rerun: 'replace',
    label: 'Xóa sạch & Cào lại từ đầu (Khuyên dùng khi muốn làm mới)',
    desc: 'Xóa toàn bộ HTML, media, tiện ích và các phòng cũ của khách sạn này để cào mới 100%.',
  },
  {
    id: 'basic',
    rerun: 'improve',
    from: 'basic',
    label: 'Cải thiện toàn bộ (Tải lại trang & bổ sung dữ liệu)',
    desc: 'Tải lại trang Booking để bóc lại thông tin và bổ sung các ảnh còn thiếu.',
  },
  {
    id: 'gallery',
    rerun: 'improve',
    from: 'gallery',
    label: 'Chỉ cào lại Gallery ảnh',
    desc: 'Giữ nguyên thông tin chung và phòng, mở modal gallery của Booking để cào thêm hình ảnh HD.',
  },
  {
    id: 'rooms',
    rerun: 'improve',
    from: 'rooms',
    label: 'Chỉ cào lại Danh sách phòng & Tiện ích',
    desc: 'Bỏ qua gallery, quét lại bảng phòng, sức chứa, giá và tiện ích phòng.',
  },
];

function JobDetailInner() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const initialLive = searchParams.get('live') === 'true';

  const jobId = rawId ? Number(rawId) : null;
  const qc = useQueryClient();
  const { can } = useAuth();
  const canDelete = can('services.delete') || can('services.create');
  const locale = DEFAULT_LOCALE;

  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'failed' | 'queued'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showModal, setShowModal] = useState(initialLive);
  const [log, setLog] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkRerunModal, setShowBulkRerunModal] = useState(false);

  // State Modal tùy chọn Cào lại cho 1 khách sạn
  const [rerunModalItem, setRerunModalItem] = useState<StayCrawlItem | null>(null);
  const [itemRerunChoice, setItemRerunChoice] = useState<ItemRerunChoice>('replace');

  // Fetch job & items với cache thông minh, không reload khi chuyển tab
  const jobQuery = useQuery({
    queryKey: ['stay-crawls-job', jobId],
    queryFn: () =>
      stayCrawlsApi.job(jobId!, {
        limit: 500,
      }),
    enabled: !!jobId,
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
    gcTime: 300000,
    refetchInterval: (query) => {
      const data = query.state.data;
      const isRunning =
        data?.job?.status === 'running' ||
        data?.job?.status === 'processing' ||
        data?.job?.status === 'crawling' ||
        Boolean(data?.job?.worker_alive);
      return isRunning ? 2500 : false;
    },
  });

  const currentJob = jobQuery.data?.job;
  const rawItems: StayCrawlItem[] = jobQuery.data?.items ?? [];
  const stats = jobQuery.data?.stats;

  // Lấy map các item đang chạy worker
  const activeWorkerItemsMap = useMemo(() => {
    const metaWorkers = ((currentJob as any)?.meta)?.worker?.active_items;
    if (metaWorkers && typeof metaWorkers === 'object') {
      return metaWorkers as Record<string, { item_id: number; updated_at?: string; message?: string }>;
    }
    return {};
  }, [((currentJob as any)?.meta)]);

  // Số lượng worker đang chạy song song
  const activeRunningCount = useMemo(() => {
    const fromMeta = Object.keys(activeWorkerItemsMap).length;
    const fromItems = rawItems.filter(
      (it) =>
        it.status === 'fetched' ||
        it.status === 'extracted' ||
        it.status === 'crawling' ||
        Boolean(activeWorkerItemsMap[String(it.id)]),
    ).length;
    return Math.max(fromMeta, fromItems);
  }, [activeWorkerItemsMap, rawItems]);

  const isCurrentJobRunning =
    currentJob?.status === 'running' ||
    currentJob?.status === 'processing' ||
    Boolean(currentJob?.worker_alive) ||
    activeRunningCount > 0;

  // Query live logs từ backend
  const logsQuery = useQuery({
    queryKey: ['stay-crawls-logs', jobId],
    queryFn: () => stayCrawlsApi.logs(jobId!),
    enabled: !!jobId && showModal,
    refetchInterval: () => (showModal ? 2000 : false),
  });

  const displayLogs = useMemo(() => {
    if (logsQuery.data?.logs && logsQuery.data.logs.length > 0) {
      return logsQuery.data.logs;
    }
    return log;
  }, [logsQuery.data?.logs, log]);

  // Filter items theo tab status và từ khóa tìm kiếm (0ms phản hồi, tức thì)
  const items = useMemo(() => {
    let list = rawItems;
    if (statusFilter === 'done') {
      list = list.filter((i) => i.status === 'imported' || i.status === 'ai_done' || i.status === 'done');
    } else if (statusFilter === 'failed') {
      list = list.filter((i) => i.status === 'failed' || i.status === 'blocked');
    } else if (statusFilter === 'queued') {
      list = list.filter((i) => i.status === 'queued' || i.status === 'fetched' || i.status === 'extracted' || i.status === 'crawling');
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.source_url.toLowerCase().includes(q) ||
          (item.slug_full && item.slug_full.toLowerCase().includes(q)) ||
          hotelLabel(item.source_url).toLowerCase().includes(q),
      );
    }
    return list;
  }, [rawItems, statusFilter, searchFilter]);

  // Tối ưu tải theo đợt (progressive rendering)
  const [displayLimit, setDisplayLimit] = useState<number>(30);
  useEffect(() => {
    setDisplayLimit(30);
  }, [statusFilter, searchFilter]);

  const visibleItems = useMemo(() => items.slice(0, displayLimit), [items, displayLimit]);
  const hasMoreItems = items.length > displayLimit;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['stay-crawls-job', jobId] });
    await qc.invalidateQueries({ queryKey: ['stay-crawls-jobs'] });
  };

  // Selection helpers
  const isAllDisplayedSelected = items.length > 0 && items.every((it) => selectedIds.includes(it.id));
  const isSomeDisplayedSelected = items.some((it) => selectedIds.includes(it.id));

  const toggleSelectAllDisplayed = () => {
    if (isAllDisplayedSelected) {
      const itemIds = new Set(items.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !itemIds.has(id)));
    } else {
      const itemIds = items.map((i) => i.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...itemIds])));
    }
  };

  const selectByStatus = (statusGroup: 'done' | 'failed' | 'queued') => {
    let targetItems: StayCrawlItem[] = [];
    if (statusGroup === 'done') {
      targetItems = rawItems.filter((i) => i.status === 'imported' || i.status === 'ai_done' || i.status === 'done');
    } else if (statusGroup === 'failed') {
      targetItems = rawItems.filter((i) => i.status === 'failed' || i.status === 'blocked');
    } else if (statusGroup === 'queued') {
      targetItems = rawItems.filter((i) => i.status === 'queued' || i.status === 'fetched' || i.status === 'extracted');
    }
    const ids = targetItems.map((i) => i.id);
    setSelectedIds(ids);
    toast.success(`Đã chọn ${ids.length} khách sạn (${statusGroup === 'done' ? 'Đã hoàn tất' : statusGroup === 'failed' ? 'Lỗi/Bị chặn' : 'Trong Queue'})`);
  };

  const toggleSelectItem = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Mutation Thử lại / Cào lại 1 item
  const retryItemMutation = useMutation({
    mutationFn: ({ itemId, rerun, from }: { itemId: number; rerun?: 'replace' | 'improve'; from?: ImproveFrom }) =>
      stayCrawlsApi.retryItem(itemId, rerun ? { rerun, from } : undefined),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã đưa khách sạn vào hàng đợi xử lý');
      setRerunModalItem(null);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Hủy / Đặt lại trạng thái 1 item
  const resetStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: string }) =>
      stayCrawlsApi.resetItemStatus(itemId, status),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật trạng thái khách sạn');
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Thử lại tất cả item lỗi của Job
  const retryFailedMutation = useMutation({
    mutationFn: (id: number) => stayCrawlsApi.retryFailed(id),
    onSuccess: (data) => {
      toast.success(data.message || `Đã kích hoạt lại ${data.retried_count} URL lỗi`);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Xóa 1 item
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => stayCrawlsApi.deleteItem(itemId),
    onSuccess: () => {
      toast.success('Đã xóa mục khách sạn');
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Xóa toàn bộ Job
  const deleteJobMutation = useMutation({
    mutationFn: () => stayCrawlsApi.deleteJob(jobId!),
    onSuccess: () => {
      toast.success(`Đã xóa thành công Job #${jobId}`);
      router.push('/services/stay-crawler/');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Bulk Mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => stayCrawlsApi.bulkDeleteItems(ids),
    onSuccess: (data) => {
      toast.success(data.message || `Đã xóa thành công ${data.deleted_count} khách sạn đã chọn`);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const bulkRetryMutation = useMutation({
    mutationFn: ({ ids, rerun, from }: { ids: number[]; rerun?: 'replace' | 'improve'; from?: ImproveFrom }) =>
      stayCrawlsApi.bulkRetryItems(ids, rerun ? { rerun, from } : undefined),
    onSuccess: (data) => {
      toast.success(data.message || `Đã đưa ${data.retried_count} khách sạn vào hàng đợi`);
      setSelectedIds([]);
      setShowBulkRerunModal(false);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const bulkResetStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
      stayCrawlsApi.bulkResetStatus(ids, status),
    onSuccess: (data) => {
      toast.success(data.message || `Đã chuyển trạng thái ${data.updated_count} khách sạn`);
      setSelectedIds([]);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!jobId) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--admin-danger-500, #ef4444)', fontWeight: 600 }}>Không tìm thấy mã Job hợp lệ.</p>
        <Link href="/services/stay-crawler/">
          <Button variant="secondary" size="sm" style={{ marginTop: '1rem' }}>
            <ArrowLeft size={14} /> Quay lại danh sách Job
          </Button>
        </Link>
      </div>
    );
  }

  const totalCount = rawItems.length || (stats?.total ?? 0);
  const doneCount = useMemo(
    () => rawItems.filter((i) => i.status === 'imported' || i.status === 'ai_done' || i.status === 'done').length,
    [rawItems]
  );
  const failedCount = useMemo(
    () => rawItems.filter((i) => i.status === 'failed' || i.status === 'blocked').length,
    [rawItems]
  );
  const queuedCount = useMemo(
    () => rawItems.filter((i) => i.status === 'queued' || i.status === 'extracted' || i.status === 'fetched' || i.status === 'crawling').length,
    [rawItems]
  );
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const categoryName = currentJob?.category?.name;

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '100%', overflowX: 'hidden', paddingBottom: '5rem' }}>
      <PageHeader
        eyebrow="Chi tiết Job Crawler"
        id={jobId}
        title={`Job #${jobId} — ${hotelLabel(currentJob?.list_url || '')}`}
        description={
          currentJob?.list_url
            ? `Nguồn Booking.com: ${currentJob.list_url}`
            : 'Theo dõi tiến trình và danh sách khách sạn đã quét trong phiên cào này.'
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/services/stay-crawler/">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={14} /> Tất cả Job
              </Button>
            </Link>

            <Button
              type="button"
              variant={showModal ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowModal(true)}
            >
              <Terminal size={14} />
              <span>Console Live Log</span>
              {isCurrentJobRunning && <span className="ui-crawler-modal__pulse-dot" style={{ marginLeft: 4 }} />}
            </Button>

            {failedCount > 0 && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={retryFailedMutation.isPending}
                onClick={() => retryFailedMutation.mutate(jobId)}
              >
                <RotateCcw size={14} /> Thử lại {failedCount} URL lỗi
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={jobQuery.isFetching}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} /> Làm mới
            </Button>

            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                style={{ color: 'var(--admin-danger-500, #ef4444)' }}
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={14} /> Xóa Job
              </Button>
            )}
          </div>
        }
      />

      {/* Floating Status Bar khi có worker đang chạy ngầm */}
      {isCurrentJobRunning && !showModal && (
        <div
          style={{
            position: 'sticky',
            top: '4.25rem',
            zIndex: 40,
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--admin-radius-lg)',
            background: 'linear-gradient(135deg, #182815 0%, #223c1d 100%)',
            border: '1px solid rgba(147, 178, 94, 0.4)',
            boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span className="ui-crawler-modal__pulse-dot" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: '#b5cb86' }}>
                  Tiến trình Job #{jobId} đang xử lý Supervisor đa luồng
                </p>
                {activeRunningCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(107, 143, 63, 0.3)',
                      border: '1px solid #93b25e',
                      color: '#e9efd6',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.35rem',
                    }}
                  >
                    ⚡ {activeRunningCount} worker song song
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                Tiến độ: {doneCount}/{totalCount} khách sạn ({progressPercent}%)
              </p>
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowModal(true)}>
            <Maximize2 size={13} /> Mở Live Console
          </Button>
        </div>
      )}

      {/* Hero Overview Panel of the Job */}
      <div className="ui-crawler-detail-hero">
        <div className="ui-crawler-detail-hero__left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Badge tone={statusTone(currentJob?.status || 'pending')}>
                {statusLabel(currentJob?.status || 'pending')}
              </Badge>

              {categoryName && (
                <span className="ui-crawler-job-card__category-chip">
                  <FolderKanban size={13} /> Danh mục: {categoryName}
                </span>
              )}

              {isCurrentJobRunning && (
                <Badge tone="primary">
                  <span className="ui-crawler-modal__pulse-dot" style={{ marginRight: 4 }} />
                  Đang cào (Live)
                </Badge>
              )}
            </div>

            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--admin-ink)', letterSpacing: '-0.02em' }}>
              {hotelLabel(currentJob?.list_url || '')}
            </h2>

            {currentJob?.list_url && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--admin-radius-md)',
                  background: 'var(--admin-surface-tint)',
                  border: '1px solid var(--admin-line)',
                  fontSize: '0.82rem',
                }}
              >
                <Globe2 size={14} style={{ color: 'var(--admin-muted)', flexShrink: 0 }} />
                <a
                  href={currentJob.list_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--admin-primary-600)',
                    wordBreak: 'break-all',
                    textDecoration: 'none',
                    fontWeight: 500,
                    flex: 1,
                  }}
                >
                  {currentJob.list_url}
                </a>
                <button
                  type="button"
                  title="Sao chép liên kết"
                  onClick={() => {
                    navigator.clipboard.writeText(currentJob.list_url);
                    toast.success('Đã sao chép liên kết Booking.com');
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--admin-muted)',
                    padding: '0.2rem',
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--admin-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Ngày tạo: <strong>{formatDate(currentJob?.created_at)}</strong></span>
            {currentJob?.pages_crawled ? <span>Đã duyệt: <strong>{currentJob.pages_crawled}</strong> trang</span> : null}
          </div>
        </div>

        <div className="ui-crawler-detail-hero__right">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--admin-muted)' }}>
              Tiến độ bóc tách
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--admin-ink)' }}>
              {progressPercent}%
            </span>
          </div>

          <div style={{ width: '100%', height: '0.65rem', borderRadius: '999px', background: 'var(--admin-line)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${progressPercent}%`, background: 'var(--admin-success, #3d8b55)', transition: 'width 0.3s' }} />
            {failedCount > 0 && totalCount > 0 && (
              <div style={{ width: `${(failedCount / totalCount) * 100}%`, background: 'var(--admin-danger, #c84b42)' }} />
            )}
            {queuedCount > 0 && totalCount > 0 && (
              <div style={{ width: `${(queuedCount / totalCount) * 100}%`, background: 'var(--admin-warning, #b88a24)' }} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
            <div style={{ padding: '0.5rem 0.65rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', display: 'block' }}>Tổng khách sạn</span>
              <strong style={{ fontSize: '1rem', color: 'var(--admin-ink)' }}>{totalCount}</strong>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-success)', display: 'block' }}>✓ Đã hoàn tất</span>
              <strong style={{ fontSize: '1rem', color: 'var(--admin-success)' }}>{doneCount}</strong>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-warning)', display: 'block' }}>⏱ Đang trong Queue</span>
              <strong style={{ fontSize: '1rem', color: 'var(--admin-warning)' }}>{queuedCount}</strong>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-danger)', display: 'block' }}>✗ Lỗi / Bị chặn</span>
              <strong style={{ fontSize: '1rem', color: 'var(--admin-danger)' }}>{failedCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Hotel Items Explorer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: 'var(--admin-radius-xl)',
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-line)',
          boxShadow: '0 2px 12px -2px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 750, color: 'var(--admin-ink)' }}>
              Danh sách khách sạn ({items.length} mục hiển thị)
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--admin-muted)' }}>
              Toàn bộ danh sách khách sạn đã quét. Bạn có thể chọn cùng loại hoặc chọn nhiều để thao tác hàng loạt.
            </p>
          </div>

          {/* Segmented Filter Tabs */}
          <div className="ui-crawler-tabs">
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'all' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>Tất cả</span>
              <span className="ui-crawler-tabs__count">{totalCount}</span>
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'done' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => setStatusFilter('done')}
            >
              <span>✓ Hoàn tất</span>
              <span className="ui-crawler-tabs__count">{doneCount}</span>
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'queued' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => setStatusFilter('queued')}
            >
              <span>⏱ Chờ cào</span>
              {queuedCount > 0 && <span className="ui-crawler-tabs__count">{queuedCount}</span>}
            </button>
            <button
              type="button"
              className={`ui-crawler-tabs__tab ${statusFilter === 'failed' ? 'ui-crawler-tabs__tab--active' : ''}`}
              onClick={() => setStatusFilter('failed')}
            >
              <span>✗ Lỗi / Chặn</span>
              {failedCount > 0 && (
                <span className="ui-crawler-tabs__count" style={{ color: 'var(--admin-danger)' }}>
                  {failedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search & Quick Selection Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
          <Input
            label="Tìm kiếm khách sạn trong Job"
            placeholder="Nhập tên khách sạn, đường dẫn slug hoặc liên kết Booking.com..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '1.45rem', flexWrap: 'wrap' }}>
            {/* Quick Type Selection Pills */}
            <Button
              type="button"
              size="sm"
              variant={isAllDisplayedSelected ? 'primary' : 'secondary'}
              onClick={toggleSelectAllDisplayed}
            >
              {isAllDisplayedSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              <span>{isAllDisplayedSelected ? 'Bỏ chọn trang này' : 'Chọn tất cả trang này'}</span>
            </Button>

            {failedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                style={{ color: 'var(--admin-danger-500, #ef4444)' }}
                onClick={() => selectByStatus('failed')}
              >
                Chọn tất cả {failedCount} lỗi
              </Button>
            )}

            {queuedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                style={{ color: 'var(--admin-warning-500, #eab308)' }}
                onClick={() => selectByStatus('queued')}
              >
                Chọn {queuedCount} đang chờ
              </Button>
            )}

            {doneCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => selectByStatus('done')}
              >
                Chọn {doneCount} đã xong
              </Button>
            )}

            {selectedIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                <X size={13} /> Bỏ chọn ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>

        {/* Hotel Items Cards */}
        {items.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--admin-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>Không có khách sạn nào khớp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {visibleItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isMutatingThis = retryItemMutation.isPending && retryItemMutation.variables?.itemId === item.id;
              const isResettingThis = resetStatusMutation.isPending && resetStatusMutation.variables?.itemId === item.id;
              const isDeletingThis = deleteItemMutation.isPending && deleteItemMutation.variables === item.id;
              const isFailedOrBlocked = item.status === 'failed' || item.status === 'blocked';
              const isDone = item.status === 'imported' || item.status === 'ai_done' || item.status === 'done';
              const isQueued = item.status === 'queued';

              const isQueueRunning =
                Boolean(activeWorkerItemsMap[String(item.id)]) ||
                item.status === 'fetched' ||
                item.status === 'extracted' ||
                item.status === 'crawling';

              const pubUrl = item.slug_full ? publicPageUrl(item.slug_full, locale, DEFAULT_LOCALE) : null;

              return (
                <div
                  key={item.id}
                  className="ui-crawler-item-card"
                  style={{
                    border: isSelected
                      ? '1px solid var(--admin-primary-500, #6b8f3f)'
                      : undefined,
                    background: isSelected
                      ? 'color-mix(in srgb, var(--admin-primary-500) 4%, var(--admin-surface))'
                      : undefined,
                  }}
                >
                  {/* Selection Checkbox */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingRight: '0.4rem',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleSelectItem(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.id)}
                      style={{
                        width: '1.1rem',
                        height: '1.1rem',
                        accentColor: 'var(--admin-primary-500, #6b8f3f)',
                        cursor: 'pointer',
                      }}
                    />
                  </div>

                  <div className="ui-crawler-item-card__main">
                    <div className="ui-crawler-item-card__title-row">
                      <span className="ui-crawler-item-card__name">
                        {hotelLabel(item.source_url)}
                      </span>

                      <Badge tone={statusTone(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>

                      {isQueueRunning && (
                        <Badge tone="primary">
                          <span className="ui-crawler-modal__pulse-dot" style={{ marginRight: 4 }} />
                          Worker đang cào
                        </Badge>
                      )}

                      {pubUrl && (
                        <a
                          href={pubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ui-crawler-item-card__slug-badge"
                          title="Xem trang web đã tạo"
                        >
                          <span>/{item.slug_full}</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    {item.error ? (
                      <div className="ui-crawler-item-card__error-callout">
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>Lỗi: {item.error}</span>
                      </div>
                    ) : item.blocked_reason ? (
                      <div className="ui-crawler-item-card__error-callout">
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>Chặn bot: {item.blocked_reason}</span>
                      </div>
                    ) : (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.78rem', color: 'var(--admin-muted)', textDecoration: 'none', wordBreak: 'break-all' }}
                      >
                        {item.source_url}
                      </a>
                    )}
                  </div>

                  <div className="ui-crawler-item-card__actions">
                    {/* Nút Chỉnh sửa sản phẩm khách sạn đã tạo */}
                    {item.service_id ? (
                      <Link
                        href={`/services/products/form/?id=${item.service_id}&cluster=stay`}
                        target="_blank"
                        className="inline-flex"
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          title="Mở giao diện sửa khách sạn này trong tab mới"
                          style={{
                            borderColor: 'var(--admin-primary-500, #6b8f3f)',
                            color: 'var(--admin-primary-700, #405825)',
                            fontWeight: 600,
                          }}
                        >
                          <Pencil size={13} /> Sửa
                        </Button>
                      </Link>
                    ) : null}

                    {isQueueRunning ? (
                      <Button type="button" size="sm" variant="secondary" disabled style={{ opacity: 0.8 }}>
                        <Zap size={13} className="animate-spin" /> Đang cào...
                      </Button>
                    ) : isDone ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRerunModalItem(item);
                          setItemRerunChoice('replace');
                        }}
                      >
                        <RotateCcw size={13} /> Cào lại
                      </Button>
                    ) : isFailedOrBlocked ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={isMutatingThis || isResettingThis}
                        loading={isMutatingThis}
                        onClick={() => retryItemMutation.mutate({ itemId: item.id })}
                      >
                        <RotateCcw size={13} /> Thử lại
                      </Button>
                    ) : isQueued ? (
                      <>
                        <Button type="button" size="sm" variant="secondary" disabled style={{ opacity: 0.8 }}>
                          <Clock size={13} /> Chờ cào
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Hủy khỏi hàng đợi"
                          disabled={isResettingThis || isMutatingThis}
                          loading={isResettingThis}
                          onClick={() => resetStatusMutation.mutate({ itemId: item.id, status: 'failed' })}
                        >
                          <X size={13} /> Hủy Queue
                        </Button>
                      </>
                    ) : null}

                    {pubUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(pubUrl, '_blank')}
                      >
                        <ExternalLink size={13} /> Xem trang
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      style={{ color: 'var(--admin-danger-500, #ef4444)' }}
                      disabled={isDeletingThis}
                      loading={isDeletingThis}
                      title="Xóa mục khách sạn này"
                      onClick={() => {
                        if (confirm(`Xác nhận xóa khách sạn "${hotelLabel(item.source_url)}"?`)) {
                          deleteItemMutation.mutate(item.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMoreItems && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              padding: '1.25rem 1rem',
              borderRadius: 'var(--admin-radius-lg)',
              background: 'var(--admin-surface-subtle, #f8fafc)',
              border: '1px dashed var(--admin-line, #e2e8f0)',
              marginTop: '0.5rem',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--admin-muted, #64748b)' }}>
              Đang hiển thị <strong>{visibleItems.length}</strong> / <strong>{items.length}</strong> khách sạn
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDisplayLimit((prev) => Math.min(items.length, prev + 30))}
              >
                + Tải thêm 30 khách sạn (còn {items.length - visibleItems.length})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDisplayLimit(items.length)}
              >
                Hiển thị tất cả ({items.length})
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: 'min(52rem, calc(100vw - 2rem))',
            width: '100%',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--admin-radius-xl)',
            background: 'var(--admin-surface, #ffffff)',
            border: '1px solid var(--admin-primary-500, #6b8f3f)',
            boxShadow: '0 16px 36px -4px rgba(0,0,0,0.22), 0 0 0 1px var(--admin-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                background: 'var(--admin-primary-500, #6b8f3f)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 750,
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              {selectedIds.length}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--admin-ink)' }}>
              Đã chọn {selectedIds.length} khách sạn
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={bulkRetryMutation.isPending}
              onClick={() => bulkRetryMutation.mutate({ ids: selectedIds })}
            >
              <RotateCcw size={13} /> Thử lại ({selectedIds.length})
            </Button>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowBulkRerunModal(true)}
            >
              <RefreshCw size={13} /> Tùy chọn cào lại...
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={bulkResetStatusMutation.isPending}
              onClick={() => bulkResetStatusMutation.mutate({ ids: selectedIds, status: 'failed' })}
            >
              <X size={13} /> Hủy Queue ({selectedIds.length})
            </Button>

            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Trash2 size={13} /> Xóa ({selectedIds.length})
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa hàng loạt */}
      {showBulkDeleteModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div className="ui-modal__veil" onClick={() => setShowBulkDeleteModal(false)} />
          <div className="ui-modal__card" style={{ maxWidth: '30rem' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title" style={{ color: 'var(--admin-danger-500, #ef4444)' }}>
                Xác nhận xóa hàng loạt?
              </h2>
            </header>
            <div className="ui-modal__body">
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.55 }}>
                Bạn có chắc chắn muốn <strong>xóa vĩnh viễn {selectedIds.length} khách sạn đã chọn</strong> khỏi phiên cào Job #{jobId}?
              </p>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" onClick={() => setShowBulkDeleteModal(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              >
                Xác nhận xóa {selectedIds.length} mục
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Tùy chọn Cào lại Hàng loạt */}
      {showBulkRerunModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button
            type="button"
            className="ui-modal__veil"
            aria-label="Đóng"
            onClick={() => setShowBulkRerunModal(false)}
          />
          <div className="ui-modal__card ui-modal__card--form" style={{ width: 'min(32rem, 100%)' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title">Tùy chọn cào lại hàng loạt</h2>
              <p className="ui-modal__desc" style={{ marginBottom: 0 }}>
                Áp dụng cho <strong>{selectedIds.length} khách sạn đã chọn</strong>
              </p>
            </header>
            <div className="ui-modal__body" style={{ paddingTop: '0.75rem' }}>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="ui-field__label" style={{ marginBottom: '0.6rem' }}>
                  Chọn phương án cào lại
                </legend>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {ITEM_RERUN_OPTIONS.map((opt) => {
                    const active = itemRerunChoice === opt.id;
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: 'flex',
                          gap: '0.6rem',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          padding: '0.65rem 0.8rem',
                          borderRadius: 'var(--admin-radius-md)',
                          border: active
                            ? '1px solid var(--admin-primary-500)'
                            : '1px solid var(--admin-line)',
                          background: active
                            ? 'color-mix(in srgb, var(--admin-primary-500) 8%, var(--admin-surface))'
                            : 'var(--admin-surface)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="bulk-rerun-choice"
                          value={opt.id}
                          checked={active}
                          onChange={() => setItemRerunChoice(opt.id)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <span>
                          <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--admin-ink)' }}>{opt.label}</strong>
                          <span className="ui-field__hint" style={{ display: 'block', marginTop: '0.15rem' }}>
                            {opt.desc}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" onClick={() => setShowBulkRerunModal(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant={itemRerunChoice === 'replace' ? 'danger' : 'primary'}
                loading={bulkRetryMutation.isPending}
                onClick={() => {
                  const chosen = ITEM_RERUN_OPTIONS.find((o) => o.id === itemRerunChoice) || ITEM_RERUN_OPTIONS[0];
                  bulkRetryMutation.mutate({
                    ids: selectedIds,
                    rerun: chosen.rerun,
                    from: chosen.from,
                  });
                }}
              >
                Cào lại {selectedIds.length} khách sạn
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Xóa Job */}
      {showDeleteModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div className="ui-modal__veil" onClick={() => setShowDeleteModal(false)} />
          <div className="ui-modal__card" style={{ maxWidth: '28rem' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title" style={{ color: 'var(--admin-danger-500, #ef4444)' }}>
                Xác nhận xóa Job #{jobId}?
              </h2>
            </header>
            <div className="ui-modal__body">
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.55 }}>
                Hành động này sẽ <strong>xóa vĩnh viễn Job #{jobId}</strong> và toàn bộ <strong>{totalCount} khách sạn</strong> thuộc job này khỏi danh sách quản lý crawler.
              </p>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleteJobMutation.isPending}
                onClick={() => deleteJobMutation.mutate()}
              >
                Xác nhận xóa Job
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Tùy chọn Cào lại cho 1 Khách sạn đã có trang */}
      {rerunModalItem && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button
            type="button"
            className="ui-modal__veil"
            aria-label="Đóng"
            onClick={() => setRerunModalItem(null)}
          />
          <div className="ui-modal__card ui-modal__card--form" style={{ width: 'min(32rem, 100%)' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title">Tùy chọn cào lại khách sạn</h2>
              <p className="ui-modal__desc" style={{ marginBottom: 0 }}>
                Khách sạn: <strong>{hotelLabel(rerunModalItem.source_url)}</strong>
              </p>
            </header>
            <div className="ui-modal__body" style={{ paddingTop: '0.75rem' }}>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="ui-field__label" style={{ marginBottom: '0.6rem' }}>
                  Chọn phương án cào lại
                </legend>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {ITEM_RERUN_OPTIONS.map((opt) => {
                    const active = itemRerunChoice === opt.id;
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: 'flex',
                          gap: '0.6rem',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          padding: '0.65rem 0.8rem',
                          borderRadius: 'var(--admin-radius-md)',
                          border: active
                            ? '1px solid var(--admin-primary-500)'
                            : '1px solid var(--admin-line)',
                          background: active
                            ? 'color-mix(in srgb, var(--admin-primary-500) 8%, var(--admin-surface))'
                            : 'var(--admin-surface)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="item-rerun-choice"
                          value={opt.id}
                          checked={active}
                          onChange={() => setItemRerunChoice(opt.id)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <span>
                          <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--admin-ink)' }}>{opt.label}</strong>
                          <span className="ui-field__hint" style={{ display: 'block', marginTop: '0.15rem' }}>
                            {opt.desc}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" onClick={() => setRerunModalItem(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant={itemRerunChoice === 'replace' ? 'danger' : 'primary'}
                loading={retryItemMutation.isPending}
                onClick={() => {
                  const chosen = ITEM_RERUN_OPTIONS.find((o) => o.id === itemRerunChoice) || ITEM_RERUN_OPTIONS[0];
                  retryItemMutation.mutate({
                    itemId: rerunModalItem.id,
                    rerun: chosen.rerun,
                    from: chosen.from,
                  });
                }}
              >
                Xác nhận cào lại
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Live Crawler & Terminal Log */}
      {showModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button type="button" className="ui-modal__veil" aria-label="Đóng" onClick={() => setShowModal(false)} />
          <div className="ui-modal__card ui-crawler-modal" role="document">
            <header className="ui-crawler-modal__head">
              <div className="ui-crawler-modal__brand">
                <div className="ui-crawler-modal__icon-box">
                  {isCurrentJobRunning ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </div>
                <div className="ui-crawler-modal__titles">
                  <p className="ui-crawler-modal__eyebrow">Booking.com Crawler Engine</p>
                  <h2 className="ui-crawler-modal__title">
                    Tiến trình Job #{jobId}
                  </h2>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className={`ui-crawler-modal__badge ${!isCurrentJobRunning ? 'ui-crawler-modal__badge--done' : ''}`}>
                  {isCurrentJobRunning && <span className="ui-crawler-modal__pulse-dot" />}
                  <span>{isCurrentJobRunning ? 'Đang xử lý (Live)' : 'Đã dừng / Hoàn tất'}</span>
                </div>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  style={{ padding: '0.4rem', borderRadius: '0.4rem' }}
                  title="Đóng cửa sổ theo dõi"
                  onClick={() => setShowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="ui-crawler-modal__body">
              <p className="ui-crawler-modal__hint">
                💡 Bạn có thể <strong>đóng cửa sổ này</strong> hoặc <strong>tải lại trang</strong> bất cứ lúc nào. Tiến trình cào và worker nền Supervisor vẫn tự động xử lý.
              </p>
              <CrawlerTerminalLog logs={displayLogs} running={isCurrentJobRunning} maxHeight="min(52vh, 24rem)" />
            </div>
            <footer className="ui-crawler-modal__foot">
              <span style={{ fontSize: '0.78rem', color: 'var(--admin-muted, #64748b)' }}>
                {log.length > 0 ? `Đã ghi nhận ${log.length} dòng sự kiện` : 'Chờ sự kiện tiếp theo từ engine...'}
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Đóng cửa sổ theo dõi
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StayCrawlerDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải chi tiết Job...</div>}>
      <JobDetailInner />
    </Suspense>
  );
}
