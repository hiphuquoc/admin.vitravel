'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clapperboard, Film, Settings2, Youtube } from 'lucide-react';
import toast from '@/lib/toast';
import { videosApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, markFormHydrationStale } from '@/hooks/useFormHydration';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { emptyVideoField, VideoField, type VideoFieldState } from '@/components/ui/VideoField';
import { FormMediaAside, FormThumbCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { replaceFormUrl } from '@/lib/formNavigate';
import { asLocaleOptions, type LocaleOption } from '@/lib/locale';
import { extractYoutubeId, youtubeEmbedUrl } from '@/lib/youtube';
import type { MediaImage } from '@/lib/types';

type SourceMode = 'youtube' | 'upload';

type FormState = {
  title: string;
  description: string;
  youtube_input: string;
  duration: string;
  tag: string;
  sort: string;
  status: string;
  country_id: string;
  show_on_home: boolean;
  source: SourceMode;
  thumbnail: ImageFieldState;
  video: VideoFieldState;
};

const empty: FormState = {
  title: '',
  description: '',
  youtube_input: '',
  duration: '',
  tag: '',
  sort: '0',
  status: 'draft',
  country_id: '',
  show_on_home: false,
  source: 'youtube',
  thumbnail: emptyImageField(),
  video: emptyVideoField(),
};

function FormInner() {
  const search = useSearchParams();
  const id = search.get('id') ? Number(search.get('id')) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const snapshotRef = useRef(JSON.stringify(empty));
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = JSON.stringify(form) !== snapshotRef.current;

  const metaQuery = useQuery({
    queryKey: ['videos-meta', locale],
    queryFn: () => videosApi.meta(locale),
    staleTime: 60_000,
  });
  const detailQuery = useQuery({
    queryKey: ['videos', id, locale],
    queryFn: () => videosApi.get(id!, locale),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;
    const d = detailQuery.data as Record<string, unknown>;
    const videoFile = (d.video_file as MediaImage | null | undefined) ?? null;
    const youtubeId = String(d.youtube_id || '');
    const videoUrl = String(d.video_url || '');
    const source: SourceMode = videoFile?.id ? 'upload' : 'youtube';

    const next: FormState = {
      title: String(d.title || ''),
      description: String(d.description || ''),
      youtube_input: youtubeId || videoUrl,
      duration: String(d.duration || ''),
      tag: String(d.tag || ''),
      sort: String(d.sort ?? 0),
      status: String(d.status || 'draft'),
      country_id: d.country_id != null ? String(d.country_id) : '',
      show_on_home: !!d.show_on_home,
      source,
      thumbnail: emptyImageField((d.thumbnail as MediaImage | null | undefined) ?? null),
      video: emptyVideoField(videoFile),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Vui lòng nhập tiêu đề.');
      if (form.source === 'youtube') {
        const yt = extractYoutubeId(form.youtube_input);
        if (!yt) {
          throw new Error('Liên kết hoặc mã YouTube không hợp lệ.');
        }
      } else if (!form.video.media?.id || form.video.remove) {
        throw new Error('Vui lòng upload file video.');
      }

      const body: Record<string, unknown> = {
        locale,
        title: form.title.trim(),
        description: form.description.trim() || null,
        duration: form.duration.trim() || null,
        tag: form.tag.trim() || null,
        sort: Number(form.sort) || 0,
        status: form.status || 'draft',
        country_id: form.country_id ? Number(form.country_id) : null,
        show_on_home: form.show_on_home,
        source: form.source,
        thumbnail_media_id: form.thumbnail.media?.id ?? null,
        remove_thumbnail: form.thumbnail.remove,
      };

      if (form.source === 'youtube') {
        body.youtube_id = form.youtube_input.trim() || null;
        body.video_url = null;
        body.video_media_id = null;
        body.remove_video_file = true;
      } else {
        body.youtube_id = null;
        body.video_url = null;
        body.video_media_id = form.video.media?.id ?? null;
        body.remove_video_file = form.video.remove;
      }

      return id ? videosApi.update(id, body) : videosApi.create(body);
    },
    onSuccess: async (data) => {
      toast.success('Đã lưu video');
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: ['videos'] });
      replaceFormUrl(router, `/brand/videos/form/?id=${(data as { id: number }).id}&locale=${locale}`);
      snapshotRef.current = JSON.stringify(form);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setSource = (source: SourceMode) => {
    if (source === form.source) return;
    const leavingYoutube = form.source === 'youtube' && !!extractYoutubeId(form.youtube_input);
    const leavingUpload =
      form.source === 'upload' && !!form.video.media?.id && !form.video.remove;
    const enteringHasOther =
      source === 'youtube'
        ? !!extractYoutubeId(form.youtube_input)
        : !!form.video.media?.id && !form.video.remove;

    if ((leavingYoutube || leavingUpload) && !enteringHasOther) {
      const fromLabel = form.source === 'youtube' ? 'YouTube' : 'file upload';
      const toLabel = source === 'youtube' ? 'YouTube' : 'file upload';
      const ok = window.confirm(
        `Chuyển sang ${toLabel}. Nguồn ${fromLabel} hiện tại sẽ không còn phát trên web sau khi lưu. Tiếp tục?`,
      );
      if (!ok) return;
    }
    setForm((p) => ({ ...p, source }));
  };

  const languages =
    asLocaleOptions(metaQuery.data?.languages) ?? ([] as LocaleOption[]);
  const countries = (
    (metaQuery.data?.countries as { id: number; name: string }[] | undefined) ?? []
  ).map((c) => ({ value: String(c.id), label: c.name }));
  const statusOptions = (
    (metaQuery.data?.statuses as { value: string; label: string }[] | undefined) ?? [
      { value: 'draft', label: 'Nháp' },
      { value: 'published', label: 'Xuất bản' },
    ]
  ).map((s) => ({ value: s.value, label: s.label }));

  const ytId = useMemo(() => extractYoutubeId(form.youtube_input), [form.youtube_input]);
  const ytReady = !!ytId;
  const uploadReady = !!form.video.media?.id && !form.video.remove;
  const activeReady = form.source === 'youtube' ? ytReady : uploadReady;

  const defaultLocale = String(
    metaQuery.data?.default_locale
    || (detailQuery.data as { default_locale?: string } | undefined)?.default_locale
    || DEFAULT_LOCALE
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'experience_video',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await videosApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        title: d.title || '',
        description: d.description || '',
      });
    },
    applyFields: (fields) =>
      setForm((prev) =>
        mergeTranslatedFields(prev as unknown as Record<string, unknown>, fields) as typeof prev,
      ),
  });

  return (
    <StructureLockProvider locked={structureLocked}>
    <div>
        <PageHeader
          eyebrow="Thương hiệu"
        title={isNew ? 'Thêm video' : 'Sửa video'}
        id={isNew ? null : id}
        actions={
          <HeadActions
            secondary={
              <HeadSecondary
                href="/brand/videos/"
                icon={ArrowLeft}
                title="Quay lại"
                subtitle="Danh sách video"
              />
            }
          />
        }
      />

      <LocaleSwitcher
        languages={languages}
        value={locale}
        onChange={(code) => setLocale(code, { confirmIfDirty: true, isDirty })}
        translatedLocales={
          (detailQuery.data as { translated_locales?: string[] } | undefined)?.translated_locales ??
          (isNew ? [] : undefined)
        }
      />
      <StructureNotice />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
        className="ui-form-layout"
      >
        <div className="ui-form-layout__main ui-form-stack">
          <FormSection
            icon={Clapperboard}
            title="Nguồn video"
            description="Chỉ một nguồn được dùng trên web. Chọn bên dưới rồi chỉnh nội dung nguồn đó."
          >
            <div className="ui-source-mode">
              <div
                className={
                  activeReady
                    ? 'ui-source-mode__status ui-source-mode__status--ready'
                    : 'ui-source-mode__status'
                }
                role="status"
              >
                <span className="ui-source-mode__status-label">Đang dùng</span>
                <strong className="ui-source-mode__status-value">
                  {form.source === 'youtube' ? (
                    <>
                      <Youtube size={16} strokeWidth={2.2} aria-hidden />
                      YouTube
                    </>
                  ) : (
                    <>
                      <Film size={16} strokeWidth={2.2} aria-hidden />
                      File upload
                    </>
                  )}
                </strong>
                <span className="ui-source-mode__status-detail">
                  {activeReady
                    ? form.source === 'youtube'
                      ? `Mã: ${ytId}`
                      : form.video.media?.filename || 'Đã có file video'
                    : form.source === 'youtube'
                      ? 'Chưa có link / mã YouTube hợp lệ'
                      : 'Chưa upload file video'}
                </span>
              </div>

              <div
                className="ui-source-mode__options"
                role="radiogroup"
                aria-label="Chọn nguồn sử dụng"
                style={structureLocked ? { opacity: 0.55, pointerEvents: 'none' } : undefined}
              >
                <label
                  className={
                    form.source === 'youtube'
                      ? 'ui-source-mode__option ui-source-mode__option--active'
                      : 'ui-source-mode__option'
                  }
                >
                  <input
                    type="radio"
                    name="video_source"
                    value="youtube"
                    checked={form.source === 'youtube'}
                    disabled={structureLocked}
                    onChange={() => setSource('youtube')}
                  />
                  <span className="ui-source-mode__option-icon" aria-hidden>
                    <Youtube size={18} strokeWidth={2.1} />
                  </span>
                  <span className="ui-source-mode__option-copy">
                    <span className="ui-source-mode__option-title">
                      YouTube
                      {form.source === 'youtube' ? (
                        <span className="ui-source-mode__pill">Đang dùng</span>
                      ) : null}
                    </span>
                    <small>
                      {ytReady
                        ? `Sẵn sàng · ${ytId}`
                        : form.youtube_input.trim()
                          ? 'Link chưa hợp lệ — sửa để dùng'
                          : 'Dán link hoặc mã video'}
                    </small>
                  </span>
                  <span className="ui-source-mode__option-action">
                    {form.source === 'youtube' ? 'Đã chọn' : 'Dùng nguồn này'}
                  </span>
                </label>

                <label
                  className={
                    form.source === 'upload'
                      ? 'ui-source-mode__option ui-source-mode__option--active'
                      : 'ui-source-mode__option'
                  }
                >
                  <input
                    type="radio"
                    name="video_source"
                    value="upload"
                    checked={form.source === 'upload'}
                    disabled={structureLocked}
                    onChange={() => setSource('upload')}
                  />
                  <span className="ui-source-mode__option-icon" aria-hidden>
                    <Film size={18} strokeWidth={2.1} />
                  </span>
                  <span className="ui-source-mode__option-copy">
                    <span className="ui-source-mode__option-title">
                      Upload file
                      {form.source === 'upload' ? (
                        <span className="ui-source-mode__pill">Đang dùng</span>
                      ) : null}
                    </span>
                    <small>
                      {uploadReady
                        ? `Sẵn sàng · ${form.video.media?.filename || 'file video'}`
                        : 'MP4 / WebM / MOV'}
                    </small>
                  </span>
                  <span className="ui-source-mode__option-action">
                    {form.source === 'upload' ? 'Đã chọn' : 'Dùng nguồn này'}
                  </span>
                </label>
              </div>

              {form.source === 'youtube' && uploadReady ? (
                <p className="ui-source-mode__aside-note">
                  Đang có file upload sẵn (<strong>{form.video.media?.filename}</strong>) nhưng
                  không phát trên web. Chọn «Upload file» nếu muốn dùng file đó — lưu sẽ bỏ
                  YouTube.
                </p>
              ) : null}
              {form.source === 'upload' && ytReady ? (
                <p className="ui-source-mode__aside-note">
                  Đang có YouTube sẵn (<strong>{ytId}</strong>) nhưng không phát trên web. Chọn
                  «YouTube» nếu muốn dùng lại — lưu sẽ xóa file upload.
                </p>
              ) : null}

              {form.source === 'youtube' ? (
                <div className="ui-source-mode__panel">
                  <div className="ui-source-mode__panel-head">
                    <strong>Chỉnh nguồn YouTube</strong>
                    <span>Nguồn này sẽ phát trên trang public sau khi lưu.</span>
                  </div>
                  <Input
                    label="Mã hoặc liên kết YouTube"
                    value={form.youtube_input}
                    onChange={(e) => set('youtube_input', e.target.value)}
                    placeholder="https://youtu.be/… hoặc dQw4w9WgXcQ"
                    hint="Chấp nhận URL đầy đủ, youtu.be, Shorts hoặc mã 11 ký tự."
                    required
                    disabled={structureLocked}
                  />
                  {ytId ? (
                    <div className="ui-source-mode__preview">
                      <iframe
                        title="Xem trước YouTube"
                        src={youtubeEmbedUrl(ytId)}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="ui-source-mode__empty-preview">
                      Dán link YouTube hợp lệ để xem trước tại đây
                    </div>
                  )}
                </div>
              ) : (
                <div className="ui-source-mode__panel">
                  <div className="ui-source-mode__panel-head">
                    <strong>Chỉnh file upload</strong>
                    <span>File này sẽ phát trên trang public sau khi lưu.</span>
                  </div>
                  <VideoField
                    ariaLabel="File video"
                    value={form.video}
                    onChange={(v) => set('video', v)}
                    hint={
                      (metaQuery.data?.video_upload_hint as string | undefined) ||
                      'MP4, WebM, MOV — chỉ phát khi nguồn Upload đang được chọn.'
                    }
                  />
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            icon={Clapperboard}
            title="Nội dung"
            description="Tiêu đề và mô tả theo ngôn ngữ đang chỉnh."
          >
            <Input
              label="Tiêu đề"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
            <Textarea
              label="Mô tả ngắn"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              hint="Hiển thị trong lightbox / trang video trải nghiệm."
            />
            <FormCluster>
              <Input
                label="Thời lượng"
                value={form.duration}
                onChange={(e) => set('duration', e.target.value)}
                placeholder="12:40"
              />
              <Input
                label="Nhãn ngắn"
                value={form.tag}
                onChange={(e) => set('tag', e.target.value)}
                placeholder="Sa Pa · Mùa lúa"
                hint="Hiện cạnh tile trên trang chủ."
              />
            </FormCluster>
          </FormSection>

          <FormSection icon={Settings2} title="Cấu hình" description="Xuất bản và vị trí hiển thị.">
            <FormCluster>
              <Select
                label="Trạng thái"
                value={form.status}
                onChange={(v) => set('status', v)}
                disabled={structureLocked}
                options={statusOptions}
              />
              <Select
                label="Quốc gia"
                value={form.country_id}
                onChange={(v) => set('country_id', v)}
                placeholder="— Không gắn —"
                disabled={structureLocked}
                options={countries}
              />
              <Input
                label="Thứ tự"
                type="number"
                value={form.sort}
                onChange={(e) => set('sort', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>
            <div className="ui-form-flags">
              <Switch
                label="Hiện trang chủ"
                checked={form.show_on_home}
                onChange={(v) => set('show_on_home', v)}
              />
            </div>
          </FormSection>

          <FormFooter
            cancelHref="/brand/videos/"
            loading={save.isPending}
          />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện video"
              folder="videos"
              slug={form.title}
              role="thumb"
              aspectRatio="16 / 9"
              variant="card"
              value={form.thumbnail}
              onChange={(v) => set('thumbnail', v)}
            />
            {form.source === 'youtube' && ytId && !form.thumbnail.media && !form.thumbnail.remove ? (
              <p className="ui-video-field__meta">
                Chưa có ảnh riêng — public sẽ dùng thumbnail YouTube.
              </p>
            ) : null}
          </FormThumbCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function VideoFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
