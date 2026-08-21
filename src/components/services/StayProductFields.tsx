'use client';

import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { ArticleContentEditor } from '@/components/editor/ArticleContentEditor';
import { FormSection } from '@/components/ui/FormSection';
import type { StayRoomFormRow } from '@/lib/aiEnrichFields';
import { StayRoomsEditor } from '@/components/services/StayRoomsEditor';
import {
  StayAmenityGroupsEditor,
  StayNearbyGroupsEditor,
  StayReviewScoresEditor,
} from '@/components/services/StayStructuredAttrsEditors';

type StayAttrs = {
  property_type?: string;
  check_in?: string;
  check_out?: string;
  highlight_badges?: string;
  address?: string;
  cancellation_policy?: string;
  child_policy?: string;
  extra_bed_policy?: string;
  age_restriction?: string;
  pet_policy?: string;
  smoking_policy?: string;
  payment_policy?: string;
  payment_cards?: string;
  id_required_policy?: string;
  nearby_groups_json?: string;
  amenity_groups_json?: string;
  review_scores_json?: string;
};

type Props = {
  attrs: StayAttrs;
  options: StayRoomFormRow[];
  starRating: string;
  discountBadge: string;
  propertyTypes: { value: string; label: string }[];
  content: string;
  contentEditorKey: string;
  isFeatured: boolean;
  isHotDeal: boolean;
  serviceId?: number | null;
  locale?: string;
  dealLabels?: { value: string; label: string }[];
  onChangeAttrs: (next: StayAttrs) => void;
  onChangeOptions: (next: StayRoomFormRow[]) => void;
  onChangeStarRating: (v: string) => void;
  onChangeDiscountBadge: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeFeatured: (v: boolean) => void;
  onChangeHotDeal: (v: boolean) => void;
};

