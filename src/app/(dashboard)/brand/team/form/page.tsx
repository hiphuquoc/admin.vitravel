'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Briefcase,
  GraduationCap,
  Images,
  Plus,
  Sparkles,
  UserRound,
} from 'lucide-react';
import toast from '@/lib/toast';
import { teamMembersApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, markFormHydrationStale, useResetFormOnProjectChange } from '@/hooks/useFormHydration';
import { useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { SeoBox, type SeoParentOption } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { Repeater } from '@/components/ui/Repeater';
import { Button } from '@/components/ui/Button';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { asLocaleOptions, type LocaleOption } from '@/lib/locale';

type AchievementRow = { content: string };
type SkillRow = { skill: string; percent: string };
type ExpRow = { title: string; company: string; items: string };
type DegreeRow = { title: string; school: string; items: string };
type ActivityRow = { key: string; image: ImageFieldState };

type FormState = {
  name: string;
  role: string;
  department: string;
  short_bio: string;
  bio_html: string;
  phone: string;
  email: string;
  area: string;
  years_experience: string;
  languages: string;
  sort: string;
  is_active: boolean;
  show_on_home: boolean;
  is_verified: boolean;
  stat_clients: string;
  stat_tours: string;
  stat_awards: string;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_parent_id: string;
  avatar: ImageFieldState;
  achievements: AchievementRow[];
  skills: SkillRow[];
  experiences: ExpRow[];
  degrees: DegreeRow[];
  activity_images: ActivityRow[];
};

const emptyAchievement = (): AchievementRow => ({ content: '' });
const emptySkill = (): SkillRow => ({ skill: '', percent: '80' });
const emptyExp = (): ExpRow => ({ title: '', company: '', items: '' });
const emptyDegree = (): DegreeRow => ({ title: '', school: '', items: '' });
const emptyActivity = (): ActivityRow => ({
  key: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  image: emptyImageField(),
});

const empty: FormState = {
  name: '',
  role: '',
  department: '',
  short_bio: '',
  bio_html: '',
  phone: '',
  email: '',
  area: '',
  years_experience: '0',
  languages: '',
  sort: '0',
  is_active: true,
  show_on_home: false,
  is_verified: false,
  stat_clients: '0',
  stat_tours: '0',
  stat_awards: '0',
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_parent_id: '',
  avatar: emptyImageField(),
  achievements: [],
  skills: [],
  experiences: [],
  degrees: [],
  activity_images: [],
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
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['team-members-meta', locale],
    queryFn: () => teamMembersApi.meta(locale),
  });
  const detailQueryKey = useScopedQueryKey('team-members', id, locale);

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => teamMembersApi.get(id!, locale),
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
    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;
    const d = detailQuery.data as Record<string, unknown>;
    const seo = d.seo as
      | {
          slug?: string;
          title?: string;
          description?: string;
          parent_id?: number;
        }
      | undefined;

    const achievements = Array.isArray(d.achievements)
      ? (d.achievements as { content?: string }[]).map((row) => ({
          content: String(row.content || ''),
        }))
      : [];
    const skills = Array.isArray(d.skills)
      ? (d.skills as { skill?: string; percent?: number }[]).map((row) => ({
          skill: String(row.skill || ''),
          percent: String(row.percent ?? 0),
        }))
      : [];
    const experiences = Array.isArray(d.experiences)
      ? (d.experiences as { title?: string; company?: string; items?: string }[]).map((row) => ({
          title: String(row.title || ''),
          company: String(row.company || ''),
          items: String(row.items || ''),
        }))
      : [];
    const degrees = Array.isArray(d.degrees)
      ? (d.degrees as { title?: string; school?: string; items?: string }[]).map((row) => ({
          title: String(row.title || ''),
          school: String(row.school || ''),
          items: String(row.items || ''),
        }))
      : [];
    const activity_images = Array.isArray(d.activity_images)
      ? (d.activity_images as { id?: number; media?: never }[]).map((row, i) => ({
          key: `act-${row.id ?? i}`,
          image: emptyImageField(row.media ?? null),
        }))
      : [];

    const next: FormState = {
      name: String(d.name || ''),
      role: String(d.role || ''),
      department: String(d.department || ''),
      short_bio: String(d.short_bio || ''),
      bio_html: String(d.bio_html || ''),
      phone: String(d.phone || ''),
      email: String(d.email || ''),
      area: String(d.area || ''),
      years_experience: String(d.years_experience || 0),
      languages: String(d.languages || ''),
      sort: String(d.sort || 0),
      is_active: !!d.is_active,
      show_on_home: !!d.show_on_home,
      is_verified: !!d.is_verified,
      stat_clients: String(d.stat_clients || 0),
      stat_tours: String(d.stat_tours || 0),
      stat_awards: String(d.stat_awards || 0),
      seo_slug: String(seo?.slug || ''),
      seo_title: String(seo?.title || ''),
      seo_description: String(seo?.description || ''),
      seo_parent_id: seo?.parent_id ? String(seo.parent_id) : '',
      avatar: emptyImageField(d.avatar as never),
      achievements,
      skills,
      experiences,
      degrees,
      activity_images,
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data, locale]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        role: form.role || null,
        department: form.department || null,
        short_bio: form.short_bio || null,
        bio_html: form.bio_html || null,
        phone: form.phone || null,
        email: form.email || null,
        area: form.area || null,
        years_experience: Number(form.years_experience) || 0,
        languages: form.languages,
        sort: Number(form.sort) || 0,
        is_active: form.is_active,
        show_on_home: form.show_on_home,
        is_verified: form.is_verified,
        stat_clients: Number(form.stat_clients) || 0,
        stat_tours: Number(form.stat_tours) || 0,
        stat_awards: Number(form.stat_awards) || 0,
        seo_slug: form.seo_slug || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_parent_id: form.seo_parent_id ? Number(form.seo_parent_id) : null,
        avatar_media_id: form.avatar.media?.id ?? null,
        remove_avatar: form.avatar.remove,
        achievements: form.achievements,
        skills: form.skills.map((s) => ({
          skill: s.skill,
          percent: Number(s.percent) || 0,
        })),
        experiences: form.experiences,
        degrees: form.degrees,
        activity_media_ids: form.activity_images
          .map((row) => row.image.media?.id)
          .filter((mid): mid is number => typeof mid === 'number' && mid > 0),
        locale,
      };
      return isNew ? teamMembersApi.create(payload) : teamMembersApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo thành viên' : 'Đã lưu thành viên');
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: ['team-members'] });
      replaceFormUrl(
        router,
        `/brand/team/form/?id=${(data as { id: number }).id}&locale=${locale}`,
      );
      snapshotRef.current = JSON.stringify(form);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const languages =
    asLocaleOptions(metaQuery.data?.languages) ??
    ([] as LocaleOption[]);

  const seoParents = (metaQuery.data?.seo_parents as SeoParentOption[] | undefined) ?? [];

  const defaultLocale = String(
    metaQuery.data?.default_locale
    || (detailQuery.data as { default_locale?: string } | undefined)?.default_locale
    || DEFAULT_LOCALE
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'team_member',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await teamMembersApi.get(id, defaultLocale)) as Record<string, any>;
      const seo = d.seo || {};
      return pickTranslatableFields({
        name: d.name || '',
        position: d.position || '',
        short_bio: d.short_bio || '',
        full_bio: d.full_bio || '',
        seo_slug: seo.slug || '',
        seo_title: seo.title || '',
        seo_description: seo.description || '',
      });
    },
    applyFields: (fields) =>
      setForm((prev) =>
        mergeTranslatedFields(prev as unknown as Record<string, unknown>, fields) as typeof prev,
      ),
  });

  return (
    <StructureLockProvider
      locked={structureLocked}
      locale={locale}
      defaultLocale={defaultLocale}
      seoParentId={form.seo_parent_id}
      seoParents={seoParents}
    >
    <div>
        <PageHeader
          eyebrow="Thương hiệu"
        title={isNew ? 'Thêm thành viên' : 'Sửa thành viên'}
        id={isNew ? null : id}
        actions={
          <HeadActions
            secondary={
              <HeadSecondary
                href="/brand/team/"
                icon={ArrowLeft}
                title="Quay lại"
                subtitle="Danh sách đội ngũ"
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
          <SeoBox
            value={{
              seo_title: form.seo_title,
              seo_slug: form.seo_slug,
              seo_description: form.seo_description,
              seo_parent_id: form.seo_parent_id,
            }}
            onChange={(key, v) => setForm((prev) => ({ ...prev, [key]: v }))}
            parents={seoParents}
          />

          <FormSection
            icon={UserRound}
            title="Hồ sơ"
            description="Thông tin cơ bản hiển thị trên trang nhân sự."
          >
            <FormCluster>
              <Input label="Họ tên" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              <Input label="Vai trò" value={form.role} onChange={(e) => set('role', e.target.value)} />
              <Input
                label="Phòng ban"
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
              />
              <Input
                label="Thứ tự"
                type="number"
                value={form.sort}
                onChange={(e) => set('sort', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>
            <FormCluster>
              <Input label="Điện thoại" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={structureLocked} />
              <Input label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={structureLocked} />
              <Input label="Khu vực" value={form.area} onChange={(e) => set('area', e.target.value)} />
              <Input
                label="Số năm kinh nghiệm"
                type="number"
                value={form.years_experience}
                onChange={(e) => set('years_experience', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>
            <Textarea
              label="Giới thiệu ngắn"
              value={form.short_bio}
              onChange={(e) => set('short_bio', e.target.value)}
            />
            <Textarea
              label="Giới thiệu chi tiết (HTML)"
              value={form.bio_html}
              onChange={(e) => set('bio_html', e.target.value)}
            />
            <Textarea
              label="Ngôn ngữ nói (mỗi dòng)"
              value={form.languages}
              onChange={(e) => set('languages', e.target.value)}
            />
            <div className="ui-form-flags">
              <Switch
                label="Đang hoạt động"
                checked={form.is_active}
                onChange={(v) => set('is_active', v)}
              />
              <Switch
                label="Hiện trang chủ"
                checked={form.show_on_home}
                onChange={(v) => set('show_on_home', v)}
              />
              <Switch
                label="Đã xác minh"
                checked={form.is_verified}
                onChange={(v) => set('is_verified', v)}
              />
            </div>
          </FormSection>

          <FormSection
            icon={Sparkles}
            title="Thống kê nổi bật"
            description="Số liệu trên đầu trang hồ sơ (Khách / Tour / Giải thưởng)."
          >
            <FormCluster>
              <Input
                label="Khách đồng hành"
                type="number"
                value={form.stat_clients}
                onChange={(e) => set('stat_clients', e.target.value)}
              />
              <Input
                label="Tour dẫn dắt"
                type="number"
                value={form.stat_tours}
                onChange={(e) => set('stat_tours', e.target.value)}
              />
              <Input
                label="Giải thưởng"
                type="number"
                value={form.stat_awards}
                onChange={(e) => set('stat_awards', e.target.value)}
              />
            </FormCluster>
          </FormSection>

          <FormSection
            icon={Award}
            title="Thành tích nổi bật"
            description="Danh sách bullet trên public."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('achievements', [...form.achievements, emptyAchievement()])}
              >
                <Plus size={16} /> Thêm thành tích
              </Button>
            }
          >
            <Repeater
              items={form.achievements}
              onChange={(items) => set('achievements', items)}
              createItem={emptyAchievement}
              addLabel="Thêm thành tích"
              emptyHint="Chưa có thành tích."
              renderItem={(row, _i, { update }) => (
                <Textarea
                  label="Nội dung"
                  value={row.content}
                  onChange={(e) => update({ content: e.target.value })}
                />
              )}
            />
          </FormSection>

          <FormSection
            icon={Sparkles}
            title="Kỹ năng chuyên môn"
            description="Tên kỹ năng + mức %."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('skills', [...form.skills, emptySkill()])}
              >
                <Plus size={16} /> Thêm kỹ năng
              </Button>
            }
          >
            <Repeater
              items={form.skills}
              onChange={(items) => set('skills', items)}
              createItem={emptySkill}
              addLabel="Thêm kỹ năng"
              emptyHint="Chưa có kỹ năng."
              renderItem={(row, _i, { update }) => (
                <div className="ui-form-grid ui-form-grid--2">
                  <Input
                    label="Kỹ năng"
                    value={row.skill}
                    onChange={(e) => update({ skill: e.target.value })}
                  />
                  <Input
                    label="Mức (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={row.percent}
                    onChange={(e) => update({ percent: e.target.value })}
                  />
                </div>
              )}
            />
          </FormSection>

          <FormSection
            icon={GraduationCap}
            title="Bằng cấp & chứng chỉ"
            description="Mỗi mục: tên bằng / trường / ghi chú (mỗi dòng)."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('degrees', [...form.degrees, emptyDegree()])}
              >
                <Plus size={16} /> Thêm bằng cấp
              </Button>
            }
          >
            <Repeater
              items={form.degrees}
              onChange={(items) => set('degrees', items)}
              createItem={emptyDegree}
              addLabel="Thêm bằng cấp"
              emptyHint="Chưa có bằng cấp / chứng chỉ."
              renderItem={(row, _i, { update }) => (
                <div className="ui-form-grid">
                  <Input
                    label="Tên bằng / chứng chỉ"
                    value={row.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <Input
                    label="Trường / đơn vị cấp"
                    value={row.school}
                    onChange={(e) => update({ school: e.target.value })}
                  />
                  <Textarea
                    label="Chi tiết (mỗi dòng)"
                    value={row.items}
                    onChange={(e) => update({ items: e.target.value })}
                  />
                </div>
              )}
            />
          </FormSection>

          <FormSection
            icon={Briefcase}
            title="Kinh nghiệm làm việc"
            description="Chức danh, công ty và mô tả công việc (mỗi dòng)."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('experiences', [...form.experiences, emptyExp()])}
              >
                <Plus size={16} /> Thêm kinh nghiệm
              </Button>
            }
          >
            <Repeater
              items={form.experiences}
              onChange={(items) => set('experiences', items)}
              createItem={emptyExp}
              addLabel="Thêm kinh nghiệm"
              emptyHint="Chưa có kinh nghiệm."
              renderItem={(row, _i, { update }) => (
                <div className="ui-form-grid">
                  <Input
                    label="Chức danh"
                    value={row.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <Input
                    label="Công ty"
                    value={row.company}
                    onChange={(e) => update({ company: e.target.value })}
                  />
                  <Textarea
                    label="Mô tả (mỗi dòng một ý)"
                    value={row.items}
                    onChange={(e) => update({ items: e.target.value })}
                  />
                </div>
              )}
            />
          </FormSection>

          <FormSection
            icon={Images}
            title="Hình ảnh hoạt động"
            description="Gallery ảnh trên trang hồ sơ public."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => set('activity_images', [...form.activity_images, emptyActivity()])}
              >
                <Plus size={16} /> Thêm ảnh
              </Button>
            }
          >
            <Repeater
              items={form.activity_images}
              onChange={(items) => set('activity_images', items)}
              createItem={emptyActivity}
              addLabel="Thêm ảnh"
              emptyHint="Chưa có hình ảnh hoạt động."
              keyOf={(row) => row.key}
              renderItem={(row, _i, { update }) => (
                <ImageField
                  ariaLabel="Ảnh hoạt động"
                  folder="team"
                  slug={form.seo_slug || form.name}
                  role="activity"
                  aspectRatio="4 / 3"
                  variant="card"
                  value={row.image}
                  onChange={(v) => update({ image: v })}
                />
              )}
            />
          </FormSection>

          <FormFooter
            cancelHref="/brand/team/"
            loading={save.isPending}
            viewHref={publicPageUrl(
              (detailQuery.data as { seo?: { slug_full?: string } } | undefined)?.seo?.slug_full,
              locale,
            )}
          />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện nhân sự"
              folder="team"
              slug={form.seo_slug || form.name}
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
    </StructureLockProvider>
  );
}

export default function TeamFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
