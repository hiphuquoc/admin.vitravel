'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ExternalLink,
  RefreshCw,
  ScanSearch,
} from 'lucide-react';
import toast from '@/lib/toast';
import { ApiClientError } from '@/lib/api';
import { serviceCategoriesApi, stayCrawlsApi, type StayCrawlItem } from '@/lib/services';
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
  if (status === 'extracted' || status === 'fetched' || status === 'crawling') return 'primary';
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
    done: 'Xong',
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
    label: 'Xóa sạch — cào lại hết',
    hint: 'Xóa draft + SEO + hạng phòng, rồi cào mới',
  },
  {
    id: 'basic',
    rerun: 'improve',
    from: 'basic',
    label: 'Cải thiện — từ đầu (property)',
    hint: 'Giữ draft; cào lại property → gallery → phòng',
  },
  {
    id: 'gallery',
    rerun: 'improve',
    from: 'gallery',
    label: 'Cải thiện — gallery + phòng',
    hint: 'Giữ draft; chỉ tải lại ảnh và hạng phòng',
  },
  {
    id: 'rooms',
    rerun: 'improve',
    from: 'rooms',
    label: 'Cải thiện — chỉ phòng',
    hint: 'Rate table + modal phòng (bỏ qua gallery)',
  },
  {
    id: 'rooms_modals',
    rerun: 'improve',
    from: 'rooms_modals',
    label: 'Cải thiện — chỉ modal phòng',
    hint: 'Giữ danh sách hash; scrape lại từng phòng',
  },
];

function existsChoiceLabel(id: ExistsChoiceId): string {
  return EXISTS_CHOICES.find((o) => o.id === id)?.label || id;
}

