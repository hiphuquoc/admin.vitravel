'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { FormSection } from '@/components/ui/FormSection';
import type { StayRoomFormRow } from '@/lib/aiEnrichFields';

type StayAttrs = {
  property_type?: string;
  check_in?: string;
  check_out?: string;
  amenities?: string;
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
  nearby_json?: string;
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
  onChangeAttrs: (next: StayAttrs) => void;
  onChangeOptions: (next: StayRoomFormRow[]) => void;
  onChangeStarRating: (v: string) => void;
  onChangeDiscountBadge: (v: string) => void;
};

const emptyRoom = (): StayRoomFormRow => ({
  name: '',
  description: '',
  price_from: '',
  capacity: 2,
  bed_label: '',
  size_sqm: null,
  view: '',
  amenities: '',
  unit_type: '',
  bathroom_count: null,
  bedroom_count: null,
  smoking: '',
  highlights: '',
  beds_json: '',
  amenity_groups_json: '',
  photos_json: '',
});

export function StayProductFields({
  attrs,
  options,
  starRating,
  discountBadge,
  propertyTypes,
  onChangeAttrs,
  onChangeOptions,
  onChangeStarRating,
  onChangeDiscountBadge,
}: Props) {
  const setAttr = <K extends keyof StayAttrs>(key: K, value: StayAttrs[K]) =>
    onChangeAttrs({ ...attrs, [key]: value });

  const setRoom = (index: number, patch: Partial<StayRoomFormRow>) => {
    const next = [...options];
    next[index] = { ...next[index], ...patch };
    onChangeOptions(next);
  };

  return (
    <>
      <FormSection title="Thông tin lưu trú" description="Hạng sao, loại hình, check-in/out — hiển thị Booking-style trên public.">
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
        </div>
        <Textarea
          label="Tiện ích nổi bật (danh sách phẳng)"
          hint="Mỗi dòng một tiện ích. Crawler nên gửi thêm amenity_groups JSON bên dưới."
          value={attrs.amenities || ''}
          onChange={(e) => setAttr('amenities', e.target.value)}
          rows={5}
        />
        <Textarea
          label="Badge nổi bật (header)"
          hint="Mỗi dòng — hiện dạng pill dưới tên chỗ nghỉ (Beachfront, Hồ bơi riêng…)"
          value={attrs.highlight_badges || ''}
          onChange={(e) => setAttr('highlight_badges', e.target.value)}
          rows={3}
        />
        <Input
          label="Địa chỉ đầy đủ"
          value={attrs.address || ''}
          onChange={(e) => setAttr('address', e.target.value)}
        />
      </FormSection>

      <FormSection
        title="Hạng phòng"
        description="Giá / đêm tham khảo — hiển thị dạng thẻ phòng trên trang chi tiết."
      >
        <div className="ui-repeater">
          {options.map((room, i) => (
            <div key={room.id ?? `new-${i}`} className="ui-repeater__card">
              <div className="ui-form-grid ui-form-grid--2">
                <Input
                  label="Tên hạng phòng"
                  value={room.name}
                  onChange={(e) => setRoom(i, { name: e.target.value })}
                />
                <Input
                  label="Mã"
                  value={room.code || ''}
                  onChange={(e) => setRoom(i, { code: e.target.value })}
                />
                <Input
                  label="Giá từ (đ/đêm)"
                  type="number"
                  value={room.price_from != null ? String(room.price_from) : ''}
                  onChange={(e) => setRoom(i, { price_from: e.target.value })}
                />
                <Input
                  label="Sức chứa"
                  type="number"
                  value={room.capacity != null ? String(room.capacity) : ''}
                  onChange={(e) => setRoom(i, { capacity: Number(e.target.value) || null })}
                />
                <Input
                  label="Giường"
                  value={room.bed_label || ''}
                  onChange={(e) => setRoom(i, { bed_label: e.target.value })}
                />
                <Input
                  label="Diện tích (m²)"
                  type="number"
                  value={room.size_sqm != null ? String(room.size_sqm) : ''}
                  onChange={(e) => setRoom(i, { size_sqm: Number(e.target.value) || null })}
                />
                <Input
                  label="View"
                  value={room.view || ''}
                  onChange={(e) => setRoom(i, { view: e.target.value })}
                />
                <Select
                  label="Loại đơn vị"
                  value={room.unit_type || ''}
                  options={[
                    { value: '', label: '— Không gắn —' },
                    { value: 'hotel_room', label: 'Phòng khách sạn' },
                    { value: 'entire_apartment', label: 'Căn hộ nguyên căn' },
                    { value: 'entire_villa', label: 'Villa nguyên căn' },
                    { value: 'entire_place', label: 'Nguyên căn' },
                    { value: 'private_room', label: 'Phòng riêng' },
                    { value: 'bungalow', label: 'Bungalow' },
                    { value: 'tent', label: 'Lều' },
                    { value: 'cabin', label: 'Cabin' },
                  ]}
                  onChange={(v) => setRoom(i, { unit_type: v })}
                />
                <Input
                  label="Số phòng tắm"
                  type="number"
                  value={room.bathroom_count != null ? String(room.bathroom_count) : ''}
                  onChange={(e) => setRoom(i, { bathroom_count: Number(e.target.value) || null })}
                />
                <Input
                  label="Số phòng ngủ"
                  type="number"
                  value={room.bedroom_count != null ? String(room.bedroom_count) : ''}
                  onChange={(e) => setRoom(i, { bedroom_count: Number(e.target.value) || null })}
                />
                <Input
                  label="Hút thuốc"
                  hint="VD: Không hút thuốc"
                  value={room.smoking || ''}
                  onChange={(e) => setRoom(i, { smoking: e.target.value })}
                />
              </div>
              <Textarea
                label="Mô tả đầy đủ (overlay chi tiết phòng)"
                value={room.description || ''}
                onChange={(e) => setRoom(i, { description: e.target.value })}
                rows={3}
              />
              <Textarea
                label="Tiện ích phòng (danh sách phẳng)"
                hint="Mỗi dòng một tiện ích"
                value={room.amenities || ''}
                onChange={(e) => setRoom(i, { amenities: e.target.value })}
                rows={2}
              />
              <Textarea
                label="Badge nổi bật phòng"
                hint="Mỗi dòng — hiện trên thẻ + overlay"
                value={room.highlights || ''}
                onChange={(e) => setRoom(i, { highlights: e.target.value })}
                rows={2}
              />
              <Textarea
                label="Bố trí giường (JSON)"
                hint='[{"name":"Phòng ngủ 1","items":[{"label":"1 giường đôi cực lớn","type":"king","count":1}]}]'
                value={room.beds_json || ''}
                onChange={(e) => setRoom(i, { beds_json: e.target.value })}
                rows={4}
              />
              <Textarea
                label="Tiện nghi phòng theo nhóm (JSON)"
                hint='{"kitchen":["Mặt bếp"],"bathroom":["Máy sấy tóc"],"view":["Nhìn ra biển"]}'
                value={room.amenity_groups_json || ''}
                onChange={(e) => setRoom(i, { amenity_groups_json: e.target.value })}
                rows={5}
              />
              <Textarea
                label="Ảnh hạng phòng (JSON)"
                hint='[{"url":"https://…","alt":"Ban công"}] — hiện gallery trên card + overlay khi có URL thật, không seed ảnh giả'
                value={room.photos_json || ''}
                onChange={(e) => setRoom(i, { photos_json: e.target.value })}
                rows={3}
              />
              <button
                type="button"
                className="ui-repeater__remove"
                onClick={() => onChangeOptions(options.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={15} /> Xóa hạng phòng
              </button>
            </div>
          ))}
          <button type="button" className="ui-repeater__add" onClick={() => onChangeOptions([...options, emptyRoom()])}>
            <Plus size={16} /> Thêm hạng phòng
          </button>
        </div>
      </FormSection>

      <FormSection title="Chính sách & vị trí" description="Hiển thị tab Chính sách / Vị trí trên trang public.">
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
            hint="Visa, Mastercard, JCB — cách nhau bằng dấu phẩy hoặc xuống dòng"
            value={attrs.payment_cards || ''}
            onChange={(e) => setAttr('payment_cards', e.target.value)}
          />
          <Textarea
            label="Giấy tờ check-in"
            value={attrs.id_required_policy || ''}
            onChange={(e) => setAttr('id_required_policy', e.target.value)}
            rows={2}
          />
          <Textarea
            label="Điểm lân cận (JSON)"
            hint='[{"name":"Sân bay","distance":"20 phút","icon":"plane","category":"transport"}]'
            value={attrs.nearby_json || ''}
            onChange={(e) => setAttr('nearby_json', e.target.value)}
            rows={4}
          />
          <Textarea
            label="Lân cận theo nhóm (JSON crawler)"
            hint='{"landmark":[{"name":"…","distance":"500 m"}],"beach":[],"transport":[]}'
            value={attrs.nearby_groups_json || ''}
            onChange={(e) => setAttr('nearby_groups_json', e.target.value)}
            rows={4}
          />
          <Textarea
            label="Tiện ích theo nhóm (JSON crawler)"
            hint='{"bathroom":["…"],"kitchen":["…"],"view":["…"]} — key theo config/stay.php'
            value={attrs.amenity_groups_json || ''}
            onChange={(e) => setAttr('amenity_groups_json', e.target.value)}
            rows={6}
          />
          <Textarea
            label="Điểm đánh giá theo hạng mục (JSON)"
            hint='{"staff":8.6,"facilities":8.2,"cleanliness":8.8,"comfort":8.5,"value":8.1,"location":9,"wifi":8}'
            value={attrs.review_scores_json || ''}
            onChange={(e) => setAttr('review_scores_json', e.target.value)}
            rows={3}
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

function parseJsonObject(raw?: string): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function stayAttrsFromApi(raw: Record<string, unknown> | null | undefined): StayAttrs {
  const attrs = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nearby = attrs.nearby;

  return {
    property_type: String(attrs.property_type || 'hotel'),
    check_in: String(attrs.check_in || '15:00'),
    check_out: String(attrs.check_out || '12:00'),
    amenities: linesFrom(attrs.amenities),
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
    nearby_json: nearby ? JSON.stringify(nearby, null, 2) : '',
    nearby_groups_json: prettyJson(attrs.nearby_groups),
    amenity_groups_json: prettyJson(attrs.amenity_groups),
    review_scores_json: prettyJson(attrs.review_scores),
  };
}

export function stayAttrsToApi(attrs: StayAttrs): Record<string, unknown> {
  let nearby: unknown[] = [];
  if (attrs.nearby_json?.trim()) {
    try {
      const parsed = JSON.parse(attrs.nearby_json);
      if (Array.isArray(parsed)) nearby = parsed;
    } catch {
      nearby = [];
    }
  }

  const payload: Record<string, unknown> = {
    property_type: attrs.property_type || 'hotel',
    check_in: attrs.check_in || '15:00',
    check_out: attrs.check_out || '12:00',
    amenities: attrs.amenities
      ? attrs.amenities.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
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
    nearby,
  };

  const amenityGroups = parseJsonObject(attrs.amenity_groups_json);
  if (amenityGroups) payload.amenity_groups = amenityGroups;
  const nearbyGroups = parseJsonObject(attrs.nearby_groups_json);
  if (nearbyGroups) payload.nearby_groups = nearbyGroups;
  const reviewScores = parseJsonObject(attrs.review_scores_json);
  if (reviewScores) payload.review_scores = reviewScores;

  return payload;
}
