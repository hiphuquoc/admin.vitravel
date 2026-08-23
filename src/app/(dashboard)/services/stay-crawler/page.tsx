'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  History,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  SlidersHorizontal,
  Terminal,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import toast from '@/lib/toast';
import { ApiClientError } from '@/lib/api';
import { serviceCategoriesApi, stayCrawlsApi, type StayCrawlItem, type StayCrawlJob } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Badge, PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { EntityList, EntityMain, EntityRow, EntityActions } from '@/components/ui/EntityList';
import { useAuth } from '@/lib/auth-context';
import { publicPageUrl } from '@/lib/publicUrl';
import { DEFAULT_LOCALE } from '@/lib/locale';
import { CrawlerTerminalLog } from '@/components/services/CrawlerTerminalLog';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'imported' || status === 'ai_done' || status === 'done') return 'success';
  if (status === 'blocked' || status === 'failed') return 'danger';
  if (
    status === 'extracted' ||
    status === 'fetched' ||
    status === 'crawling' ||
    status === 'running' ||
    status === 'processing'
  )
    return 'primary';
  return 'warning';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'Đang trong Queue (Chờ Worker)',
    fetched: 'Đang cào dữ liệu',
    extracted: 'Đang trích xuất HTML',
    ai_done: 'Đã map dữ liệu',
    imported: 'Đã tạo trang',
    blocked: 'Bị chặn (Cloudflare/Captcha)',
    failed: 'Cào lỗi',
    ready: 'Sẵn sàng',
    done: 'Hoàn tất',
    running: 'Đang chạy',
    processing: 'Đang xử lý',
    crawling: 'Đang cào',
  };
  return map[status] || status;
}

function isHotelUrl(url: string): boolean {
  try {
    return /\/hotel\/[a-z]{2}\/[^/]+\.html/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
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
      return `Danh mục: ${ss}`;
    }
    return 'Chỗ nghỉ Booking.com';
  } catch {
    return url.length > 60 ? url.substring(0, 60) + '…' : url;
  }
}

function jobSummaryLabel(job: StayCrawlJob): string {
  if (!job) return '';
  const name = hotelLabel(job.list_url || '');
  const count = job.items_found || job.items_count || 0;
  return `Job #${job.id} — ${name} (${count} mục)`;
}

