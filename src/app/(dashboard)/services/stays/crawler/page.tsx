'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { ApiClientError } from '@/lib/api';
import { servicesApi, stayCrawlsApi, type StayCrawlItem } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Badge, PageHeader } from '@/components/ui/Page';
import { EntityList, EntityMain, EntityRow, EntityActions } from '@/components/ui/EntityList';
import { FormSection } from '@/components/ui/FormSection';
import { useAuth } from '@/lib/auth-context';
import { useAppRouter } from '@/hooks/useAppRouter';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'imported' || status === 'ai_done' || status === 'done' || status === 'ready') return 'success';
  if (status === 'blocked' || status === 'failed') return 'danger';
  if (status === 'extracted' || status === 'fetched' || status === 'crawling') return 'primary';
  return 'warning';
}

export default function StayCrawlerPage() {
  const { can } = useAuth();
  const canCreate = can('services.create');
  const router = useAppRouter();
  const qc = useQueryClient();

  const [hotelUrl, setHotelUrl] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [html, setHtml] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const metaQuery = useQuery({
    queryKey: ['services-meta', 'stay'],
    queryFn: () => servicesApi.meta('vi', 'stay'),
  });
  const jobsQuery = useQuery({
    queryKey: ['stay-crawls-jobs'],
    queryFn: () => stayCrawlsApi.jobs(),
  });
  const itemsQuery = useQuery({
    queryKey: ['stay-crawls-items'],
    queryFn: () => stayCrawlsApi.items({ per_page: 30 }),
  });

  const categories = (metaQuery.data?.categories || []).map((c) => ({
    value: String(c.id),
    label: c.name || `#${c.id}`,
  }));

  const ingest = useMutation({
    mutationFn: () =>
      stayCrawlsApi.ingest({
        url: hotelUrl,
        html: html || undefined,
        service_category_id: categoryId ? Number(categoryId) : undefined,
      }),
    onSuccess: (data) => {
      toast.success(`Draft ${data.code}`);
      qc.invalidateQueries({ queryKey: ['stay-crawls-items'] });
      if (data.service_id) {
        router.push(`/services/products/form/?id=${data.service_id}&cluster=stay`);
      }
    },
    onError: (e) => {
      const err = e as ApiClientError;
      toast.error(err.message || 'Ingest thất bại');
      qc.invalidateQueries({ queryKey: ['stay-crawls-items'] });
    },
  });

  const enqueueList = useMutation({
    mutationFn: () =>
      stayCrawlsApi.enqueueList({
        url: listUrl,
        html: html || undefined,
        service_category_id: categoryId ? Number(categoryId) : undefined,
      }),
    onSuccess: (data) => {
      toast.success(`Đã lưu ${data.urls.length} URL chỗ nghỉ`);
      qc.invalidateQueries({ queryKey: ['stay-crawls-jobs'] });
      qc.invalidateQueries({ queryKey: ['stay-crawls-items'] });
    },
    onError: (e) => toast.error((e as ApiClientError).message),
  });

  const runStep = useMutation({
    mutationFn: async ({ id, step }: { id: number; step: 'detail' | 'ai' | 'import' }) => {
      if (step === 'detail') return stayCrawlsApi.detail(id, { html: html || undefined, keep_html: true });
      if (step === 'ai') return stayCrawlsApi.ai(id);
      return stayCrawlsApi.import(id, {
        service_category_id: categoryId ? Number(categoryId) : undefined,
      });
    },
    onSuccess: (data, vars) => {
      toast.success(vars.step === 'import' && 'code' in data ? `Draft ${data.code}` : 'Xong');
      qc.invalidateQueries({ queryKey: ['stay-crawls-items'] });
      if (vars.step === 'import' && 'service_id' in data && data.service_id) {
        router.push(`/services/products/form/?id=${data.service_id}&cluster=stay`);
      }
    },
    onError: (e) => toast.error((e as ApiClientError).message),
  });

  const items = itemsQuery.data?.items ?? [];
  const jobs = jobsQuery.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Lưu trú"
        title="Crawler Booking.com"
        description="Công cụ nâng cao. Cách dùng thường ngày: Danh mục lưu trú → Sửa danh mục → Crawler Booking.com (dán URL listing, tạo trang con kế thừa slug_full)."
      />

      <FormSection
        title="1 chỗ nghỉ"
        description="Dán URL khách sạn Booking.com. Nếu fetch bị chặn, dán HTML đã Save As vào ô bên dưới."
      >
        <Input
          label="URL chỗ nghỉ"
          placeholder="https://www.booking.com/hotel/vn/…"
          value={hotelUrl}
          onChange={(e) => setHotelUrl(e.target.value)}
        />
        <Select
          label="Danh mục lưu trú"
          placeholder="— chọn —"
          options={categories}
          value={categoryId}
          onChange={setCategoryId}
        />
        <Textarea
          label="HTML đã lưu (tuỳ chọn)"
          hint="Khi Booking chặn bot: Save page → dán source. URL vẫn được lưu để nâng cấp crawler."
          rows={6}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
        />
        <Button
          disabled={!canCreate || !hotelUrl}
          loading={ingest.isPending}
          onClick={() => ingest.mutate()}
        >
          Ingest (extract → AI → draft)
        </Button>
      </FormSection>

      <FormSection title="Danh mục OTA" description="Lấy list URL khách sạn từ trang searchresults — luôn lưu source_url.">
        <Input
          label="URL listing"
          placeholder="https://www.booking.com/searchresults.html?ss=Phu+Quoc"
          value={listUrl}
          onChange={(e) => setListUrl(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={!canCreate || !listUrl}
          loading={enqueueList.isPending}
          onClick={() => enqueueList.mutate()}
        >
          Lấy danh sách URL
        </Button>
      </FormSection>

      <FormSection title="Jobs gần đây">
        {jobs.length === 0 ? (
          <p className="body-text">Chưa có job.</p>
        ) : (
          <EntityList>
            {jobs.slice(0, 8).map((job) => (
              <EntityRow key={job.id}>
                <EntityMain
                  title={`#${job.id}`}
                  slug={job.list_url}
                  badges={<Badge tone={statusTone(job.status)}>{job.status}</Badge>}
                  facts={<span>{job.items_found ?? job.items_count ?? 0} URL</span>}
                />
              </EntityRow>
            ))}
          </EntityList>
        )}
      </FormSection>

      <FormSection title="Items (URL đã lưu)">
        {items.length === 0 ? (
          <p className="body-text">Chưa có item.</p>
        ) : (
          <EntityList>
            {items.map((item: StayCrawlItem) => (
              <EntityRow key={item.id}>
                <EntityMain
                  title={`#${item.id}`}
                  slug={item.source_url}
                  publicHref={item.source_url}
                  badges={<Badge tone={statusTone(item.status)}>{item.status}</Badge>}
                  facts={item.error ? <span>{item.error}</span> : undefined}
                />
                <EntityActions>
                  {item.status === 'queued' || item.status === 'blocked' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canCreate}
                      loading={runStep.isPending}
                      onClick={() => runStep.mutate({ id: item.id, step: 'detail' })}
                    >
                      Extract
                    </Button>
                  ) : null}
                  {item.status === 'extracted' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canCreate}
                      loading={runStep.isPending}
                      onClick={() => runStep.mutate({ id: item.id, step: 'ai' })}
                    >
                      AI
                    </Button>
                  ) : null}
                  {item.status === 'ai_done' ? (
                    <Button
                      size="sm"
                      disabled={!canCreate}
                      loading={runStep.isPending}
                      onClick={() => runStep.mutate({ id: item.id, step: 'import' })}
                    >
                      Import draft
                    </Button>
                  ) : null}
                  {item.service_id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        router.push(`/services/products/form/?id=${item.service_id}&cluster=stay`)
                      }
                    >
                      Mở draft
                    </Button>
                  ) : null}
                </EntityActions>
              </EntityRow>
            ))}
          </EntityList>
        )}
      </FormSection>
    </>
  );
}
