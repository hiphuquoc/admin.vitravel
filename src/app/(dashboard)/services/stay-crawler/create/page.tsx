'use client';

import { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ScanSearch,
  Sparkles,
  Play,
  ArrowLeft,
  RefreshCw,
  X,
} from 'lucide-react';
import toast from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';

import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { CrawlerTerminalLog } from '@/components/services/CrawlerTerminalLog';
import { stayCrawlsApi, serviceCategoriesApi } from '@/lib/services';

function isHotelUrl(targetUrl: string): boolean {
  return /booking\.com\/hotel\/[a-z0-9_-]+\/[a-z0-9_-]+/i.test(targetUrl) ||
    /booking\.com\/[a-z]{2}(?:-[a-z]{2})?\/hotel\/[a-z0-9_-]+\/[a-z0-9_-]+/i.test(targetUrl);
}

function CreateCrawlerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCategoryId = searchParams.get('category_id');

  const { can } = useAuth();
  const canCreate = can('services.create');

  const [categoryId, setCategoryId] = useState<number | null>(
    paramCategoryId ? Number(paramCategoryId) : null,
  );
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [mode, setMode] = useState<'hotel' | 'list'>('list');

  const [loading, setLoading] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const runningRef = useRef(false);

  const statusQuery = useQuery({
    queryKey: ['stay-crawls-status'],
    queryFn: () => stayCrawlsApi.status(),
  });

  const stayCatsQuery = useQuery({
    queryKey: ['crawl-categories-stay'],
    queryFn: () => serviceCategoriesApi.list({ cluster: 'stay', per_page: 100 }),
  });
  const experienceCatsQuery = useQuery({
    queryKey: ['crawl-categories-experience'],
    queryFn: () => serviceCategoriesApi.list({ cluster: 'experience', per_page: 100 }),
  });

  useEffect(() => {
    if (statusQuery.data?.proxy_enabled_default && statusQuery.data.proxy_configured) {
      setUseProxy(true);
    }
  }, [statusQuery.data]);

  useEffect(() => {
    if (paramCategoryId && !categoryId) {
      setCategoryId(Number(paramCategoryId));
    }
  }, [paramCategoryId, categoryId]);

  const categories = useMemo(() => {
    const stay = (stayCatsQuery.data?.items ?? []).map((c) => ({ ...c, clusterLabel: 'Lưu trú' as const }));
    const exp = (experienceCatsQuery.data?.items ?? []).map((c) => ({ ...c, clusterLabel: 'Trải nghiệm' as const }));
    return [...stay, ...exp];
  }, [stayCatsQuery.data?.items, experienceCatsQuery.data?.items]);

  const handleStartCrawl = async () => {
    if (runningRef.current) return;
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục đích (lưu trú hoặc trải nghiệm/du thuyền).');
      return;
    }
    const targetUrl = url.trim();
    if (!targetUrl) {
      toast.error('Vui lòng nhập URL Booking.com.');
      return;
    }

    const hotelUrl = isHotelUrl(targetUrl);
    if (mode === 'hotel' && !hotelUrl) {
      toast.error('Chế độ 1 chỗ nghỉ cần URL dạng: booking.com/hotel/vn/ten-khach-san.html');
      return;
    }

    runningRef.current = true;
    setLoading(true);
    setShowLiveModal(true);

    const nowStr = () => new Date().toLocaleTimeString('vi-VN');
    const selectedCat = categories.find((c) => c.id === categoryId);
    const catName = selectedCat?.name || `#${categoryId}`;

    setLiveLogs([
      `[${nowStr()}] • Bắt đầu khởi tạo phiên cào dữ liệu Booking.com...`,
      `[${nowStr()}] • Danh mục đích: ${catName}`,
      `[${nowStr()}] • URL nguồn: ${targetUrl}`,
      `[${nowStr()}] • Chế độ: ${mode === 'hotel' ? '1 Khách sạn (Single Hotel)' : 'Quét danh mục (Listing Crawl)'}`,
      useProxy ? `[${nowStr()}] • Đã bật Proxy Residential chống chặn IP` : `[${nowStr()}] • Sử dụng kết nối mạng trực tiếp`,
      `[${nowStr()}] • Đang kết nối Chrome Crawler Engine & mở trang...`,
    ]);

    const progressTimer = setInterval(() => {
      setLiveLogs((prev) => {
        if (prev.length < 15) {
          return [
            ...prev,
            `[${nowStr()}] • Đang tải dữ liệu và bóc tách các liên kết khách sạn...`,
          ];
        }
        return prev;
      });
    }, 3500);

    try {
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: targetUrl,
        html: html.trim() || undefined,
        use_proxy: useProxy || undefined,
      });

      clearInterval(progressTimer);

      const jobId = started.job?.id;
      if (!jobId) {
        setLiveLogs((prev) => [
          ...prev,
          `[${nowStr()}] ✗ Không nhận được ID Job hợp lệ từ server.`,
        ]);
        toast.error('Không khởi tạo được job crawler từ server.');
        setLoading(false);
        runningRef.current = false;
        return;
      }

      const count = started.urls?.length || started.job?.items_found || 0;
      setLiveLogs((prev) => [
        ...prev,
        `[${nowStr()}] ✓ Khởi tạo Job #${jobId} thành công!`,
        mode === 'hotel'
          ? `[${nowStr()}] ✓ Đã khởi tạo chỗ nghỉ từ Booking.com`
          : count > 0
            ? `[${nowStr()}] ✓ Đã tìm thấy ${count} chỗ nghỉ từ Booking.com`
            : `[${nowStr()}] ✓ Đã khởi chạy tiến trình quét danh mục ở background`,
        `[${nowStr()}] ➜ Đang tự động chuyển hướng đến bảng quản lý chi tiết...`,
      ]);

      toast.success(`Đã khởi tạo Job #${jobId} thành công!`);
      setTimeout(() => {
        router.push(`/services/stay-crawler/detail/?id=${jobId}&live=true`);
      }, 1200);
    } catch (e: any) {
      clearInterval(progressTimer);
      setLoading(false);
      runningRef.current = false;
      const errMsg = e?.message || 'Khởi chạy crawler thất bại.';
      setLiveLogs((prev) => [
        ...prev,
        `[${nowStr()}] ✗ Lỗi: ${errMsg}`,
      ]);
      toast.error(errMsg);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '54rem', margin: '0 auto', paddingBottom: '3rem' }}>
      <PageHeader
        eyebrow="Crawler Booking.com"
        title="Khởi tạo phiên Crawler mới"
        description="Nhập liên kết danh mục hoặc chỗ nghỉ Booking.com để hệ thống tự động bóc tách dữ liệu và đồng bộ vào website."
        actions={
          <Link href="/services/stay-crawler/">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} /> Danh sách Job
            </Button>
          </Link>
        }
      />

      <FormSection
        icon={ScanSearch}
        title="Thông tin cấu hình Crawler"
        description="Chọn danh mục đích trên hệ thống của bạn và nhập liên kết nguồn từ Booking.com."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <Select
            label="Danh mục đích (lưu trú / trải nghiệm)"
            required
            placeholder="— Chọn danh mục đích —"
            options={categories.map((c) => ({
              value: String(c.id),
              label: c.name
                ? `[${c.clusterLabel}] ${c.name} (ID: ${c.id})`
                : `[${c.clusterLabel}] #${c.id}`,
            }))}
            value={categoryId ? String(categoryId) : ''}
            onChange={(val) => setCategoryId(val ? Number(val) : null)}
          />

          <Select
            label="Chế độ cào dữ liệu"
            options={[
              { value: 'list', label: 'Cào theo Danh mục / Tìm kiếm (Search Listing)' },
              { value: 'hotel', label: '1 Khách sạn cụ thể (Single Hotel)' },
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
          label="Dán mã nguồn HTML (Tuỳ chọn — Dự phòng khi bị Captcha chặn)"
          hint="Mở link trên trình duyệt của bạn ➜ Nhấn Ctrl+S / Lưu trang HTML ➜ Dán toàn bộ mã nguồn vào đây để bypass."
          rows={3}
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
            padding: '1rem 1.25rem',
            borderRadius: 'var(--admin-radius-lg)',
            background: 'var(--admin-surface-tint)',
            border: '1px solid var(--admin-line)',
          }}
        >
          <Switch
            label="Kích hoạt Proxy Residential"
            hint={
              statusQuery.data?.proxy_configured
                ? 'Sử dụng cụm proxy IP dân cư xoay vòng chống chặn bot'
                : 'Chưa cấu hình thông số STAY_CRAWL_PROXY_* trong .env'
            }
            checked={useProxy}
            onChange={setUseProxy}
            disabled={!statusQuery.data?.proxy_configured}
          />

          <Button
            type="button"
            variant="primary"
            disabled={!canCreate || !url.trim() || !categoryId}
            loading={loading}
            onClick={() => void handleStartCrawl()}
          >
            <Play size={16} /> Bắt đầu cào dữ liệu
          </Button>
        </div>
      </FormSection>

      <div
        style={{
          padding: '1.25rem',
          borderRadius: 'var(--admin-radius-xl)',
          background: 'color-mix(in srgb, var(--admin-primary-500) 8%, var(--admin-surface))',
          border: '1px solid color-mix(in srgb, var(--admin-primary-500) 22%, transparent)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <Sparkles size={22} style={{ color: 'var(--admin-primary-500)', flexShrink: 0, marginTop: '0.15rem' }} />
        <div style={{ fontSize: '0.86rem', lineHeight: 1.55 }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--admin-ink)' }}>
            Hệ thống Supervisor & Đa luồng tự động
          </strong>
          <p style={{ margin: 0, color: 'var(--admin-muted)' }}>
            Khi bắt đầu, hệ thống sẽ gom toàn bộ danh sách khách sạn và phân phối vào hàng đợi ngầm Laravel queue. Bạn có thể theo dõi tiến độ thời gian thực hoặc đóng trình duyệt mà không làm gián đoạn quá trình cào.
          </p>
        </div>
      </div>

      {/* Live Log Console Modal */}
      {showLiveModal && (
        <div className="ui-modal ui-modal--open" role="dialog" aria-modal="true">
          <button
            type="button"
            className="ui-modal__veil"
            aria-label="Đóng"
            onClick={() => !loading && setShowLiveModal(false)}
          />
          <div
            className="ui-modal__card ui-crawler-modal"
            role="document"
            style={{ maxWidth: '44rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ui-crawler-modal__head">
              <div className="ui-crawler-modal__brand">
                <div className="ui-crawler-modal__icon-box">
                  {loading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <ScanSearch size={18} />
                  )}
                </div>
                <div className="ui-crawler-modal__titles">
                  <p className="ui-crawler-modal__eyebrow">Booking.com Crawler Engine</p>
                  <h2 className="ui-crawler-modal__title">
                    {loading ? 'Đang khởi chạy Crawler Booking.com…' : 'Tiến trình Crawler Booking.com'}
                  </h2>
                </div>
              </div>
              {!loading && (
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  style={{ padding: '0.4rem', borderRadius: '0.4rem' }}
                  title="Đóng cửa sổ theo dõi"
                  onClick={() => setShowLiveModal(false)}
                >
                  <X size={18} />
                </button>
              )}
            </header>

            <div className="ui-crawler-modal__body">
              <p className="ui-crawler-modal__hint">
                💡 Hệ thống tự động gom toàn bộ danh sách khách sạn và phân phối vào hàng đợi ngầm Laravel queue. Bạn có thể theo dõi tiến độ thời gian thực hoặc đóng trình duyệt mà không làm gián đoạn quá trình cào.
              </p>
              <CrawlerTerminalLog
                logs={liveLogs}
                running={loading}
                maxHeight="min(45vh, 22rem)"
              />
            </div>

            <footer className="ui-crawler-modal__foot">
              <span style={{ fontSize: '0.78rem', color: 'var(--admin-muted, #64748b)' }}>
                {liveLogs.length > 0 ? `Đã ghi nhận ${liveLogs.length} dòng sự kiện` : 'Chờ sự kiện tiếp theo...'}
              </span>
              {!loading && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowLiveModal(false)}
                >
                  Đóng
                </Button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateStayCrawlerPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải...</div>}>
      <CreateCrawlerInner />
    </Suspense>
  );
}
