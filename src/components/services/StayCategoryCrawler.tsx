'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react';
import toast from '@/lib/toast';
import { ApiClientError } from '@/lib/api';
import { stayCrawlsApi, type StayCrawlItem } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Switch } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Page';
import { EntityList, EntityMain, EntityRow, EntityActions } from '@/components/ui/EntityList';
import { FormSection } from '@/components/ui/FormSection';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';
import { publicPageUrl } from '@/lib/publicUrl';

function isCrawlableCluster(cluster: string): boolean {
  return cluster === 'stay' || cluster === 'experience';
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'imported' || status === 'ai_done' || status === 'done' || status === 'ready') {
    return 'success';
  }
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
    const path = new URL(url).pathname;
    const m = path.match(/\/hotel\/[a-z]{2}\/([^/]+)\.html/i);
    return m?.[1]?.replace(/-/g, ' ') || url;
  } catch {
    return url;
  }
}

export function StayCategoryCrawler({
  categoryId,
  cluster,
  locale,
  defaultLocale,
  categorySlugFull,
  categoryName,
}: {
  categoryId: number | null;
  cluster: string;
  locale: string;
  defaultLocale: string;
  categorySlugFull?: string | null;
  categoryName?: string;
}) {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const router = useAppRouter();
  const qc = useQueryClient();
  const progress = useBlockingProgress();

  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['stay-crawls-status'],
    queryFn: () => stayCrawlsApi.status(),
    enabled: isCrawlableCluster(cluster),
  });

  const jobsQuery = useQuery({
    queryKey: ['stay-crawls-jobs', categoryId],
    queryFn: () => stayCrawlsApi.jobs({ service_category_id: categoryId!, per_page: 8 }),
    enabled: !!categoryId && isCrawlableCluster(cluster),
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
  });

  const latestJobId = jobsQuery.data?.items?.[0]?.id ?? null;
  const jobQuery = useQuery({
    queryKey: ['stay-crawls-job', latestJobId],
    queryFn: () => stayCrawlsApi.job(latestJobId!),
    enabled: !!latestJobId,
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
  });

  useEffect(() => {
    if (statusQuery.data?.proxy_enabled_default && statusQuery.data.proxy_configured) {
      setUseProxy(true);
    }
  }, [statusQuery.data]);

  if (!isCrawlableCluster(cluster)) return null;

  const items = jobQuery.data?.items ?? [];
  const parentPath = categorySlugFull?.replace(/\/$/, '') || '';

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['stay-crawls-jobs', categoryId] });
    await qc.invalidateQueries({ queryKey: ['stay-crawls-job'] });
    await qc.invalidateQueries({ queryKey: ['service-categories-stay'] });
  };

  const run = async () => {
    if (!categoryId) {
      toast.error('Lưu danh mục trước, rồi mới cào chỗ nghỉ con.');
      return;
    }
    const listUrl = url.trim();
    if (!listUrl) {
      toast.error('Dán URL danh mục hoặc chỗ nghỉ Booking.com.');
      return;
    }

    progress.show({
      title: 'Crawler lưu trú',
      subtitle: categoryName || 'Danh mục',
      detail: 'Đang lấy danh sách chỗ nghỉ từ Booking.com…',
      indeterminate: true,
      percent: 6,
    });

    try {
      const hotelDump = isHotelUrl(listUrl);
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: listUrl,
        html: html.trim() || undefined,
        use_proxy: useProxy || undefined,
      });
      const total = started.urls?.length || started.job?.items_found || 0;
      if (!total && !started.is_listing_async && started.job?.status !== 'crawling') {
        await progress.fail({
          title: 'Kh?ng th?y ch? ngh?',
          detail: started.job?.error || 'D?n HTML ?? l?u n?u Booking ch?n fetch.',
          holdMs: 2200,
        });
        await refresh();
        return;
      }

      progress.update({
        indeterminate: false,
        percent: 8,
        detail: started.is_listing_async
          ? 'Đang mở Chrome quét danh sách chỗ nghỉ Booking.com…'
          : (started.worker_hint
              ? `${started.worker_hint} — `
              : '') + `Đã lưu ${total} URL — tạo trang con dưới ${parentPath || 'danh mục này'}…`,
      });

      let htmlOnce = hotelDump ? html.trim() || undefined : undefined;
      let guard = 0;
      const maxGuard = hotelDump ? 200 : 50_000;
      while (guard < maxGuard) {
        guard += 1;
        const step = await stayCrawlsApi.processNext(started.job.id, {
          locale,
          html: htmlOnce,
          use_proxy: useProxy || undefined,
        });
        htmlOnce = undefined;
        const phase = String(step.phase || step.last_step?.phase || '');
        const msg = String(step.message || step.last_step?.message || '');
        const isListing = phase === 'listing';

        if (isListing) {
          const count = step.urls_found || step.total || 0;
          progress.update({
            percent: Math.min(30, 8 + Math.round(count * 0.5)),
            detail: `[Danh sách] ${msg || 'Đang cào URL...'} (đã gom ${count} chỗ nghỉ)`,
          });
          await refresh();
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const doneCount = step.imported + step.blocked + step.failed;
        const pct = step.total ? Math.min(96, Math.round((doneCount / step.total) * 100)) : 50;
        const label = step.item ? hotelLabel(step.item.source_url) : 'chỗ nghỉ';
        const isWorker = /worker/i.test(msg) || Boolean(step.job?.worker_alive);
        progress.update({
          percent: pct,
          detail: step.busy
            ? isWorker
              ? `Worker nền còn ~${step.remaining} bước — có thể đóng tab`
              : `Chrome đang chạy (${phase || '…'}) — gallery/phòng có thể vài phút`
            : msg
              ? `${phase ? `[${phase}] ` : ''}${msg}`
              : step.service?.slug_full
                ? `Đã tạo ${step.service.slug_full} (${step.imported}/${step.total})`
                : `Đang xử lý ${label} — ${step.imported}/${step.total} trang con`,
        });
        if (step.done && !step.busy) {
          const extra = [
            step.blocked ? `${step.blocked} bị chặn` : '',
            step.failed ? `${step.failed} lỗi` : '',
          ]
            .filter(Boolean)
            .join(', ');
          await progress.success({
            title: `Đã tạo ${step.imported} trang con`,
            detail: extra
              ? `${extra}. Trang draft kế thừa URL và cấp trang từ danh mục này.`
              : 'Draft kế thừa slug_full và cấp trang từ danh mục này. Duyệt rồi publish.',
            holdMs: 1400,
          });
          break;
        }
        if (step.busy) {
          await new Promise((r) => setTimeout(r, isWorker ? 5000 : 2500));
          continue;
        }
        if (!step.item && !step.done) {
          await progress.fail({ title: 'Dừng crawler', detail: 'Không còn item để xử lý.', holdMs: 1600 });
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      await refresh();
    } catch (e) {
      const err = e as ApiClientError;
      await progress.fail({
        title: 'Crawler thất bại',
        detail: err.message || 'Không chạy được crawler.',
        holdMs: 2200,
      });
      await refresh();
    }
  };

  return (
    <FormSection
      icon={ScanSearch}
      title="Crawler Booking.com"
      description={
        categoryId
          ? `Chrome mở Booking như trình duyệt. Bật proxy nếu IP bị chặn. Trang con kế thừa ${
              parentPath || 'danh mục này'
            }.`
          : 'Lưu danh mục trước để lấy ID trang cha, rồi mới khởi chạy crawler.'
      }
    >
      <Input
        label="URL danh mục / chỗ nghỉ Booking.com"
        placeholder="https://www.booking.com/searchresults.html?ss=…"
        value={url}
        disabled={!categoryId || !canCreate}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void run();
          }
        }}
      />
      <p className="body-text" style={{ opacity: 0.85 }}>
        Listing tải đủ (scroll + «Tải thêm»). Từng URL vào Laravel queue — cần{' '}
        <code>queue:work</code> / Supervisor trên VPS.
      </p>
      <Textarea
        label="HTML đã lưu (tuỳ chọn)"
        hint="Chỉ cần khi Chrome vẫn bị chặn: Save page as HTML rồi dán."
        rows={4}
        value={html}
        disabled={!categoryId || !canCreate}
        onChange={(e) => setHtml(e.target.value)}
      />
      <Switch
        label="Dùng proxy"
        hint={
          statusQuery.data?.proxy_configured
            ? 'Fetch qua STAY_CRAWL_PROXY_* (giống crawler doanh nghiệp).'
            : 'Chưa cấu hình STAY_CRAWL_PROXY_HOST / PORT trong .env Laravel.'
        }
        checked={useProxy}
        onChange={setUseProxy}
        disabled={!categoryId || !canCreate || !statusQuery.data?.proxy_configured}
        structure={false}
      />
      {statusQuery.data && !statusQuery.data.browser_ready ? (
        <p className="body-text" style={{ color: 'var(--admin-warning)' }}>
          ⚠ {statusQuery.data.ready_hint || 'Chưa cài crawler Chrome.'} Trên server:{' '}
          <code>cd scripts/stay-crawl && sudo -u www npm ci</code>
          {!statusQuery.data.node_bin ? (
            <>
              {' '}
              + đặt <code>STAY_CRAWL_NODE</code> trong .env
            </>
          ) : null}
        </p>
      ) : null}
      {!canCreate ? (
        <p className="body-text" style={{ color: 'var(--admin-warning)' }}>
          ⚠ Thiếu quyền <code>services.create</code> — nút crawler bị khóa.
        </p>
      ) : null}
      <Button
        type="button"
        disabled={
          !categoryId ||
          !canCreate ||
          !url.trim() ||
          progress.state.open ||
          statusQuery.data?.browser_ready === false
        }
        loading={progress.state.open}
        onClick={() => void run()}
      >
        Cào và tạo trang con
      </Button>

      {items.length > 0 ? (
        <EntityList>
          {items.map((item: StayCrawlItem) => (
            <EntityRow key={item.id}>
              <EntityMain
                title={hotelLabel(item.source_url)}
                slug={item.slug_full || item.canonical_url}
                publicHref={
                  item.slug_full
                    ? publicPageUrl(item.slug_full, locale, defaultLocale, { preview: true })
                    : item.source_url
                }
                badges={<Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>}
                facts={
                  item.error ? (
                    <span>{item.error}</span>
                  ) : item.slug_full ? (
                    <span>{item.slug_full}</span>
                  ) : undefined
                }
              />
              <EntityActions>
                {item.service_id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      router.push(`/services/products/form/?id=${item.service_id}&cluster=${item.service_cluster || cluster || 'stay'}`)
                    }
                  >
                    Mở draft
                  </Button>
                ) : null}
                {item.slug_full ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const href = publicPageUrl(item.slug_full, locale, defaultLocale, {
                        preview: true,
                      });
                      if (href) window.open(href, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Xem URL
                  </Button>
                ) : null}
              </EntityActions>
            </EntityRow>
          ))}
        </EntityList>
      ) : null}
    </FormSection>
  );
}
