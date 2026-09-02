'use client';

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Images, MessageSquareQuote, Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { reviewsApi } from '@/lib/services';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { Repeater } from '@/components/ui/Repeater';
import { Button } from '@/components/ui/Button';
import { replaceFormUrl } from '@/lib/formNavigate';
import { beginFormHydration, markFormHydrationStale, useResetFormOnProjectChange } from '@/hooks/useFormHydration';
import { useScopedQueryKey } from '@/hooks/useScopedQueryKey';

type GalleryRow = { key: string; image: ImageFieldState };

type FormState = {
  author_name: string;
  author_country: string;
  author_country_code: string;
  rating: string;
  reviewed_on: string;
  question_title: string;
  content: string;
  photos_count: string;
  sort: string;
  status: string;
  is_featured: boolean;
  show_on_home: boolean;
  avatar: ImageFieldState;
  gallery: GalleryRow[];
};

const STATUS_OPTIONS = [
  { value: 'published', label: 'Xuất bản' },
  { value: 'draft', label: 'Nháp' },
  { value: 'hidden', label: 'Ẩn' },
];

const emptyGallery = (): GalleryRow => ({
  key: `gal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  image: emptyImageField(),
});

const empty: FormState = {
  author_name: '',
  author_country: '',
  author_country_code: '',
  rating: '5',
  reviewed_on: '',
  question_title: '',
  content: '',
  photos_count: '0',
  sort: '0',
  status: 'published',
  is_featured: false,
  show_on_home: false,
  avatar: emptyImageField(),
  gallery: [],
};

function FormInner() {
  const search = useSearchParams();
  const id = search.get('id') ? Number(search.get('id')) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const snapshotRef = useRef(JSON.stringify(empty));
  const hydrateKeyRef = useRef<string | null>(null);

  const metaQuery = useQuery({
    queryKey: ['reviews-meta'],
    queryFn: () => reviewsApi.meta(),
    staleTime: 60_000,
  });
  const detailQueryKey = useScopedQueryKey('reviews', id);

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => reviewsApi.get(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const resetForm = useCallback(() => {
    setForm(empty);
    snapshotRef.current = JSON.stringify(empty);
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!detailQuery.data) return;
    if (!beginFormHydration(hydrateKeyRef, id)) return;
    const d = detailQuery.data as Record<string, unknown>;
    const gallery = Array.isArray(d.gallery)
      ? (d.gallery as { id?: number; media?: never }[]).map((row, i) => ({
          key: `gal-${row.id ?? i}`,
          image: emptyImageField(row.media ?? null),
        }))
      : [];

    const next: FormState = {
      author_name: String(d.author_name || ''),
      author_country: String(d.author_country || ''),
      author_country_code: String(d.author_country_code || ''),
      rating: String(d.rating || 5),
      reviewed_on: String(d.reviewed_on || ''),
      question_title: String(d.question_title || ''),
      content: String(d.content || ''),
      photos_count: String(d.photos_count || 0),
      sort: String(d.sort || 0),
      status: String(d.status || 'published'),
      is_featured: !!d.is_featured,
      show_on_home: !!d.show_on_home,
      avatar: emptyImageField(d.avatar as never),
      gallery,
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        author_name: form.author_name,
        author_country: form.author_country || null,
        author_country_code: form.author_country_code || null,
        rating: Number(form.rating) || 5,
        reviewed_on: form.reviewed_on || null,
        question_title: form.question_title || null,
        content: form.content,
        photos_count: Number(form.photos_count) || 0,
        sort: Number(form.sort) || 0,
        status: form.status,
        is_featured: form.is_featured,
        show_on_home: form.show_on_home,
        avatar_media_id: form.avatar.media?.id ?? null,
        remove_avatar: form.avatar.remove,
        gallery_media_ids: form.gallery
          .map((row) => row.image.media?.id)
          .filter((mid): mid is number => typeof mid === 'number' && mid > 0),
      };
      return isNew ? reviewsApi.create(payload) : reviewsApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo cảm nhận' : 'Đã lưu cảm nhận');
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: ['reviews'] });
      replaceFormUrl(router, `/brand/reviews/form/?id=${(data as { id: number }).id}`);
      snapshotRef.current = JSON.stringify(form);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const statusOptions = (
    (metaQuery.data?.statuses as { value: string; label: string }[] | undefined) ?? STATUS_OPTIONS
  ).map((s) => ({ value: s.value, label: s.label }));

  return (
    <div>
      <PageHeader
        eyebrow="Thương hiệu"
        title={isNew ? 'Thêm cảm nhận khách hàng' : 'Sửa cảm nhận khách hàng'}
        id={isNew ? null : id}
        actions={
          <HeadActions
            secondary={
              <HeadSecondary
                href="/brand/reviews/"
                icon={ArrowLeft}
                title="Quay lại"
                subtitle="Danh sách cảm nhận KH"
              />
            }
          />
        }
      />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
        className="ui-form-layout"
      >
        <div className="ui-form-layout__main ui-form-stack">
          <FormSection
            icon={MessageSquareQuote}
            title="Nội dung cảm nhận"
            description="Hiển thị trên trang cảm nhận / khối testimonials."
          >
            <FormCluster>
              <Input
                label="Tên khách hàng"
                value={form.author_name}
                onChange={(e) => set('author_name', e.target.value)}
                required
              />
              <Input
                label="Quốc gia"
                value={form.author_country}
                onChange={(e) => set('author_country', e.target.value)}
              />
              <Input
                label="Mã quốc gia"
                value={form.author_country_code}
                onChange={(e) => set('author_country_code', e.target.value)}
                hint="vd. us, au, fr — dùng cho cờ"
              />
              <Input
                label="Điểm đánh giá"
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => set('rating', e.target.value)}
              />
            </FormCluster>
            <FormCluster>
              <Input
                label="Tiêu đề / chuyến đi"
                value={form.question_title}
                onChange={(e) => set('question_title', e.target.value)}
              />
              <Input
                label="Ngày đánh giá"
                type="date"
                value={form.reviewed_on}
                onChange={(e) => set('reviewed_on', e.target.value)}
              />
              <Select
                label="Trạng thái"
                value={form.status}
                onChange={(v) => set('status', v)}
                options={statusOptions}
              />
              <Input
                label="Thứ tự"
                type="number"
                value={form.sort}
                onChange={(e) => set('sort', e.target.value)}
              />
            </FormCluster>
            <Textarea
              label="Nội dung"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              required
            />
            <div className="ui-form-flags">
              <Switch
                label="Nổi bật"
                checked={form.is_featured}
                onChange={(v) => set('is_featured', v)}
              />
              <Switch
                label="Hiện trang chủ"
                checked={form.show_on_home}
                onChange={(v) => set('show_on_home', v)}
              />
            </div>
          </FormSection>

          <FormSection
            icon={Images}
            title="Ảnh chuyến đi (gallery)"
            description="Ảnh hiển thị cạnh cảm nhận trên public. Ưu tiên hơn số ảnh ảo."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('gallery', [...form.gallery, emptyGallery()])}
              >
                <Plus size={16} /> Thêm ảnh
              </Button>
            }
          >
            <Input
              label="Số ảnh (fallback)"
              type="number"
              min={0}
              max={99}
              value={form.photos_count}
              onChange={(e) => set('photos_count', e.target.value)}
              hint="Chỉ dùng khi chưa upload gallery thật."
            />
            <Repeater
              items={form.gallery}
              onChange={(items) => set('gallery', items)}
              createItem={emptyGallery}
              addLabel="Thêm ảnh"
              emptyHint="Chưa có ảnh chuyến đi."
              keyOf={(row) => row.key}
              renderItem={(row, _i, { update }) => (
                <ImageField
                  ariaLabel="Ảnh chuyến đi"
                  folder="reviews"
                  slug={form.author_name || form.question_title}
                  role="gallery"
                  aspectRatio="4 / 3"
                  variant="card"
                  value={row.image}
                  onChange={(v) => update({ image: v })}
                />
              )}
            />
          </FormSection>

          <FormFooter
            cancelHref="/brand/reviews/"
            loading={save.isPending}
          />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện khách"
              folder="reviews"
              slug={form.author_name || form.question_title}
              role="avatar"
              aspectRatio="1 / 1"
              variant="card"
              value={form.avatar}
              onChange={(v) => set('avatar', v)}
            />
          </FormThumbCard>
        </FormMediaAside>
      </form>
    </div>
  );
}

export default function ReviewFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
