'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { serviceCategoriesApi, stayCrawlsApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';

function isHotelUrl(url: string): boolean {
  try {
    return /\/hotel\/[a-z]{2}\/[^/]+\.html/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function CreateCrawlerInner() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const canCreate = can('services.create');

  const paramCategoryId = searchParams.get('category_id');
  const [categoryId, setCategoryId] = useState<number | null>(
    paramCategoryId ? Number(paramCategoryId) : null,
  );
  const [mode, setMode] = useState<'hotel' | 'list'>('list');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [loading, setLoading] = useState(false);
  const runningRef = useRef(false);

  const statusQuery = useQuery({
    queryKey: ['stay-crawls-status'],
    queryFn: () => stayCrawlsApi.status(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['stay-categories-list'],
    queryFn: () => serviceCategoriesApi.list({ cluster: 'stay', per_page: 100 }),
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

  const categories = categoriesQuery.data?.items ?? [];

  const handleStartCrawl = async () => {
    if (runningRef.current) return;
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục lưu trú đích.');
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

    try {
      const started = await stayCrawlsApi.fromCategory({
        service_category_id: categoryId,
        url: targetUrl,
        html: html.trim() || undefined,
        use_proxy: useProxy || undefined,
      });

      const jobId = started.job?.id;
      if (!jobId) {
        toast.error('Không khởi tạo được job crawler từ server.');
        setLoading(false);
        runningRef.current = false;
        return;
      }

      toast.success(`Đã khởi tạo Job #${jobId} thành công! Đang chuyển đến bảng theo dõi...`);
      router.push(`/services/stay-crawler/detail/?id=${jobId}&live=true`);
    } catch (e: any) {
      setLoading(false);
      runningRef.current = false;
      toast.error(e?.message || 'Khởi chạy crawler thất bại.');
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
            label="Danh mục lưu trú đích"
            required
            placeholder="— Chọn danh mục đích —"
            options={categories.map((c) => ({
              value: String(c.id),
              label: c.name ? `${c.name} (ID: ${c.id})` : `#${c.id}`,
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
          hint="Mở link trên trình duyệt của bạn → Nhấn Ctrl+S / Lưu trang HTML → Dán toàn bộ mã nguồn vào đây để bypass."
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
            Khi bắt đầu, hệ thống sẽ gom toàn bộ danh sách khách sạn và phân phối vào hàng đợi ngầm. Bạn có thể theo dõi tiến độ thời gian thực hoặc đóng trình duyệt mà không làm gián đoạn quá trình cào.
          </p>
        </div>
      </div>
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