export function StayProductFields({
  attrs,
  options,
  starRating,
  discountBadge,
  propertyTypes,
  content,
  contentEditorKey,
  isFeatured,
  isHotDeal,
  serviceId,
  locale = 'vi',
  dealLabels = [],
  onChangeAttrs,
  onChangeOptions,
  onChangeStarRating,
  onChangeDiscountBadge,
  onChangeContent,
  onChangeFeatured,
  onChangeHotDeal,
}: Props) {
  const setAttr = <K extends keyof StayAttrs>(key: K, value: StayAttrs[K]) =>
    onChangeAttrs({ ...attrs, [key]: value });

  return (
    <>
      <FormSection title="Thông tin lưu trú" description="Hạng sao, loại hình, giới thiệu và badge nổi bật.">
        <div className="ui-form-grid ui-form-grid--2">
          <Select
            label="Hạng sao"
            value={starRating}
            options={[
              { value: '', label: '— Không hiển thị —' },
              ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} sao` })),
            ]}
            onChange={onChangeStarRating}
          />
          <Select
            label="Loại hình"
            value={attrs.property_type || 'hotel'}
            options={propertyTypes.length ? propertyTypes : [{ value: 'hotel', label: 'Khách sạn' }]}
            onChange={(v) => setAttr('property_type', v)}
          />
          <Input
            label="Nhận phòng"
            hint="VD: 15:00"
            value={attrs.check_in || '15:00'}
            onChange={(e) => setAttr('check_in', e.target.value)}
          />
          <Input
            label="Trả phòng"
            hint="VD: 12:00"
            value={attrs.check_out || '12:00'}
            onChange={(e) => setAttr('check_out', e.target.value)}
          />
          <Input
            label="Badge ưu đãi"
            hint="VD: Resort 5★, View vịnh"
            value={discountBadge}
            onChange={(e) => onChangeDiscountBadge(e.target.value)}
          />
          <Input
            label="Địa chỉ đầy đủ"
            value={attrs.address || ''}
            onChange={(e) => setAttr('address', e.target.value)}
          />
        </div>
        <Textarea
          label="Badge nổi bật (header)"
          hint="Mỗi dòng — pill dưới tên chỗ nghỉ trên public"
          value={attrs.highlight_badges || ''}
          onChange={(e) => setAttr('highlight_badges', e.target.value)}
          rows={3}
        />
        <ArticleContentEditor
          key={contentEditorKey}
          label="Giới thiệu chỗ nghỉ (HTML)"
          hint="Tab «Về chỗ nghỉ» trên trang public — AI luồng property ghi vào đây."
          format="html"
          compact
          aiFieldKey="content"
          value={content}
          onChange={onChangeContent}
        />
        <div className="ui-form-flags">
          <Switch label="Nổi bật" checked={isFeatured} onChange={onChangeFeatured} />
          <Switch label="Ưu đãi hot" checked={isHotDeal} onChange={onChangeHotDeal} />
        </div>
      </FormSection>

      <FormSection
        title="Tiện ích theo nhóm"
        description="Thẻ theo nhóm — bấm để mở drawer sửa danh sách tiện ích."
      >
        <StayAmenityGroupsEditor
          value={attrs.amenity_groups_json || ''}
          onChange={(amenity_groups_json) => setAttr('amenity_groups_json', amenity_groups_json)}
        />
      </FormSection>

      <FormSection
        title="Lân cận theo nhóm"
        description="Địa danh / biển / giao thông… — bấm thẻ để sửa điểm trong nhóm."
      >
        <StayNearbyGroupsEditor
          value={attrs.nearby_groups_json || ''}
          onChange={(nearby_groups_json) => setAttr('nearby_groups_json', nearby_groups_json)}
        />
      </FormSection>

      <FormSection
        title="Điểm đánh giá theo hạng mục"
        description="Tag chuẩn (staff, wifi…) + điểm 0–10 — sẵn sàng cho filter listing sau này."
      >
        <StayReviewScoresEditor
          value={attrs.review_scores_json || ''}
          onChange={(review_scores_json) => setAttr('review_scores_json', review_scores_json)}
        />
      </FormSection>

      <FormSection
        title="Hạng phòng"
        description="Danh sách dạng thẻ thông tin (giống public). Sửa / copy / xóa — nhấn Sửa hoặc thẻ để mở drawer."
      >
        <StayRoomsEditor
          options={options}
          onChange={onChangeOptions}
          serviceId={serviceId}
          locale={locale}
          dealLabels={dealLabels}
        />
      </FormSection>

      <FormSection title="Chính sách" description="Tab Chính sách trên trang public.">
        <div className="ui-form-grid ui-form-grid--1">
          <Textarea
            label="Huỷ / đổi ngày"
            value={attrs.cancellation_policy || ''}
            onChange={(e) => setAttr('cancellation_policy', e.target.value)}
            rows={2}
          />
          <Textarea
            label="Trẻ em"
            value={attrs.child_policy || ''}
            onChange={(e) => setAttr('child_policy', e.target.value)}
            rows={2}
          />
          <Textarea
            label="Giường phụ / cũi"
            value={attrs.extra_bed_policy || ''}
            onChange={(e) => setAttr('extra_bed_policy', e.target.value)}
            rows={2}
          />
          <Input
            label="Độ tuổi tối thiểu"
            hint="VD: 18"
            value={attrs.age_restriction || ''}
            onChange={(e) => setAttr('age_restriction', e.target.value)}
          />
          <Textarea
            label="Thú cưng"
            value={attrs.pet_policy || ''}
            onChange={(e) => setAttr('pet_policy', e.target.value)}
            rows={2}
          />
          <Input
            label="Hút thuốc"
            value={attrs.smoking_policy || ''}
            onChange={(e) => setAttr('smoking_policy', e.target.value)}
          />
          <Textarea
            label="Thanh toán"
            value={attrs.payment_policy || ''}
            onChange={(e) => setAttr('payment_policy', e.target.value)}
            rows={2}
          />
          <Input
            label="Thẻ được nhận"
            hint="Visa, Mastercard — cách nhau bằng dấu phẩy hoặc xuống dòng"
            value={attrs.payment_cards || ''}
            onChange={(e) => setAttr('payment_cards', e.target.value)}
          />
          <Textarea
            label="Giấy tờ check-in"
            value={attrs.id_required_policy || ''}
            onChange={(e) => setAttr('id_required_policy', e.target.value)}
            rows={2}
          />
        </div>
      </FormSection>
    </>
  );
}

function linesFrom(value: unknown): string {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean).join('\n');
  return value == null ? '' : String(value);
}

function prettyJson(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function parseJsonValue(raw?: string): unknown {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function stayAttrsFromApi(raw: Record<string, unknown> | null | undefined): StayAttrs {
  const attrs = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  return {
    property_type: String(attrs.property_type || 'hotel'),
    check_in: String(attrs.check_in || '15:00'),
    check_out: String(attrs.check_out || '12:00'),
    highlight_badges: linesFrom(attrs.highlight_badges ?? attrs.most_popular),
    address: String(attrs.address || ''),
    cancellation_policy: String(attrs.cancellation_policy || ''),
    child_policy: String(attrs.child_policy || ''),
    extra_bed_policy: String(attrs.extra_bed_policy || ''),
    age_restriction: String(attrs.age_restriction || ''),
    pet_policy: String(attrs.pet_policy || ''),
    smoking_policy: String(attrs.smoking_policy || ''),
    payment_policy: String(attrs.payment_policy || ''),
    payment_cards: linesFrom(attrs.payment_cards),
    id_required_policy: String(attrs.id_required_policy || ''),
    nearby_groups_json: prettyJson(attrs.nearby_groups),
    amenity_groups_json: prettyJson(attrs.amenity_groups),
    review_scores_json: prettyJson(attrs.review_scores),
  };
}

export function stayAttrsToApi(attrs: StayAttrs): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    property_type: attrs.property_type || 'hotel',
    check_in: attrs.check_in || '15:00',
    check_out: attrs.check_out || '12:00',
    highlight_badges: attrs.highlight_badges
      ? attrs.highlight_badges.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    address: attrs.address || '',
    cancellation_policy: attrs.cancellation_policy || '',
    child_policy: attrs.child_policy || '',
    extra_bed_policy: attrs.extra_bed_policy || '',
    age_restriction: attrs.age_restriction || '',
    pet_policy: attrs.pet_policy || '',
    smoking_policy: attrs.smoking_policy || '',
    payment_policy: attrs.payment_policy || '',
    payment_cards: attrs.payment_cards
      ? attrs.payment_cards.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
      : [],
    id_required_policy: attrs.id_required_policy || '',
  };

  const amenityGroupsRaw = attrs.amenity_groups_json?.trim() || '';
  const nearbyGroupsRaw = attrs.nearby_groups_json?.trim() || '';
  const reviewScoresRaw = attrs.review_scores_json?.trim() || '';

  if (amenityGroupsRaw) {
    const parsed = parseJsonValue(amenityGroupsRaw);
    payload.amenity_groups = parsed !== undefined ? parsed : amenityGroupsRaw;
  }
  if (nearbyGroupsRaw) {
    const parsed = parseJsonValue(nearbyGroupsRaw);
    payload.nearby_groups = parsed !== undefined ? parsed : nearbyGroupsRaw;
  }
  if (reviewScoresRaw) {
    const parsed = parseJsonValue(reviewScoresRaw);
    payload.review_scores = parsed !== undefined ? parsed : reviewScoresRaw;
  }

  return payload;
}