function previewUrl(slugFull: string | null | undefined, locale: string, defaultLocale: string): string | null {
  return publicPageUrl(slugFull, locale, defaultLocale, { preview: true });
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

export default function StayCrawlerPage() {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const locale = DEFAULT_LOCALE;
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'failed' | 'queued'>('all');
  const [mode, setMode] = useState<'hotel' | 'list'>('hotel');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const runningRef = useRef(false);
  const [log, setLog] = useState<string[]>([]);

  // State Modal tùy chọn Cào lại cho 1 khách sạn đã có trang
  const [rerunModalItem, setRerunModalItem] = useState<StayCrawlItem | null>(null);
  const [itemRerunChoice, setItemRerunChoice] = useState<ItemRerunChoice>('replace');

  // Mutation Thử lại / Cào lại item (Lưu rõ ràng trạng thái và khóa tức thời)
  const retryItemMutation = useMutation({
    mutationFn: ({ itemId, rerun, from }: { itemId: number; rerun?: 'replace' | 'improve'; from?: ImproveFrom }) =>
      stayCrawlsApi.retryItem(itemId, rerun ? { rerun, from } : undefined),
    onMutate: ({ itemId }) => {
      // Optimistic update: chuyển ngay sang queued trên cache UI
      qc.setQueryData(['stay-crawls-job', activeJobId, statusFilter], (old: any) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          items: old.items.map((it: StayCrawlItem) =>
            it.id === itemId ? { ...it, status: 'queued', error: null, blocked_reason: null } : it,
          ),
        };
      });
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Đã đưa khách sạn vào hàng đợi xử lý');
      setRerunModalItem(null);
      void refresh();
    },
    onError: (e) => {
      toast.error((e as Error).message);
    },
  });

  // Mutation Hủy / Đặt lại trạng thái item (để reset queue chủ động)
  const resetStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: string }) =>
      stayCrawlsApi.resetItemStatus(itemId, status),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật trạng thái khách sạn');
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutation Thử lại tất cả item lỗi
  const retryFailedMutation = useMutation({
    mutationFn: (jobId: number) => stayCrawlsApi.retryFailed(jobId),
    onSuccess: (data) => {
      toast.success(data.message || `Đã kích hoạt lại ${data.retried_count} URL lỗi`);
      void refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const statusQuery = useQuery({
    queryKey: ['stay-crawls-status'],
    queryFn: () => stayCrawlsApi.status(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['stay-categories-list'],
    queryFn: () => serviceCategoriesApi.list({ cluster: 'stay', per_page: 100 }),
  });

  const jobsQuery = useQuery({
    queryKey: ['stay-crawls-jobs', categoryId],
    queryFn: () => stayCrawlsApi.jobs({ service_category_id: categoryId ?? undefined, per_page: 30 }),
    refetchInterval: running ? 2500 : 6000,
  });

  const jobsList: StayCrawlJob[] = jobsQuery.data?.items ?? [];
  const activeJobId = selectedJobId ?? jobsList[0]?.id ?? null;

  const jobQuery = useQuery({
    queryKey: ['stay-crawls-job', activeJobId, statusFilter],
    queryFn: () =>
      stayCrawlsApi.job(activeJobId!, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 500,
      }),
    enabled: !!activeJobId,
    refetchInterval: 2000,
  });

  const currentJob = jobQuery.data?.job;
  const rawItems: StayCrawlItem[] = jobQuery.data?.items ?? [];
  const stats = jobQuery.data?.stats;

  // Lấy danh sách ID các item đang được worker xử lý từ job meta
  const activeWorkerItemsMap = useMemo(() => {
    const metaWorkers = ((currentJob as any)?.meta)?.worker?.active_items;
    if (metaWorkers && typeof metaWorkers === 'object') {
      return metaWorkers as Record<string, { item_id: number; updated_at?: string; message?: string }>;
    }
    return {};
  }, [(currentJob as any)?.meta]);

  // Số lượng worker đang chạy song song
  const activeRunningCount = useMemo(() => {
    const fromMeta = Object.keys(activeWorkerItemsMap).length;
    const fromItems = rawItems.filter(
      (it) => it.status === 'fetched' || it.status === 'extracted' || it.status === 'crawling' || Boolean(activeWorkerItemsMap[String(it.id)]),
    ).length;
    return Math.max(fromMeta, fromItems);
  }, [activeWorkerItemsMap, rawItems]);

  // Filter items theo từ khóa tìm kiếm
  const items = useMemo(() => {
    if (!searchFilter.trim()) return rawItems;
    const q = searchFilter.toLowerCase().trim();
    return rawItems.filter(
      (item) =>
        item.source_url.toLowerCase().includes(q) ||
        (item.slug_full && item.slug_full.toLowerCase().includes(q)) ||
        hotelLabel(item.source_url).toLowerCase().includes(q),
    );
  }, [rawItems, searchFilter]);

  const isCurrentJobRunning =
    running ||
    currentJob?.status === 'running' ||
    currentJob?.status === 'processing' ||
    Boolean(currentJob?.worker_alive) ||
    activeRunningCount > 0;

  useEffect(() => {
    if (statusQuery.data?.proxy_enabled_default && statusQuery.data.proxy_configured) {
      setUseProxy(true);
    }
  }, [statusQuery.data]);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-120), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['stay-crawls-jobs'] });
    await qc.invalidateQueries({ queryKey: ['stay-crawls-job'] });
  };

  const runCrawl = async () => {
    if (runningRef.current) return;
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục lưu trú đích.');
      return;
    }
    const listUrl = url.trim();
    if (!listUrl) {
      toast.error('Vui lòng dán URL chỗ nghỉ hoặc danh mục Booking.com.');
      return;
    }
    const hotelUrl = isHotelUrl(listUrl);
    if (mode === 'hotel' && !hotelUrl) {
      toast.error('Chế độ 1 chỗ nghỉ cần URL dạng booking.com/hotel/vn/ten.html');
      return;
    }

    runningRef.current = true;
    setRunning(true);
    setShowModal(true);
    setLog([]);
    const runList = mode === 'list' && !hotelUrl;
    appendLog(runList ? `Bắt đầu cào danh mục: ${listUrl}` : `Bắt đầu cào 1 chỗ nghỉ: ${listUrl}`);

    try {
      appendLog(runList ? 'Đang quét danh sách chỗ nghỉ trên Booking.com…' : 'Đã nhận URL — đưa vào queue…');
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: listUrl,
        html: html.trim() || undefined,
        use_proxy: useProxy || undefined,
      });

      const jobId = started.job?.id;
      if (jobId) {
        setSelectedJobId(jobId);
      }
      const total =
        (Array.isArray(started.urls) ? started.urls.length : 0) ||
        Number(started.job?.items_found || 0) ||
        (Array.isArray(started.items) ? started.items.length : 0);

      if (!jobId) {
        appendLog('⚠ Không tạo được job crawler.');
        await refresh();
        return;
      }

      if (started.is_listing_async) {
        appendLog('🚀 Đang khởi động Chrome quét danh sách ở background (hỗ trợ đa luồng Supervisor)…');
      } else if (total) {
        appendLog(`✓ Đã gom ${total} khách sạn — hệ thống tự động chạy các khách sạn mới/chưa cào.`);
      }

      let guard = 0;
      let networkFails = 0;
      let lastSeq = 0;
      const workerMode = Boolean(started.worker?.running || started.job?.worker_alive || runList);
      const maxCompletedSteps = workerMode ? 50_000 : runList ? 400 : 120;
      const maxWallMs = workerMode ? 7 * 24 * 60 * 60_000 : runList ? 90 * 60_000 : 45 * 60_000;
      const startedAt = Date.now();

      while (guard < maxCompletedSteps && Date.now() - startedAt < maxWallMs) {
        try {
          const step = await stayCrawlsApi.processNext(jobId, {
            locale,
            html: lastSeq === 0 && html.trim() ? html.trim() : undefined,
            use_proxy: useProxy || undefined,
          });
          networkFails = 0;

          const seq = Number(step.last_step?.seq || 0);
          const phase = String(step.phase || step.last_step?.phase || '');
          const msg = String(step.message || step.last_step?.message || '');

          if (phase === 'listing') {
            const urlsCount = step.urls_found || step.total || 0;
            appendLog(`🔍 [Danh sách] ${msg || 'Đang quét URL...'} — đã gom ${urlsCount} khách sạn`);
            await refresh();
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          if (seq > lastSeq) {
            lastSeq = seq;
            guard++;
            const itemLabel = step.item
              ? hotelLabel(step.item.source_url)
              : hotelLabel(String(step.last_step?.source_url || listUrl));
            const status = step.item?.status || step.last_step?.item_status;
            if (status === 'blocked') {
              appendLog(`✗ ${itemLabel} — bị chặn`);
            } else if (status === 'failed') {
              appendLog(`✗ ${itemLabel} — lỗi: ${step.item?.error || step.last_step?.error || ''}`);
            } else if (step.service?.slug_full && phase === 'basic') {
              appendLog(`✓ ${itemLabel} → Tạo trang /${step.service.slug_full}`);
            } else if (msg) {
              appendLog(`• ${itemLabel} — ${msg}`);
            }
          }

          if (step.done && !step.busy) {
            appendLog(`\n═══ XONG: ${step.imported} trang hoàn tất, ${step.failed} lỗi, ${step.blocked} bị chặn ═══`);
            toast.success(`Đã hoàn tất phiên cào: ${step.imported} trang tạo thành công`);
            break;
          }

          if (step.busy) {
            await new Promise((r) => setTimeout(r, 3500));
            continue;
          }

          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          const err = e as ApiClientError;
          networkFails++;
          appendLog(`✗ Lỗi kết nối (${networkFails}): ${err.message}`);
          if (networkFails >= 4) break;
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      await refresh();
    } catch (e: any) {
      appendLog(`✗ Lỗi khởi động: ${e?.message || 'Không xác định'}`);
      toast.error(e?.message || 'Lỗi khởi động crawler');
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const categories = categoriesQuery.data?.items ?? [];
  const browserBlocked = statusQuery.data?.browser_ready === false;
  const crawlDisabled = !categoryId || !canCreate || !url.trim() || running || browserBlocked;

  return (
    <div className="crawler-page-container" style={{ display: 'grid', gap: '1.25rem', maxWidth: '100%', overflowX: 'hidden' }}>
      <PageHeader
        eyebrow="Lưu trú"
        title="Crawler Booking.com"
        description="Bóc tách tự động thông tin, hình ảnh HD và tiện ích phòng từ Booking.com vào hệ thống ViTravel."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showModal ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowModal(true)}
            >
              <Terminal size={14} />
              <span>Xem Console / Live Log</span>
              {isCurrentJobRunning && <span className="ui-crawler-modal__pulse-dot" style={{ marginLeft: 4 }} />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={jobsQuery.isFetching || jobQuery.isFetching}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} /> Làm mới
            </Button>
          </div>
        }
      />

      {/* Floating Status Bar khi có job đang chạy ngầm */}
      {isCurrentJobRunning && !showModal && (
        <div
          style={{
            position: 'sticky',
            top: '4.25rem',
            zIndex: 40,
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #132213 0%, #1c3519 100%)',
            border: '1px solid rgba(107, 143, 63, 0.45)',
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
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: '#86efac' }}>
                  Tiến trình Crawler (Job #{activeJobId || '...'}) đang xử lý đa luồng Supervisor
                </p>
                {activeRunningCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(34, 197, 94, 0.25)',
                      border: '1px solid #4ade80',
                      color: '#bbf7d0',
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
                {log[log.length - 1] || 'Các worker Supervisor đang bốc và cào các khách sạn song song...'}
              </p>
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowModal(true)}>
            <Maximize2 size={13} /> Mở Live Modal
          </Button>
        </div>
      )}

      {/* Khối Khởi tạo Crawler */}
      <FormSection
        icon={ScanSearch}
        title="Khởi tạo Crawler"
        description="Chọn danh mục đích và nhập URL Booking.com để bắt đầu."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <Select
            label="Danh mục lưu trú đích"
            required
            placeholder="— Chọn danh mục —"
            options={categories.map((c) => ({
              value: String(c.id),
              label: c.name ? `${c.name} (ID: ${c.id})` : `#${c.id}`,
            }))}
            value={categoryId ? String(categoryId) : ''}
            onChange={(val) => {
              const id = val ? Number(val) : null;
              setCategoryId(id);
              setSelectedJobId(null);
            }}
          />

          <Select
            label="Chế độ cào"
            options={[
              { value: 'hotel', label: '1 Khách sạn cụ thể (Single Hotel)' },
              { value: 'list', label: 'Cào theo Danh mục / Tìm kiếm (Search Listing)' },
            ]}
            value={mode}
            onChange={(val) => setMode(val as 'hotel' | 'list')}
          />
        </div>

        <Input
          label="URL Booking.com"
          required
          placeholder={
            mode === 'hotel'
              ? 'https://www.booking.com/hotel/vn/ten-khach-san.vi.html'
              : 'https://www.booking.com/searchresults.vi.html?ss=Phu+Quoc…'
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <Textarea
          label="Dán mã nguồn HTML (Tuỳ chọn - Dự phòng khi bị Captcha chặn)"
          hint="Mở link trên trình duyệt cá nhân -> Lưu trang / Save As HTML -> Dán nội dung vào đây."
          rows={2}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: '0.25rem',
          }}
        >
          <Switch
            label="Kích hoạt Proxy Residential"
            hint={
              statusQuery.data?.proxy_configured
                ? 'Sử dụng cụm proxy cấu hình trong STAY_CRAWL_PROXY_*'
                : 'Chưa cấu hình STAY_CRAWL_PROXY_* trong .env'
            }
            checked={useProxy}
            onChange={setUseProxy}
            disabled={!statusQuery.data?.proxy_configured}
          />

          <Button
            type="button"
            variant="primary"
            disabled={crawlDisabled}
            loading={running}
            onClick={() => void runCrawl()}
          >
            <Play size={16} /> Bắt đầu cào dữ liệu
          </Button>
        </div>
      </FormSection>

      {/* Bảng Danh sách Khách sạn & Quản lý Job Hiện tại */}
      {activeJobId && (
        <FormSection
          icon={Building2}
          title={`Danh sách khách sạn (Job #${activeJobId})`}
          description="Toàn bộ danh sách khách sạn được quét trong phiên. Trạng thái cập nhật tự động thời gian thực."
        >
          {/* Header chọn Job & Thống kê tổng quan */}
          <div
            style={{
              padding: '0.85rem 1.1rem',
              borderRadius: '0.65rem',
              background: 'color-mix(in srgb, var(--admin-surface-tint, #f8fafc) 70%, var(--admin-surface, #fff))',
              border: '1px solid var(--admin-line, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', maxWidth: '100%', minWidth: 0 }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 650, color: 'var(--admin-muted, #64748b)', flexShrink: 0 }}>
                Phiên cào:
              </span>
              <select
                className="ui-select"
                style={{
                  maxWidth: 'min(36rem, 100%)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.86rem',
                  borderRadius: '0.45rem',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                value={activeJobId}
                onChange={(e) => setSelectedJobId(Number(e.target.value))}
              >
                {jobsList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {jobSummaryLabel(j)}
                  </option>
                ))}
              </select>

              {currentJob && (
                <Badge tone={statusTone(currentJob.status)}>
                  {isCurrentJobRunning ? 'Đang chạy' : statusLabel(currentJob.status)}
                </Badge>
              )}

              {activeRunningCount > 0 && (
                <Badge tone="success">
                  ⚡ {activeRunningCount} worker đang cào song song
                </Badge>
              )}
            </div>

            {((stats?.failed ?? 0) > 0 || (stats?.blocked ?? 0) > 0) && (
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={retryFailedMutation.isPending}
                onClick={() => {
                  if (activeJobId) retryFailedMutation.mutate(activeJobId);
                }}
              >
                <RotateCcw size={13} /> Thử lại tất cả URL lỗi ({ (stats?.failed ?? 0) + (stats?.blocked ?? 0) })
              </Button>
            )}
          </div>

          {/* Bộ lọc Tab Trạng thái & Ô tìm kiếm */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setStatusFilter('all')}
              >
                Tất cả ({stats?.total ?? rawItems.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'done' ? 'primary' : 'ghost'}
                onClick={() => setStatusFilter('done')}
              >
                ✓ Hoàn tất ({stats?.done ?? 0})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'failed' ? 'primary' : 'ghost'}
                onClick={() => setStatusFilter('failed')}
              >
                ✗ Lỗi / Chặn ({ (stats?.failed ?? 0) + (stats?.blocked ?? 0) })
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'queued' ? 'primary' : 'ghost'}
                onClick={() => setStatusFilter('queued')}
              >
                ⏱ Chờ cào ({stats?.queued ?? 0})
              </Button>
            </div>

            <div style={{ minWidth: '15rem' }}>
              <input
                type="text"
                className="ui-input"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.84rem', width: '100%', borderRadius: '0.45rem' }}
                placeholder="Tìm theo tên khách sạn / slug..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Render Danh sách Khách sạn */}
          {items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-muted, #64748b)' }}>
              <p style={{ margin: 0, fontSize: '0.92rem' }}>Không có khách sạn nào khớp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <EntityList>
              {items.map((item) => {
                const isMutatingThis = retryItemMutation.isPending && retryItemMutation.variables?.itemId === item.id;
                const isResettingThis = resetStatusMutation.isPending && resetStatusMutation.variables?.itemId === item.id;
                const isFailedOrBlocked = item.status === 'failed' || item.status === 'blocked';
                const isDone = item.status === 'imported' || item.status === 'ai_done' || item.status === 'done';
                const isQueued = item.status === 'queued';
                
                // Kiểm tra xem worker có đang thực sự cào item này không (kể cả khi đã có slug/tạo trang xong nhưng đang cào tiếp gallery/phòng)
                const isWorkerCrawlingThis = Boolean(activeWorkerItemsMap[String(item.id)]) || item.status === 'fetched' || item.status === 'extracted' || item.status === 'crawling';

                return (
                  <EntityRow key={item.id}>
                    <EntityMain
                      title={hotelLabel(item.source_url)}
                      slug={item.slug_full || item.canonical_url}
                      badges={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {/* 1. Badge trạng thái chính của item */}
                          <Badge tone={statusTone(item.status)}>
                            {statusLabel(item.status)}
                          </Badge>

                          {/* 2. HUY HIỆU WORKER ĐANG CÀO: LUÔN HIỂN THỊ ĐỘC LẬP SONG SONG KHI WORKER ACTIVE */}
                          {isWorkerCrawlingThis && (
                            <Badge tone="primary">
                              <span className="ui-crawler-modal__pulse-dot" style={{ marginRight: 5, background: '#38bdf8' }} />
                              ⚡ Đang cào (Worker active)...
                            </Badge>
                          )}
                        </div>
                      }
                      facts={
                        item.error ? (
                          <span style={{ color: '#ef4444' }}>{item.error}</span>
                        ) : item.slug_full ? (
                          <span>/{item.slug_full}</span>
                        ) : undefined
                      }
                    />
                    <EntityActions>
                      {/* 1. Nếu worker đang trực tiếp cào item này: Nút Đang cào (disabled) */}
                      {isWorkerCrawlingThis ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled
                          style={{ opacity: 0.85, borderColor: '#0284c7', color: '#0369a1' }}
                        >
                          <Zap size={13} className="animate-spin" /> Đang cào dữ liệu...
                        </Button>
                      ) : isDone ? (
                        /* 2. Nếu đã hoàn tất và worker không chạy: Nút Cào lại */
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
                        /* 3. Nếu lỗi / bị chặn: Nút Thử lại màu đỏ */
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
                        /* 4. Nếu đang trong Queue: Nút Đã trong Queue + Hủy Queue */
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled
                            style={{ opacity: 0.8 }}
                          >
                            <Clock size={13} /> Đã trong Queue
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Hủy khỏi hàng đợi chờ cào"
                            disabled={isResettingThis || isMutatingThis}
                            loading={isResettingThis}
                            onClick={() => resetStatusMutation.mutate({ itemId: item.id, status: 'failed' })}
                          >
                            <X size={13} /> Hủy Queue
                          </Button>
                        </>
                      ) : null}

                      {item.slug_full && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const href = previewUrl(item.slug_full, locale, DEFAULT_LOCALE);
                            if (href) window.open(href, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink size={14} /> Xem trang
                        </Button>
                      )}

                      {item.has_extracted && !item.has_ai && !isFailedOrBlocked && !isWorkerCrawlingThis && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await stayCrawlsApi.map(item.id);
                              toast.success('Đã map HTML: ' + hotelLabel(item.source_url));
                              await refresh();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          Map HTML
                        </Button>
                      )}
                    </EntityActions>
                  </EntityRow>
                );
              })}
            </EntityList>
          )}
        </FormSection>
      )}

      {/* Modal Tùy chọn Cào lại cho Khách sạn đã có trang */}
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
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: active
                            ? '1px solid var(--admin-primary-500, #3b82f6)'
                            : '1px solid var(--admin-line, #e2e8f0)',
                          background: active
                            ? 'color-mix(in srgb, var(--admin-primary-500, #3b82f6) 8%, var(--admin-surface, #fff))'
                            : 'var(--admin-surface, #fff)',
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
                          <strong style={{ display: 'block', fontSize: '0.88rem' }}>{opt.label}</strong>
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
          <div className="ui-modal__veil" onClick={() => setShowModal(false)} />
          <div className="ui-crawler-modal" role="document">
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
                    {activeJobId ? `Tiến trình Job #${activeJobId}` : 'Tiến trình cào dữ liệu'}
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
                💡 Bạn có thể <strong>đóng cửa sổ này</strong> hoặc <strong>tải lại trang</strong> bất cứ lúc nào. Tiến trình cào và worker nền Supervisor vẫn tự động xử lý. Nhấn vào nút <em>&quot;Xem Console / Live Log&quot;</em> trên đầu trang để mở lại.
              </p>
              <CrawlerTerminalLog logs={log} running={isCurrentJobRunning} maxHeight="min(52vh, 24rem)" />
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
