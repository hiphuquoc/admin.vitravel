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
  const base = publicPageUrl(slugFull, locale, defaultLocale);
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}preview=1`;
}

type ExistsDetails = {
  count: number;
  items: { source_url: string; status: string; slug_full?: string | null }[];
};

export default function StayCrawlerPage() {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const locale = DEFAULT_LOCALE;
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'hotel' | 'list'>('hotel');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [maxPages, setMaxPages] = useState(1);
  const [useProxy, setUseProxy] = useState(false);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const pendingRerunRef = useRef<'improve' | 'replace' | null>(null);
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

  const runCrawl = async (rerun?: 'improve' | 'replace') => {
    const resolvedRerun = rerun ?? pendingRerunRef.current ?? undefined;
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
    runningRef.current = true;
    setRunning(true);
    setExists(null);
    setLog([]);
    const runList = mode === 'list' && !hotelUrl;
    const rerunLabel =
      resolvedRerun === 'improve'
        ? 'cải thiện (bổ sung / ghi đè phần có dữ liệu)'
        : resolvedRerun === 'replace'
          ? 'xóa sạch rồi cào lại'
          : null;
    appendLog(
      (runList ? `Bắt đầu crawler danh mục: ${listUrl}` : `Bắt đầu crawler 1 chỗ nghỉ: ${listUrl}`) +
        (rerunLabel ? ` — ${rerunLabel}` : ''),
    );

    try {
      appendLog('Đang lấy danh sách chỗ nghỉ…');
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: listUrl,
        html: html.trim() || undefined,
        max_pages: runList ? maxPages : 1,
        use_proxy: useProxy || undefined,
        ...(resolvedRerun ? { rerun: resolvedRerun } : {}),
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
        appendLog(`✓ Đã lưu ${total} URL — xử lý chỗ nghỉ (cào HTML + tạo draft)…`);
      } else {
        appendLog('⚠ Chưa thấy URL trong phản hồi — vẫn xử lý item đã xếp hàng…');
      }

      let guard = 0;
      let networkFails = 0;
      const maxSteps = runList ? 200 : 12;
      while (guard < maxSteps) {
        guard++;
        try {
          const step = await stayCrawlsApi.processNext(jobId, {
            locale,
            html: guard === 1 && html.trim() ? html.trim() : undefined,
            use_proxy: useProxy || undefined,
          });
          networkFails = 0;

          const itemLabel = step.item ? hotelLabel(step.item.source_url) : '?';
          if (step.item?.status === 'blocked') {
            appendLog(`✗ ${itemLabel} — bị chặn (${step.item.blocked_reason || 'unknown'})`);
          } else if (step.item?.status === 'failed') {
            appendLog(`✗ ${itemLabel} — lỗi: ${step.item.error || 'unknown'}`);
          } else if (step.service?.slug_full) {
            appendLog(`✓ ${itemLabel} → /${step.service.slug_full}`);
          } else if (step.item) {
            appendLog(`• ${itemLabel} — ${statusLabel(step.item.status || 'processing')}`);
          }

          if (step.done) {
            if (!step.item && step.imported === 0 && step.blocked === 0 && step.failed === 0) {
              appendLog('⚠ Không xử lý được chỗ nghỉ nào. Thử Cải thiện hoặc Xóa sạch rồi cào lại.');
            } else {
              appendLog(`\n═══ XONG: ${step.imported} trang tạo, ${step.blocked} bị chặn, ${step.failed} lỗi ═══`);
              toast.success(`Đã xong: ${step.imported} trang tạo`);
            }
            break;
          }
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

      await refresh();
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === 'STAY_CRAWL_EXISTS') {
        const details = err.details as ExistsDetails | undefined;
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

  return (
    <div>
      <PageHeader
        eyebrow="Lưu trú"
        title="Crawler Booking.com"
        description="Map HTML Booking.com (không AI) thành draft chỗ nghỉ dưới danh mục đã chọn. Chế độ 1 chỗ nghỉ dùng để test selector."
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
            <Input
              label="Số trang list"
              type="number"
              hint="Chỉ dùng khi cào searchresults (1–5)."
              value={String(maxPages)}
              disabled={running || !canCreate}
              onChange={(e) => setMaxPages(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
            />
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
            ⚠ Chưa cài crawler Chrome. Trên server chạy: <code>cd scripts/stay-crawl && npm ci</code>
          </p>
        ) : null}

        <Button
          type="button"
          disabled={!categoryId || !canCreate || !url.trim() || running || Boolean(exists) || !statusQuery.data?.browser_ready}
          loading={running}
          onClick={() => {
            if (exists) {
              return;
            }
            void runCrawl();
          }}
        >
          {running ? 'Đang chạy…' : 'Bắt đầu crawler'}
        </Button>
      </FormSection>

      {/* Live log */}
      {log.length > 0 && (
        <FormSection icon={RefreshCw} title="Live Log" description={running ? 'Đang chạy…' : 'Hoàn tất'}>
          <pre className="ui-code-block" style={{ maxHeight: '320px', overflow: 'auto', fontSize: '12px', lineHeight: 1.7 }}>
            {log.join('\n')}
          </pre>
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
          <div className="ui-modal__card ui-modal__card--form" style={{ width: 'min(40rem, 100%)' }}>
            <header className="ui-modal__head">
              <p className="ui-modal__eyebrow">Crawler Booking.com</p>
              <h2 className="ui-modal__title">Đang cào…</h2>
              <p className="ui-modal__desc">Giữ trang này mở đến khi xong. Chrome đang lấy HTML rồi map sang draft.</p>
            </header>
            <div className="ui-modal__body">
              <pre className="ui-code-block" style={{ maxHeight: '280px', overflow: 'auto', fontSize: '12px', lineHeight: 1.7, margin: 0 }}>
                {log.join('\n') || 'Khởi chạy…'}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {exists && !running ? (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button type="button" className="ui-modal__veil" aria-label="Đóng" onClick={() => {
            pendingRerunRef.current = null;
            setExists(null);
          }} />
          <div className="ui-modal__card ui-modal__card--form">
            <header className="ui-modal__head">
              <p className="ui-modal__eyebrow">Crawler Booking.com</p>
              <h2 className="ui-modal__title">URL đã cào trước đó</h2>
              <p className="ui-modal__desc">
                {exists.count} chỗ nghỉ đã có trong hệ thống. Chọn cách chạy lại — không bỏ qua im lặng.
              </p>
            </header>
            <div className="ui-modal__body">
              <ul className="ui-field__hint" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {exists.items.slice(0, 8).map((row) => (
                  <li key={row.source_url}>
                    {hotelLabel(row.source_url)}
                    {row.slug_full ? ` — /${row.slug_full}` : ` (${row.status})`}
                  </li>
                ))}
              </ul>
              <p className="ui-field__hint">
                <strong>Cải thiện:</strong> cào lại, điền box còn thiếu; chỗ crawler có dữ liệu thì ghi đè. Giữ FAQ /
                hạng phòng cũ nếu lần này không tách được.
                <br />
                <strong>Xóa sạch:</strong> xóa trang chỗ nghỉ + SEO + hạng phòng + FAQ rồi cào mới, không để bản ghi rác.
              </p>
            </div>
            <footer className="ui-modal__foot">
              <Button type="button" variant="ghost" disabled={running} onClick={() => {
                pendingRerunRef.current = null;
                setExists(null);
              }}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={running}
                loading={running}
                onMouseDown={() => {
                  pendingRerunRef.current = 'improve';
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void runCrawl('improve');
                }}
              >
                Cải thiện
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={running}
                loading={running}
                onMouseDown={() => {
                  pendingRerunRef.current = 'replace';
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void runCrawl('replace');
                }}
              >
                Xóa sạch rồi cào lại
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
