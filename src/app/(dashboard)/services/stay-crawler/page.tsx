'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  Play,
  Radio,
  RefreshCw,
  ScanSearch,
  SlidersHorizontal,
  Terminal,
  X,
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
  if (status === 'extracted' || status === 'fetched' || status === 'crawling' || status === 'running' || status === 'processing') return 'primary';
  return 'warning';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'Chờ cào',
    extracted: 'Đã lọc HTML',
    ai_done: 'Đã map HTML',
    imported: 'Đã tạo trang',
    blocked: 'Bị chặn',
    failed: 'Lỗi',
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
    const m = new URL(url).pathname.match(/\/hotel\/[a-z]{2}\/([^/]+)\.html/i);
    return m?.[1]?.replace(/-/g, ' ') || url;
  } catch {
    return url;
  }
}

function previewUrl(slugFull: string | null | undefined, locale: string, defaultLocale: string): string | null {
  return publicPageUrl(slugFull, locale, defaultLocale, { preview: true });
}

type ExistsDetails = {
  count: number;
  items: { source_url: string; status: string; slug_full?: string | null }[];
};

type ImproveFrom = 'basic' | 'gallery' | 'rooms' | 'rooms_modals';
type ExistsChoiceId = 'replace' | ImproveFrom;

const EXISTS_CHOICES: {
  id: ExistsChoiceId;
  rerun: 'improve' | 'replace';
  from?: ImproveFrom;
  label: string;
  hint: string;
}[] = [
  {
    id: 'replace',
    rerun: 'replace',
    label: 'Cào lại từ đầu (thay thế)',
    hint: 'Xóa HTML + ảnh cũ của các URL này rồi cào mới hoàn toàn (như chỗ nghỉ mới).',
  },
  {
    id: 'basic',
    rerun: 'improve',
    from: 'basic',
    label: 'Cải thiện từ đầu (tải lại toàn bộ)',
    hint: 'Tải lại trang Booking, bóc lại tiện ích + phòng, bổ sung ảnh còn thiếu.',
  },
  {
    id: 'gallery',
    rerun: 'improve',
    from: 'gallery',
    label: 'Chỉ cào lại Gallery',
    hint: 'Bỏ qua bước tải trang chính; mở modal gallery tải thêm ảnh khách sạn.',
  },
  {
    id: 'rooms',
    rerun: 'improve',
    from: 'rooms',
    label: 'Chỉ cào lại bảng phòng',
    hint: 'Bỏ qua trang chính + gallery; đọc lại danh sách phòng và tiện ích phòng.',
  },
  {
    id: 'rooms_modals',
    rerun: 'improve',
    from: 'rooms_modals',
    label: 'Chỉ cào modal chi tiết từng phòng',
    hint: 'Mở từng popup phòng để lấy ảnh riêng + diện tích + tiện ích chi tiết.',
  },
];

function existsChoiceLabel(id: ExistsChoiceId): string {
  return EXISTS_CHOICES.find((c) => c.id === id)?.label || id;
}