export default function StayCrawlerPage() {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const locale = DEFAULT_LOCALE;
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'hotel' | 'list'>('hotel');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [running, setRunning] = useState(false);
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
    queryFn: () => stayCrawlsApi.jobs({ service_category_id: categoryId ?? undefined, per_page: 5 }),
    enabled: !!categoryId,
  });

  const latestJobId = jobsQuery.data?.items?.[0]?.id ?? null;
  const jobQuery = useQuery({
    queryKey: ['stay-crawls-job', latestJobId],
    queryFn: () => stayCrawlsApi.job(latestJobId!),
    enabled: !!latestJobId,
    refetchInterval: running ? 3000 : false,
  });

  useEffect(() => {
    if (statusQuery.data?.proxy_enabled_default && statusQuery.data.proxy_configured) {
      setUseProxy(true);
    }
  }, [statusQuery.data]);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-80), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['stay-crawls-jobs', categoryId] });
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
      const total =
        (Array.isArray(started.urls) ? started.urls.length : 0) ||
        Number(started.job?.items_found || 0) ||
        (Array.isArray(started.items) ? started.items.length : 0);
      if (!jobId) {
        appendLog('⚠ Không tạo được job crawler.');
        await refresh();
        return;
      }
      if (total) {
        appendLog(
          runList
            ? `✓ Đã lưu ${total} URL (listing đủ) — đẩy từng URL vào queue…`
            : `✓ Đã lưu ${total} URL — xử lý chỗ nghỉ (cào HTML + publish)…`,
        );
      } else {
        appendLog('⚠ Chưa thấy URL trong phản hồi — vẫn xử lý item đã xếp hàng…');
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
      // Gallery 80 ảnh có thể >5 phút; không đếm poll "busy" vào giới hạn bước.
      // Danh mục + worker: poll chỉ theo dõi — không cắt sớm (có thể chạy nhiều ngày).
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
          if (seq > lastSeq) {
            lastSeq = seq;
            guard++;
            loggedBusy = false;
            busySince = 0;
            const itemLabel = step.item
              ? hotelLabel(step.item.source_url)
              : hotelLabel(String(step.last_step?.source_url || listUrl));
            const status = step.item?.status || step.last_step?.item_status;
            const phase = String(step.phase || step.last_step?.phase || '');
            if (status === 'blocked') {
              appendLog(
                `✗ ${itemLabel} — bị chặn (${step.item?.blocked_reason || step.last_step?.blocked_reason || 'unknown'})`,
              );
            } else if (status === 'failed') {
              appendLog(`✗ ${itemLabel} — lỗi: ${step.item?.error || step.last_step?.error || 'unknown'}`);
            } else if (step.service?.slug_full && phase === 'basic') {
              appendLog(`✓ ${itemLabel} → /${step.service.slug_full}`);
            } else if (step.message || step.last_step?.message) {
              const msg = String(step.message || step.last_step?.message || '');
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
                  ? 'Worker nền đang chạy — có thể đóng tab; poll chỉ theo dõi tiến độ…'
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
          appendLog('Đợi 4 giây rồi thử lại cùng job (không cần bấm thêm)…');
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      if (guard >= maxCompletedSteps || Date.now() - startedAt >= maxWallMs) {
        appendLog(
          workerMode
            ? '⚠ Đã dừng poll UI — worker nền (nếu còn chạy) vẫn tiếp tục. Resume: API work hoặc `php artisan stay-crawl:work ' +
                jobId +
                '`.'
            : '⚠ Hết thời gian chờ poll — nếu gallery đã xong mà thiếu phòng, bấm Cải thiện để chạy tiếp enrich.',
        );
      }

      await refresh();
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === 'STAY_CRAWL_EXISTS') {
        const details = err.details as ExistsDetails | undefined;
        setExistsChoice('basic');
        setExists({
          count: details?.count || 1,
          items: details?.items || [],
        });
        appendLog(`⚠ ${err.message}`);
      } else {
        appendLog(`✗ Crawler thất bại: ${err.message}`);
        toast.error(err.message);
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const items: StayCrawlItem[] = jobQuery.data?.items ?? [];
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
      `Không gọi được /stay-crawls/status: ${(statusQuery.error as Error)?.message || 'lỗi mạng/API'}. Kiểm tra đăng nhập admin + X-Project-Code.`,
    );
  } else if (statusQuery.isLoading || statusQuery.isFetching) {
    crawlBlockHints.push('Đang kiểm tra môi trường Chrome trên server…');
  } else if (browserBlocked) {
    crawlBlockHints.push(
      statusQuery.data?.ready_hint ||
        'Chưa sẵn sàng Chrome/Puppeteer. Trên VPS: cd scripts/stay-crawl && sudo -u www npm ci; đặt STAY_CRAWL_NODE nếu PHP không thấy node.',
    );
  }
  if (!categoryId && categories.length === 0 && !categoriesQuery.isLoading) {
    crawlBlockHints.push('Chưa có danh mục cluster=stay — tạo danh mục lưu trú trước.');
  } else if (!categoryId) {
    crawlBlockHints.push('Chọn danh mục lưu trú.');
  }
  if (!url.trim()) {
    crawlBlockHints.push('Dán URL Booking.com.');
  }
  if (exists) {
    crawlBlockHints.push('URL đã cào — chọn hành động trong hộp thoại (hoặc Hủy).');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Lưu trú"
        title="Crawler Booking.com"
        description="Map HTML Booking.com (không AI) thành chỗ nghỉ published dưới danh mục đã chọn. Chế độ 1 chỗ nghỉ dùng để test selector."
      />

      <FormSection icon={ScanSearch} title="Cấu hình crawler" description="Chọn danh mục, dán URL, cấu hình tùy chọn rồi bấm chạy.">
        <div className="ui-form-grid ui-form-grid--2">
          <Select
            label="Danh mục lưu trú"
            placeholder="— Chọn danh mục —"
            options={categories.map((cat) => ({ value: cat.id, label: cat.name ?? `#${cat.id}` }))}
            value={categoryId ?? ''}
            onChange={(v) => setCategoryId(v ? Number(v) : null)}
            disabled={running}
            searchable
          />
          <Select
            label="Chế độ"
            options={[
              { value: 'hotel', label: '1 chỗ nghỉ (test)' },
              { value: 'list', label: 'Danh mục / list Booking' },
            ]}
            value={mode}
            onChange={(v) => setMode(v === 'list' ? 'list' : 'hotel')}
            disabled={running}
          />
          <Input
            label={mode === 'hotel' ? 'URL chi tiết chỗ nghỉ' : 'URL danh mục Booking.com'}
            placeholder={
              mode === 'hotel'
                ? 'https://www.booking.com/hotel/vn/ten-cho-nghi.html'
                : 'https://www.booking.com/searchresults.html?ss=…'
            }
            value={url}
            disabled={running || !canCreate}
            onChange={(e) => setUrl(e.target.value)}
          />
          {mode === 'list' ? (
            <p className="ui-field__hint">
              Listing tải đủ (Chrome scroll + «Tải thêm kết quả»). Mỗi URL được đẩy vào{' '}
              <strong>Laravel queue</strong> — cần Supervisor <code>queue:work</code> trên server (sống sót
              sau reboot). Có thể đóng tab sau khi xếp hàng.
            </p>
          ) : null}
        </div>

        <Textarea
          label="HTML đã lưu (tuỳ chọn)"
          hint="Dùng khi Chrome bị chặn: Save page as HTML rồi dán nội dung."
          rows={3}
          value={html}
          disabled={running || !canCreate}
          onChange={(e) => setHtml(e.target.value)}
        />

        <Switch
          label="Dùng proxy"
          hint={
            statusQuery.data?.proxy_configured
              ? 'Fetch qua proxy đã cấu hình.'
              : 'Chưa cấu hình proxy trong .env.'
          }
          checked={useProxy}
          onChange={setUseProxy}
          disabled={running || !statusQuery.data?.proxy_configured}
          structure={false}
        />

        {statusQuery.data && !statusQuery.data.browser_ready ? (
          <p className="ui-field__hint" style={{ color: 'var(--admin-warning)' }}>
            ⚠ {statusQuery.data.ready_hint || 'Chưa cài crawler Chrome.'}{' '}
            {statusQuery.data.node_bin ? (
              <>(node: <code>{statusQuery.data.node_bin}</code>)</>
            ) : (
              <>(chưa thấy node — đặt <code>STAY_CRAWL_NODE</code>)</>
            )}{' '}
            Trên server: <code>cd scripts/stay-crawl && sudo -u www npm ci</code> rồi{' '}
            <code>php artisan config:cache</code>.
          </p>
        ) : null}

        {statusQuery.data?.browser_ready && (statusQuery.data.headed || statusQuery.data.headless === false) ? (
          <p className="ui-field__hint">
            Chrome sẽ <strong>mở cửa sổ trên màn hình</strong> để bạn xem thao tác. Mỗi bước crawler mở một cửa sổ rồi đóng.
          </p>
        ) : statusQuery.data?.browser_ready ? (
          <p className="ui-field__hint">
            Chrome đang chạy ẩn (headless)
            {statusQuery.data.chrome_bin ? (
              <>
                {' '}
                — <code>{statusQuery.data.chrome_bin}</code>
              </>
            ) : null}
            . Để xem thao tác, đặt <code>STAY_CRAWL_HEADLESS=false</code> trong .env rồi <code>php artisan config:clear</code>.
          </p>
        ) : null}

        {crawlBlockHints.length > 0 && !running ? (
          <ul className="ui-field__hint" style={{ color: 'var(--admin-warning)', margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
            {crawlBlockHints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : null}

        <Button
          type="button"
          disabled={crawlDisabled || statusQuery.isLoading}
          loading={running}
          onClick={() => {
            if (exists) {
              return;
            }
            if (crawlBlockHints.length && crawlDisabled) {
              toast.error(crawlBlockHints[0]);
              return;
            }
            void runCrawl();
          }}
        >
          {running ? 'Đang chạy…' : browserReady ? 'Bắt đầu crawler' : statusQuery.isLoading ? 'Đang kiểm tra…' : 'Bắt đầu crawler'}
        </Button>
      </FormSection>

      {/* Live log */}
      {log.length > 0 && (
        <FormSection icon={RefreshCw} title="Live Log" description={running ? 'Đang chạy…' : 'Hoàn tất'}>
          <CrawlerTerminalLog logs={log} running={running} maxHeight="24rem" />
        </FormSection>
      )}

      {/* Results */}
      {items.length > 0 && (
        <FormSection icon={Building2} title={`Kết quả (${items.length})`} description="Các chỗ nghỉ đã cào từ job gần nhất.">
          <EntityList>
            {items.map((item) => (
              <EntityRow key={item.id}>
                <EntityMain
                  title={hotelLabel(item.source_url)}
                  slug={item.slug_full || item.canonical_url}
                  badges={<Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>}
                  facts={item.error ? <span>{item.error}</span> : item.slug_full ? <span>/{item.slug_full}</span> : undefined}
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
                      <ExternalLink size={14} /> Preview
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

      {running ? (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <div className="ui-modal__veil" />
          <div className="ui-crawler-modal" role="document">
            <header className="ui-crawler-modal__head">
              <div className="ui-crawler-modal__brand">
                <div className="ui-crawler-modal__icon-box">
                  <RefreshCw size={18} className="animate-spin" />
                </div>
                <div className="ui-crawler-modal__titles">
                  <p className="ui-crawler-modal__eyebrow\">Booking.com Crawler Engine</p>
                  <h2 className="ui-crawler-modal__title\">Tiến trình cào dữ liệu</h2>
                </div>
              </div>
              <div className="ui-crawler-modal__badge">
                <span className="ui-crawler-modal__pulse-dot" />
                <span>Đang xử lý</span>
              </div>
            </header>
            <div className="ui-crawler-modal__body">
              <p className="ui-crawler-modal__hint">
                Hệ thống đang điều khiển Chrome lấy HTML, ảnh gallery & tiện ích phòng. Vui lòng giữ cửa sổ này mở.
              </p>
              <CrawlerTerminalLog logs={log} running={running} maxHeight="min(50vh, 22rem)" />
            </div>
          </div>
        </div>
      ) : null}
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