export default function StayCrawlerPage() {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const locale = DEFAULT_LOCALE;
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [mode, setMode] = useState<'hotel' | 'list'>('hotel');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const runningRef = useRef(false);
  const pendingRerunRef = useRef<'improve' | 'replace' | null>(null);
  const pendingFromRef = useRef<ImproveFrom>('basic');
  const [existsChoice, setExistsChoice] = useState<ExistsChoiceId>('basic');
  const [log, setLog] = useState<string[]>([]);
  const [exists, setExists] = useState<ExistsDetails | null>(null);

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
    queryFn: () => stayCrawlsApi.jobs({ service_category_id: categoryId ?? undefined, per_page: 15 }),
    refetchInterval: running ? 4000 : 10000,
  });

  // Chọn job đang xem: ưu tiên job người dùng bấm chọn, fallback job mới nhất
  const activeJobId = selectedJobId ?? jobsQuery.data?.items?.[0]?.id ?? null;

  const jobQuery = useQuery({
    queryKey: ['stay-crawls-job', activeJobId],
    queryFn: () => stayCrawlsApi.job(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: running ? 3000 : 8000,
  });

  const isCurrentJobRunning =
    running ||
    jobQuery.data?.job?.status === 'running' ||
    jobQuery.data?.job?.status === 'processing' ||
    Boolean(jobQuery.data?.job?.worker_alive);

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

  const runCrawl = async (rerun?: 'improve' | 'replace', from?: ImproveFrom) => {
    const resolvedRerun = rerun ?? pendingRerunRef.current ?? undefined;
    const resolvedFrom =
      resolvedRerun === 'improve'
        ? (from ?? pendingFromRef.current)
        : undefined;
    if (runningRef.current) {
      return;
    }
    if (exists && !resolvedRerun) {
      return;
    }
    if (!categoryId) {
      toast.error('Chọn danh mục lưu trú trước.');
      return;
    }
    const listUrl = url.trim();
    if (!listUrl) {
      toast.error('Dán URL chỗ nghỉ hoặc danh mục Booking.com.');
      return;
    }
    const hotelUrl = isHotelUrl(listUrl);
    if (mode === 'hotel' && !hotelUrl) {
      toast.error('Chế độ 1 chỗ nghỉ cần URL dạng booking.com/hotel/vn/ten.html');
      return;
    }

    pendingRerunRef.current = null;
    pendingFromRef.current = 'basic';
    runningRef.current = true;
    setRunning(true);
    setShowModal(true);
    setExists(null);
    setLog([]);
    const runList = mode === 'list' && !hotelUrl;
    const rerunLabel =
      resolvedRerun === 'improve'
        ? existsChoiceLabel((resolvedFrom || 'basic') as ExistsChoiceId)
        : resolvedRerun === 'replace'
          ? existsChoiceLabel('replace')
          : null;
    appendLog(
      (runList ? `Bắt đầu crawler danh mục: ${listUrl}` : `Bắt đầu crawler 1 chỗ nghỉ: ${listUrl}`) +
        (rerunLabel ? ` — ${rerunLabel}` : ''),
    );

    try {
      appendLog(runList ? 'Đang lấy danh sách chỗ nghỉ…' : 'Đã nhận URL — xếp hàng, Chrome sẽ chạy từng bước…');
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: listUrl,
        html: html.trim() || undefined,
        use_proxy: useProxy || undefined,
        ...(resolvedRerun ? { rerun: resolvedRerun } : {}),
        ...(resolvedRerun === 'improve' && resolvedFrom ? { from: resolvedFrom } : {}),
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
        appendLog('🚀 Đang khởi động Chrome mở danh sách Booking.com ở background (tránh timeout Nginx)…');
      } else if (total) {
        appendLog(
          runList
            ? `✓ Đã lưu ${total} URL — đẩy từng URL vào queue…`
            : `✓ Đã lưu ${total} URL — xử lý chỗ nghỉ (cào HTML + publish)…`,
        );
      } else {
        appendLog('• Bắt đầu dò tìm URL chỗ nghỉ…');
      }
      if (started.worker_hint) {
        appendLog(`• ${started.worker_hint}`);
      }
      if (started.queue_hint) {
        appendLog(`• Worker: ${started.queue_hint}`);
      }
      if (started.job?.list?.urls_queued || started.job?.list?.pages_done) {
        const q = started.job.list.urls_queued ?? total;
        appendLog(
          `• Listing: ${q} URL` +
            (started.job.list.stopped_reason ? ` (dừng: ${started.job.list.stopped_reason})` : ''),
        );
      }

      let guard = 0;
      let networkFails = 0;
      let lastSeq = 0;
      let loggedBusy = false;
      let busySince = 0;
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
            const streamInfo = (step as any).stream;
            const clickInfo = streamInfo?.load_more_clicks ? ` (click tải thêm: ${streamInfo.load_more_clicks})` : '';
            appendLog(`🔍 [Listing] ${msg || 'Đang quét danh sách...'} — đã gom ${urlsCount} URL${clickInfo}`);
            await refresh();
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          if (seq > lastSeq) {
            lastSeq = seq;
            guard++;
            loggedBusy = false;
            busySince = 0;
            const itemLabel = step.item
              ? hotelLabel(step.item.source_url)
              : hotelLabel(String(step.last_step?.source_url || listUrl));
            const status = step.item?.status || step.last_step?.item_status;
            if (status === 'blocked') {
              appendLog(
                `✗ ${itemLabel} — bị chặn (${step.item?.blocked_reason || step.last_step?.blocked_reason || 'unknown'})`,
              );
            } else if (status === 'failed') {
              appendLog(`✗ ${itemLabel} — lỗi: ${step.item?.error || step.last_step?.error || 'unknown'}`);
            } else if (step.service?.slug_full && phase === 'basic') {
              appendLog(`✓ ${itemLabel} → /${step.service.slug_full}`);
            } else if (msg) {
              appendLog(`• ${itemLabel} — ${phase ? `[${phase}] ` : ''}${msg}`);
            }
          }

          if (step.done && !step.busy) {
            if (!step.item && step.imported === 0 && step.blocked === 0 && step.failed === 0) {
              appendLog('⚠ Không xử lý được chỗ nghỉ nào. Thử Cải thiện hoặc Xóa sạch rồi cào lại.');
            } else {
              appendLog(`\n═══ XONG: ${step.imported} trang tạo, ${step.blocked} bị chặn, ${step.failed} lỗi ═══`);
              toast.success(`Đã xong: ${step.imported} trang tạo`);
            }
            break;
          }

          if (step.busy) {
            if (!busySince) {
              busySince = Date.now();
            }
            const waitedSec = Math.round((Date.now() - busySince) / 1000);
            const msg = String(step.message || '');
            const isWorker = /worker/i.test(msg) || Boolean(step.job?.worker_alive);
            if (!loggedBusy) {
              appendLog(
                isWorker
                  ? 'Worker nền đang chạy — có thể đóng modal hoặc tab này bất cứ lúc nào; hệ thống vẫn tự động xử lý.'
                  : 'Chrome đang chạy nền (gallery/phòng có thể 2–8 phút/bước)…',
              );
              loggedBusy = true;
            } else if (waitedSec > 0 && waitedSec % 60 < 5) {
              const rem = step.remaining ?? step.job?.worker?.remaining;
              appendLog(
                isWorker
                  ? `… worker còn ~${rem ?? '?'} bước (${waitedSec}s) — log: storage/logs/stay-crawl-work-${jobId}.log`
                  : `… vẫn chạy nền (${waitedSec}s) — đợi gallery/phòng`,
              );
            }
            await new Promise((r) => setTimeout(r, isWorker ? 5000 : 2500));
            continue;
          }

          busySince = 0;
          await new Promise((r) => setTimeout(r, 400));
        } catch (e) {
          const err = e as ApiClientError;
          networkFails++;
          appendLog(`✗ Lỗi xử lý (${networkFails}): ${err.message}`);
          if (networkFails >= 4) {
            break;
          }
          appendLog('Đợi 4 giây rồi thử lại cùng job (không cần bấm lại)…');
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      await refresh();
    } catch (e) {
      const err = e as any;
      if (err?.data && typeof err.data === 'object' && 'exists' in err.data) {
        const d = err.data as { exists: ExistsDetails };
        setExists(d.exists);
        setExistsChoice('basic');
      } else {
        appendLog(`✗ Lỗi khởi động: ${err.message || 'Không xác định'}`);
        toast.error(err.message || 'Lỗi khởi động crawler');
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const currentJob = jobQuery.data?.job;
  const items: StayCrawlItem[] = jobQuery.data?.items ?? [];
  const jobsList: StayCrawlJob[] = jobsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];
  const browserReady = statusQuery.data?.browser_ready === true;
  const browserBlocked = statusQuery.data?.browser_ready === false;
  const crawlDisabled =
    !categoryId || !canCreate || !url.trim() || running || Boolean(exists) || browserBlocked;
  const crawlBlockHints: string[] = [];
  if (!canCreate) {
    crawlBlockHints.push('Tài khoản thiếu quyền services.create — không thể chạy crawler.');
  }
  if (statusQuery.isError) {
    crawlBlockHints.push(
      `Không gọi được /stay-crawls/status: ${(statusQuery.error as Error)?.message || 'lỗi mạng/API'}. Kiểm tra đăng nhập admin + X-Project / CORS.`,
    );
  }
  if (browserBlocked) {
    crawlBlockHints.push(
      `Crawler Chrome chưa sẵn sàng (${statusQuery.data?.ready_hint || 'thiếu node/chrome hoặc scripts'}). Kiểm tra cấu hình .env trên VPS (STAY_CRAWL_NODE, STAY_CRAWL_CHROME).`,
    );
  }

  return (
    <div className="crawler-page-container">
      <PageHeader
        eyebrow="Lưu trú"
        title="Crawler Booking.com"
        description="Nhập link khách sạn hoặc danh mục Booking.com để cào tự động thông tin, hình ảnh độ nét cao và tiện ích phòng vào hệ thống."
        actions={
          <div className="flex items-center gap-2">
            {jobsList.length > 0 && (
              <Button
                type="button"
                variant={showModal ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setShowModal(true);
                }}
              >
                <Terminal size={14} />
                <span>Xem Console / Live Log</span>
                {isCurrentJobRunning && <span className="ui-crawler-modal__pulse-dot" style={{ marginLeft: 4 }} />}
              </Button>
            )}
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

      {/* Bar thông báo nổi khi Modal bị đóng lúc tiến trình đang chạy */}
      {isCurrentJobRunning && !showModal && (
        <div
          style={{
            position: 'sticky',
            top: '4.25rem',
            zIndex: 40,
            marginBottom: '1rem',
            padding: '0.75rem 1.2rem',
            borderRadius: 'var(--admin-radius-lg, 0.75rem)',
            background: 'linear-gradient(135deg, #132213 0%, #1e331b 100%)',
            border: '1px solid rgba(107, 143, 63, 0.45)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="ui-crawler-modal__pulse-dot" />
            <div>
              <p style={{ margin: 0, fontWeight: 650, fontSize: '0.9rem', color: '#86efac' }}>
                Tiến trình Crawler (Job #{activeJobId || '...'}) đang chạy ngầm
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1' }}>
                {log[log.length - 1] || 'Đang phân tích và xử lý các trang con...'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowModal(true);
              }}
            >
              <Maximize2 size={13} /> Mở Live Modal
            </Button>
          </div>
        </div>
      )}

      {/* Main Config Form */}
      <FormSection
        icon={ScanSearch}
        title="Khởi tạo Crawler"
        description="Chọn danh mục đích và dán đường link Booking.com để bắt đầu."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
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
          label="Dán mã nguồn HTML (Tuỳ chọn - Dự phòng khi bị Captcha/Cloudflare chặn)"
          hint="Mở link trên trình duyệt máy tính cá nhân -> Lưu trang / Save As HTML -> Dán nội dung vào đây."
          rows={3}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
          <Switch
            label="Kích hoạt Proxy Residential"
            hint={
              statusQuery.data?.proxy_configured
                ? 'Sử dụng cụm proxy cấu hình trong STAY_CRAWL_PROXY_*'
                : 'Chưa thiết lập biến STAY_CRAWL_PROXY_* trong .env'
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

        {crawlBlockHints.length > 0 && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem' }}>
            {crawlBlockHints.map((h, idx) => (
              <p key={idx} style={{ margin: '0.2rem 0' }}>⚠ {h}</p>
            ))}
          </div>
        )}
      </FormSection>

      {/* Jobs History Bar & Current Active Job Detail */}
      {jobsList.length > 0 && (
        <FormSection
          icon={Layers}
          title="Lịch sử các phiên Crawler (Jobs)"
          description="Chọn một phiên để xem chi tiết tiến độ, danh sách khách sạn và mở lại console log thời gian thực."
        >
          <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }} className="vt-scrollbar">
            {jobsList.map((job) => {
              const isSelected = job.id === activeJobId;
              const isJobRunning = job.status === 'running' || job.status === 'processing' || Boolean(job.worker_alive);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '0.6rem',
                    minWidth: '13.5rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected
                      ? '2px solid var(--admin-primary-500, #3b82f6)'
                      : '1px solid var(--admin-line, #e2e8f0)',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--admin-primary-500, #3b82f6) 8%, var(--admin-surface, #fff))'
                      : 'var(--admin-surface, #fff)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Job #{job.id}</span>
                    <Badge tone={statusTone(job.status)}>
                      {isJobRunning ? 'Đang chạy' : statusLabel(job.status)}
                    </Badge>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--admin-muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '12rem' }}>
                    {hotelLabel(job.list_url || '')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.72rem', color: 'var(--admin-muted, #64748b)', marginTop: '0.2rem' }}>
                    <span>{job.items_found || job.items_count || 0} mục</span>
                    <span>{job.created_at ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chi tiết Job đang chọn */}
          {currentJob && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem 1.25rem',
                borderRadius: '0.65rem',
                background: 'color-mix(in srgb, var(--admin-surface-tint, #f8fafc) 60%, var(--admin-surface, #fff))',
                border: '1px solid var(--admin-line, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                    Chi tiết Phiên #{currentJob.id}
                  </h4>
                  <Badge tone={statusTone(currentJob.status)}>
                    {statusLabel(currentJob.status)}
                  </Badge>
                  {isCurrentJobRunning && (
                    <span className="ui-crawler-modal__badge" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                      <span className="ui-crawler-modal__pulse-dot" /> Live Worker
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--admin-muted, #64748b)' }}>
                  URL nguồn: <a href={currentJob.list_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{currentJob.list_url}</a>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowModal(true);
                  }}
                >
                  <Terminal size={14} /> Mở Terminal Log
                </Button>
              </div>
            </div>
          )}
        </FormSection>
      )}

      {/* Results List */}
      {items.length > 0 && (
        <FormSection
          icon={Building2}
          title={`Danh sách khách sạn (${items.length})`}
          description="Các khách sạn được bóc tách trong phiên crawl này. Trạng thái được cập nhật thời gian thực."
        >
          <EntityList>
            {items.map((item) => (
              <EntityRow key={item.id}>
                <EntityMain
                  title={hotelLabel(item.source_url)}
                  slug={item.slug_full || item.canonical_url}
                  badges={<Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>}
                  facts={
                    item.error ? (
                      <span style={{ color: '#ef4444' }}>{item.error}</span>
                    ) : item.slug_full ? (
                      <span>/{item.slug_full}</span>
                    ) : undefined
                  }
                />
                <EntityActions>
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
                  {item.has_extracted && !item.has_ai && item.status !== 'blocked' && item.status !== 'failed' && (
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
            ))}
          </EntityList>
        </FormSection>
      )}

      {/* Modal Live Crawler & Terminal Log */}
      {showModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div
            className="ui-modal__veil"
            onClick={() => {
              setShowModal(false);
            }}
          />
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
                  title="Đóng cửa sổ theo dõi (Tiến trình nền vẫn tiếp tục chạy)"
                  onClick={() => {
                    setShowModal(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="ui-crawler-modal__body">
              <p className="ui-crawler-modal__hint">
                💡 Bạn có thể <strong>đóng cửa sổ này</strong> hoặc <strong>tải lại trang</strong> bất cứ lúc nào. Tiến trình cào và worker nền vẫn tự động hoàn tất. Nhấn vào nút <em>&quot;Xem Console / Live Log&quot;</em> trên đầu trang để mở lại.
              </p>
              <CrawlerTerminalLog logs={log} running={isCurrentJobRunning} maxHeight="min(52vh, 24rem)" />
            </div>
            <footer className="ui-crawler-modal__foot">
              <span style={{ fontSize: '0.78rem', color: 'var(--admin-muted, #64748b)' }}>
                {log.length > 0 ? `Đã ghi nhận ${log.length} dòng sự kiện` : 'Chờ sự kiện tiếp theo từ engine...'}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                }}
              >
                Đóng cửa sổ theo dõi
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Rerun / Conflict Dialog */}
      {exists && !running ? (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button
            type="button"
            className="ui-modal__veil"
            aria-label="Đóng"
            onClick={() => {
              pendingRerunRef.current = null;
              setExistsChoice('basic');
              setExists(null);
            }}
          />
          <div className="ui-modal__card ui-modal__card--form" style={{ width: 'min(28rem, 100%)' }}>
            <header className="ui-modal__head">
              <h2 className="ui-modal__title">URL đã cào</h2>
              <p className="ui-modal__desc" style={{ marginBottom: 0 }}>
                {exists.items[0]
                  ? hotelLabel(exists.items[0].source_url)
                  : `${exists.count} chỗ nghỉ`}
                {exists.count > 1 ? ` (+${exists.count - 1})` : ''}
              </p>
            </header>
            <div className="ui-modal__body" style={{ paddingTop: '0.75rem' }}>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="ui-field__label" style={{ marginBottom: '0.5rem' }}>
                  Chọn hành động
                </legend>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  {EXISTS_CHOICES.map((opt) => {
                    const active = existsChoice === opt.id;
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: 'flex',
                          gap: '0.55rem',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          padding: '0.5rem 0.6rem',
                          borderRadius: '0.45rem',
                          border: active
                            ? '1px solid var(--color-accent, #3b82f6)'
                            : '1px solid var(--color-line, #e5e5e5)',
                          background: active
                            ? 'color-mix(in srgb, var(--color-accent, #3b82f6) 8%, transparent)'
                            : undefined,
                        }}
                      >
                        <input
                          type="radio"
                          name="exists-choice"
                          value={opt.id}
                          checked={active}
                          onChange={() => setExistsChoice(opt.id)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <span>
                          <strong style={{ display: 'block', fontSize: '0.9rem' }}>{opt.label}</strong>
                          <span className="ui-field__hint" style={{ display: 'block', marginTop: '0.1rem' }}>
                            {opt.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <footer className="ui-modal__foot">
              <Button
                type="button"
                variant="ghost"
                disabled={running}
                onClick={() => {
                  pendingRerunRef.current = null;
                  setExistsChoice('basic');
                  setExists(null);
                }}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant={existsChoice === 'replace' ? 'danger' : 'primary'}
                disabled={running}
                loading={running}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const chosen = EXISTS_CHOICES.find((o) => o.id === existsChoice) || EXISTS_CHOICES[1];
                  pendingRerunRef.current = chosen.rerun;
                  if (chosen.rerun === 'improve' && chosen.from) {
                    pendingFromRef.current = chosen.from;
                    void runCrawl('improve', chosen.from);
                  } else {
                    void runCrawl('replace');
                  }
                }}
              >
                Xác nhận
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
