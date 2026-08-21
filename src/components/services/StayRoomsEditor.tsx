'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble,
  CircleHelp,
  Copy,
  Eye,
  Maximize2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from '@/lib/toast';
import { ApiClientError } from '@/lib/api';
import { servicesApi } from '@/lib/services';
import type { StayRoomFormRow } from '@/lib/aiEnrichFields';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { StayAmenityGroupsEditor } from '@/components/services/StayStructuredAttrsEditors';

const UNIT_TYPE_OPTIONS = [
  { value: '', label: '— Không gắn —' },
  { value: 'hotel_room', label: 'Phòng khách sạn' },
  { value: 'entire_apartment', label: 'Căn hộ nguyên căn' },
  { value: 'entire_villa', label: 'Villa nguyên căn' },
  { value: 'entire_place', label: 'Nguyên căn' },
  { value: 'private_room', label: 'Phòng riêng' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'tent', label: 'Lều' },
  { value: 'cabin', label: 'Cabin' },
];

const UNIT_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

export function emptyStayRoom(): StayRoomFormRow {
  return {
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
    rate_options_json: '',
    comfort_score: null,
    comfort_reviews: null,
    scarcity: '',
    scarcity_active: false,
    deal_key: 'seasonal',
    room_id: '',
    hash: '',
    crawl_dates_json: '',
  };
}

type Props = {
  options: StayRoomFormRow[];
  onChange: (next: StayRoomFormRow[]) => void;
  /** Khi có id — copy/xóa/áp dụng drawer gọi API ngay. */
  serviceId?: number | null;
  locale?: string;
  dealLabels?: { value: string; label: string }[];
};

function parsePhotos(json?: string): { url: string; alt: string }[] {
  try {
    const raw = JSON.parse(json || '[]');
    if (!Array.isArray(raw)) return [];
    const out: { url: string; alt: string }[] = [];
    for (const row of raw) {
      const url =
        typeof row === 'string'
          ? row
          : String((row as { url?: string; src?: string })?.url || (row as { src?: string })?.src || '');
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) continue;
      out.push({
        url,
        alt: typeof row === 'object' && row ? String((row as { alt?: string }).alt || '') : '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

type StayRateView = {
  key: string;
  priceLabel: string;
  strikeLabel: string;
  unit: string;
  taxesIncluded: boolean;
  savePercent: number | null;
  dealLabel: string;
  mealShort: string;
  mealTip: string;
  cancelShort: string;
  cancelTone: 'good' | 'bad' | 'neutral';
  cancelTip: string;
  prepayShort: string;
  prepayTip: string;
  deals: string[];
  dealsTip: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function shortText(value: string, max = 42): string {
  const t = value.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

function parseRates(json?: string, dealLabelMap: Record<string, string> = {}): StayRateView[] {
  try {
    const raw = JSON.parse(json || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((row, i) => {
      const r = asRecord(row);
      const breakfast = asRecord(r.breakfast);
      const cancellation = asRecord(r.cancellation);
      const prepayment = asRecord(r.prepayment);
      const night = Number(r.price_per_night ?? r.price ?? 0);
      const strike = Number(r.price_strikethrough ?? 0);
      const nights = Number(r.nights ?? 0);
      const total = Number(r.price ?? 0);
      const mealsDetail = Array.isArray(r.meals_detail)
        ? r.meals_detail.map((x) => String(x).trim()).filter(Boolean)
        : [];
      const deals = (Array.isArray(r.deals) ? r.deals : [])
        .map((d) => {
          if (typeof d === 'string') return d.trim();
          const obj = asRecord(d);
          return String(obj.title || obj.label || '').trim();
        })
        .filter(Boolean);

      let savePercent =
        typeof r.save_percent === 'number' ? r.save_percent : Number(r.save_percent) || null;
      if (!savePercent && total > 0 && strike > total) {
        savePercent = Math.round((1 - total / strike) * 100);
      } else if (!savePercent && night > 0 && strike > night) {
        savePercent = Math.round((1 - night / strike) * 100);
      }
      if (savePercent != null && (savePercent < 1 || savePercent > 95 || !Number.isFinite(savePercent))) {
        savePercent = null;
      }

      const dealKey = String(r.deal_key || '').trim();
      const dealLabel = dealKey
        ? dealLabelMap[dealKey] || dealKey
        : '';

      const breakfastIncluded = Boolean(breakfast.included);
      const mealLabel = String(breakfast.label || '').trim();
      const mealShort = breakfastIncluded
        ? shortText(mealLabel || 'Gồm bữa sáng', 36)
        : mealLabel
          ? shortText(mealLabel, 36)
          : 'Chỉ phòng';
      const mealTipParts = [
        breakfastIncluded ? 'Đã gồm bữa sáng' : 'Không gồm bữa sáng',
        mealLabel && mealLabel !== mealShort ? mealLabel : '',
        ...mealsDetail,
      ].filter(Boolean);

      const cancelTitle = String(cancellation.title || '').trim();
      const cancelDesc = String(cancellation.description || '').trim();
      const refundable =
        typeof cancellation.refundable === 'boolean' ? cancellation.refundable : null;
      let cancelShort = 'Huỷ';
      let cancelTone: StayRateView['cancelTone'] = 'neutral';
      if (refundable === true) {
        cancelShort = shortText(cancelTitle || 'Được hoàn tiền', 34);
        cancelTone = 'good';
      } else if (refundable === false) {
        cancelShort = shortText(cancelTitle || 'Không hoàn tiền', 34);
        cancelTone = 'bad';
      } else if (cancelTitle) {
        cancelShort = shortText(cancelTitle, 34);
      }
      const cancelTip = [cancelTitle, cancelDesc].filter(Boolean).join('\n') || cancelShort;

      const prepayTitle = String(prepayment.title || '').trim();
      const prepayDesc = String(prepayment.description || '').trim();
      const prepayShort = prepayTitle ? shortText(prepayTitle, 34) : '';
      const prepayTip = [prepayTitle, prepayDesc].filter(Boolean).join('\n');

      return {
        key: String(r.block_id || i),
        priceLabel: formatMoney(night > 0 ? night : null),
        strikeLabel: strike > night && strike > 0 ? formatMoney(strike) : '',
        unit: nights > 1 ? `/đêm · ${nights} đêm` : '/đêm',
        taxesIncluded: Boolean(r.taxes_included),
        savePercent,
        dealLabel,
        mealShort,
        mealTip: mealTipParts.join('\n'),
        cancelShort,
        cancelTone,
        cancelTip,
        prepayShort,
        prepayTip,
        deals: deals.slice(0, 2),
        dealsTip: deals.join('\n'),
      };
    });
  } catch {
    return [];
  }
}

function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

function highlightList(room: StayRoomFormRow): string[] {
  const lines = (room.highlights || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (room.size_sqm && !lines.some((t) => t.includes(String(room.size_sqm)))) {
    lines.unshift(`${room.size_sqm} m²`);
  }
  return lines.slice(0, 6);
}

function secondaryFactsTip(room: StayRoomFormRow): string {
  const parts: string[] = [];
  if (room.unit_type && UNIT_LABELS[room.unit_type]) parts.push(UNIT_LABELS[room.unit_type]);
  if (room.bathroom_count) parts.push(`${room.bathroom_count} phòng tắm`);
  if (room.bedroom_count) parts.push(`${room.bedroom_count} phòng ngủ`);
  if (room.smoking) parts.push(room.smoking);
  if (room.scarcity_active) parts.push('Scarcity động: Chúng tôi còn N căn (N=1–5)');
  else if (room.scarcity) parts.push(room.scarcity);
  if (room.deal_key) parts.push(`Ưu đãi: ${room.deal_key}`);
  if (room.comfort_score != null && Number(room.comfort_score) > 0) {
    parts.push(
      `Comfort ${Number(room.comfort_score).toFixed(1)}` +
        (room.comfort_reviews ? ` · ${room.comfort_reviews} đánh giá` : ''),
    );
  }
  return parts.join('\n');
}

function RateTip({ label, tip, tone }: { label: string; tip?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const className = [
    'ui-stay-rate__chip',
    tone === 'good' ? 'ui-stay-rate__chip--good' : '',
    tone === 'bad' ? 'ui-stay-rate__chip--bad' : '',
    tip && tip !== label ? 'ui-stay-rate__chip--has-tip' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!tip || tip === label) {
    return <span className={className}>{label}</span>;
  }

  return (
    <span className={className}>
      <span className="ui-stay-rate__chip-text">{label}</span>
      <button
        type="button"
        className="ui-stay-rate__tip"
        aria-label="Chi tiết"
        data-tip={tip}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <CircleHelp size={12} strokeWidth={2.25} aria-hidden />
      </button>
    </span>
  );
}

function cloneRoom(room: StayRoomFormRow, asCopy = false): StayRoomFormRow {
  const next: StayRoomFormRow = {
    ...room,
    id: null,
    code: room.code ? `${room.code}-copy` : '',
    name: asCopy ? `${room.name || 'Hạng phòng'} (bản sao)` : room.name,
  };
  return next;
}

function roomDirty(a: StayRoomFormRow, b: StayRoomFormRow): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function StayRoomsEditor({
  options,
  onChange,
  serviceId,
  locale = 'vi',
  dealLabels = [],
}: Props) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<StayRoomFormRow | null>(null);
  const [baseline, setBaseline] = useState<StayRoomFormRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const dealLabelMap = useMemo(
    () => Object.fromEntries(dealLabels.map((d) => [d.value, d.label])),
    [dealLabels],
  );

  const openEdit = (index: number) => {
    const row = options[index];
    if (!row) return;
    const snap = { ...row };
    setEditIndex(index);
    setDraft(snap);
    setBaseline(snap);
  };

  const closeDrawer = (force = false) => {
    if (!force && draft && baseline && roomDirty(draft, baseline)) {
      if (!window.confirm('Có thay đổi chưa áp dụng. Đóng drawer và bỏ qua?')) return;
    }
    setEditIndex(null);
    setDraft(null);
    setBaseline(null);
  };

  const patchDraft = (patch: Partial<StayRoomFormRow>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const applyLocal = (index: number, row: StayRoomFormRow) => {
    const next = [...options];
    next[index] = row;
    onChange(next);
  };

  const handleApply = async () => {
    if (editIndex == null || !draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error('Nhập tên hạng phòng.');
      return;
    }

    if (!serviceId) {
      applyLocal(editIndex, { ...draft, name });
      toast.success('Đã áp dụng vào form — nhớ Lưu chỗ nghỉ.');
      closeDrawer(true);
      return;
    }

    setSaving(true);
    try {
      const body = { ...draft, name, locale };
      const res = draft.id
        ? await servicesApi.updateOption(serviceId, draft.id, body)
        : await servicesApi.createOption(serviceId, body);
      applyLocal(editIndex, res.option);
      toast.success(draft.id ? 'Đã cập nhật hạng phòng' : 'Đã tạo hạng phòng');
      closeDrawer(true);
    } catch (e) {
      toast.error((e as ApiClientError).message || 'Không lưu được hạng phòng');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const room = emptyStayRoom();
    const next = [...options, room];
    onChange(next);
    const index = next.length - 1;
    setEditIndex(index);
    setDraft({ ...room });
    setBaseline({ ...room });
  };

  const handleCopy = async (index: number) => {
    const room = options[index];
    if (!room) return;
    const key = `copy-${index}`;
    setBusyKey(key);
    try {
      if (serviceId && room.id) {
        const res = await servicesApi.duplicateOption(serviceId, room.id, { locale });
        onChange([...options, res.option]);
        toast.success('Đã sao chép hạng phòng');
      } else {
        onChange([...options, cloneRoom(room, true)]);
        toast.success('Đã sao chép vào form — nhớ Lưu chỗ nghỉ.');
      }
    } catch (e) {
      toast.error((e as ApiClientError).message || 'Không sao chép được');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (index: number) => {
    const room = options[index];
    if (!room) return;
    const label = room.name || `hạng phòng #${index + 1}`;
    if (!window.confirm(`Xóa «${label}»?`)) return;

    const key = `del-${index}`;
    setBusyKey(key);
    try {
      if (serviceId && room.id) {
        await servicesApi.removeOption(serviceId, room.id);
      }
      onChange(options.filter((_, i) => i !== index));
      if (editIndex === index) closeDrawer(true);
      else if (editIndex != null && editIndex > index) setEditIndex(editIndex - 1);
      toast.success('Đã xóa hạng phòng');
    } catch (e) {
      toast.error((e as ApiClientError).message || 'Không xóa được');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="ui-stay-rooms">
      {options.length === 0 ? (
        <p className="ui-stay-rooms__empty">Chưa có hạng phòng. Thêm mới hoặc chạy crawler Booking.com.</p>
      ) : (
        <ul className="ui-stay-rooms__list">
          {options.map((room, i) => {
            const photos = parsePhotos(room.photos_json);
            const tags = highlightList(room);
            const rates = parseRates(room.rate_options_json, dealLabelMap);
            const roomDeal =
              room.deal_key && dealLabelMap[room.deal_key]
                ? dealLabelMap[room.deal_key]
                : room.deal_key || '';
            const price = formatMoney(room.price_from);
            const cover = photos[0];
            const moreTip = secondaryFactsTip(room);
            return (
              <li key={room.id ?? `new-${i}`} className="ui-stay-room-card">
                <div className="ui-stay-room-card__grid">
                  <div
                    className="ui-stay-room-card__info"
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEdit(i);
                      }
                    }}
                    aria-label={`Sửa ${room.name || 'hạng phòng'}`}
                  >
                    <div className="ui-stay-room-card__media" aria-hidden>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="ui-stay-room-card__media-empty">
                          <BedDouble size={22} strokeWidth={1.8} />
                        </span>
                      )}
                      {photos.length > 1 ? (
                        <span className="ui-stay-room-card__photo-count">{photos.length} ảnh</span>
                      ) : null}
                    </div>
                    <div className="ui-stay-room-card__body">
                      <div className="ui-stay-room-card__title-row">
                        <h4 className="ui-stay-room-card__title">{room.name || 'Chưa đặt tên'}</h4>
                        {room.code ? <code className="ui-stay-room-card__code">{room.code}</code> : null}
                        {moreTip ? (
                          <span
                            className="ui-stay-room-card__more"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="ui-stay-rate__tip"
                              aria-label="Thông tin thêm"
                              data-tip={moreTip}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <CircleHelp size={13} strokeWidth={2.25} aria-hidden />
                            </button>
                          </span>
                        ) : null}
                      </div>
                      <ul className="ui-stay-room-card__facts">
                        {room.capacity ? (
                          <li>
                            <Users size={13} /> {room.capacity} khách
                          </li>
                        ) : null}
                        {room.bed_label ? (
                          <li>
                            <BedDouble size={13} /> {room.bed_label}
                          </li>
                        ) : null}
                        {room.size_sqm ? (
                          <li>
                            <Maximize2 size={13} /> {room.size_sqm} m²
                          </li>
                        ) : null}
                        {room.view ? (
                          <li>
                            <Eye size={13} /> {room.view}
                          </li>
                        ) : null}
                      </ul>
                      {tags.length > 0 ? (
                        <div className="ui-stay-room-card__tags">
                          {tags.slice(0, 5).map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                          {tags.length > 5 ? (
                            <span className="ui-stay-room-card__tag-more" title={tags.slice(5).join(', ')}>
                              +{tags.length - 5}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="ui-stay-room-card__rates" aria-label="Lựa chọn giá">
                    {rates.length > 0 ? (
                      rates.map((rate) => (
                        <div key={rate.key} className="ui-stay-rate">
                          <div className="ui-stay-rate__price">
                            {rate.strikeLabel ? <s>{rate.strikeLabel}</s> : null}
                            {rate.priceLabel ? (
                              <strong>{rate.priceLabel}</strong>
                            ) : (
                              <strong className="ui-stay-rate__price-muted">—</strong>
                            )}
                            <small>{rate.unit}</small>
                            {rate.taxesIncluded ? (
                              <button
                                type="button"
                                className="ui-stay-rate__tip ui-stay-rate__tip--inline"
                                aria-label="Thuế phí"
                                data-tip="Đã bao gồm thuế và phí"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                <CircleHelp size={11} strokeWidth={2.25} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          <div className="ui-stay-rate__conds">
                            {rate.savePercent ? (
                              <span className="ui-stay-rate__chip ui-stay-rate__chip--save">
                                Tiết kiệm {rate.savePercent}%
                              </span>
                            ) : null}
                            {(rate.dealLabel || roomDeal) ? (
                              <span className="ui-stay-rate__chip">{rate.dealLabel || roomDeal}</span>
                            ) : null}
                            <RateTip label={rate.mealShort} tip={rate.mealTip} tone="neutral" />
                            <RateTip label={rate.cancelShort} tip={rate.cancelTip} tone={rate.cancelTone} />
                            {rate.prepayShort ? (
                              <RateTip label={rate.prepayShort} tip={rate.prepayTip || rate.prepayShort} />
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="ui-stay-rate ui-stay-rate--solo">
                        <div className="ui-stay-rate__price">
                          {price ? (
                            <>
                              <span className="ui-stay-rate__from">từ</span>
                              <strong>{price}</strong>
                              <small>/đêm</small>
                            </>
                          ) : (
                            <strong className="ui-stay-rate__price-muted">Chưa có giá / rate</strong>
                          )}
                        </div>
                        <p className="ui-stay-rate__hint">Chưa có rate_options — mở Sửa để nhập JSON hoặc chạy crawler.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ui-stay-room-card__actions">
                  <button
                    type="button"
                    className="ui-stay-room-card__action"
                    title="Sửa"
                    onClick={() => openEdit(i)}
                    disabled={busyKey !== null}
                  >
                    <Pencil size={14} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    className="ui-stay-room-card__action"
                    title="Sao chép"
                    onClick={() => void handleCopy(i)}
                    disabled={busyKey !== null}
                  >
                    <Copy size={14} />
                    <span>{busyKey === `copy-${i}` ? '…' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    className="ui-stay-room-card__action ui-stay-room-card__action--danger"
                    title="Xóa"
                    onClick={() => void handleDelete(i)}
                    disabled={busyKey !== null}
                  >
                    <Trash2 size={14} />
                    <span>{busyKey === `del-${i}` ? '…' : 'Xóa'}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="ui-repeater__add" onClick={handleAdd}>
        <Plus size={16} /> Thêm hạng phòng
      </button>

      {draft && editIndex != null ? (
        <StayRoomDrawer
          draft={draft}
          index={editIndex}
          persisting={Boolean(serviceId)}
          saving={saving}
          dealLabels={dealLabels}
          onPatch={patchDraft}
          onClose={() => closeDrawer()}
          onApply={() => void handleApply()}
        />
      ) : null}
    </div>
  );
}

function StayRoomDrawer({
  draft,
  index,
  persisting,
  saving,
  dealLabels,
  onPatch,
  onClose,
  onApply,
}: {
  draft: StayRoomFormRow;
  index: number;
  persisting: boolean;
  saving: boolean;
  dealLabels: { value: string; label: string }[];
  onPatch: (patch: Partial<StayRoomFormRow>) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const photos = useMemo(() => parsePhotos(draft.photos_json), [draft.photos_json]);
  const dealLabelMap = useMemo(
    () => Object.fromEntries(dealLabels.map((d) => [d.value, d.label])),
    [dealLabels],
  );
  const rateCount = useMemo(
    () => parseRates(draft.rate_options_json, dealLabelMap).length,
    [draft.rate_options_json, dealLabelMap],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="ui-media-drawer ui-stay-room-drawer" role="dialog" aria-modal="true" aria-label="Sửa hạng phòng">
      <button type="button" className="ui-media-drawer__veil" aria-label="Đóng" onClick={onClose} />
      <aside className="ui-media-drawer__panel ui-stay-room-drawer__panel">
        <header className="ui-media-drawer__head">
          <span className="ui-media-drawer__head-icon" aria-hidden>
            <BedDouble size={16} strokeWidth={2.15} />
          </span>
          <div className="ui-media-drawer__head-copy">
            <p className="ui-media-drawer__kicker">
              Hạng phòng #{index + 1}
              {draft.id ? ` · id ${draft.id}` : ' · chưa lưu'}
            </p>
            <h2 title={draft.name || undefined}>{draft.name || 'Chưa đặt tên'}</h2>
          </div>
          <button type="button" className="ui-media-drawer__close" onClick={onClose} aria-label="Đóng">
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="ui-media-drawer__body ui-stay-room-drawer__body">
          <div className="ui-form-grid ui-form-grid--2">
            <Input label="Tên hạng phòng" value={draft.name} onChange={(e) => onPatch({ name: e.target.value })} />
            <Input label="Mã" value={draft.code || ''} onChange={(e) => onPatch({ code: e.target.value })} />
            <Input
              label="Giá từ (đ/đêm)"
              type="number"
              value={draft.price_from != null ? String(draft.price_from) : ''}
              onChange={(e) => onPatch({ price_from: e.target.value })}
            />
            <Input
              label="Sức chứa"
              type="number"
              value={draft.capacity != null ? String(draft.capacity) : ''}
              onChange={(e) => onPatch({ capacity: Number(e.target.value) || null })}
            />
            <Input label="Giường" value={draft.bed_label || ''} onChange={(e) => onPatch({ bed_label: e.target.value })} />
            <Input
              label="Diện tích (m²)"
              type="number"
              value={draft.size_sqm != null ? String(draft.size_sqm) : ''}
              onChange={(e) => onPatch({ size_sqm: Number(e.target.value) || null })}
            />
            <Input label="View" value={draft.view || ''} onChange={(e) => onPatch({ view: e.target.value })} />
            <Select
              label="Loại đơn vị"
              value={draft.unit_type || ''}
              options={UNIT_TYPE_OPTIONS}
              onChange={(v) => onPatch({ unit_type: v })}
            />
            <Input
              label="Số phòng tắm"
              type="number"
              value={draft.bathroom_count != null ? String(draft.bathroom_count) : ''}
              onChange={(e) => onPatch({ bathroom_count: Number(e.target.value) || null })}
            />
            <Input
              label="Số phòng ngủ"
              type="number"
              value={draft.bedroom_count != null ? String(draft.bedroom_count) : ''}
              onChange={(e) => onPatch({ bedroom_count: Number(e.target.value) || null })}
            />
            <Input
              label="Hút thuốc"
              hint="VD: Không hút thuốc"
              value={draft.smoking || ''}
              onChange={(e) => onPatch({ smoking: e.target.value })}
            />
            <Input
              label="Comfort score"
              type="number"
              value={draft.comfort_score != null ? String(draft.comfort_score) : ''}
              onChange={(e) =>
                onPatch({ comfort_score: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <Input
              label="Comfort reviews"
              type="number"
              value={draft.comfort_reviews != null ? String(draft.comfort_reviews) : ''}
              onChange={(e) =>
                onPatch({ comfort_reviews: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="ui-form-grid ui-form-grid--2">
            <Select
              label="Nhãn ưu đãi"
              hint="Crawler mặc định «Ưu Đãi Mùa Du Lịch»"
              value={draft.deal_key || 'seasonal'}
              options={
                dealLabels.length
                  ? dealLabels
                  : [{ value: 'seasonal', label: 'Ưu Đãi Mùa Du Lịch' }]
              }
              onChange={(v) => onPatch({ deal_key: v })}
            />
            <div className="ui-field">
              <Switch
                label="Hiện scarcity động"
                hint="Public: «Chúng tôi còn N căn» — N random 1–5 mỗi lần tải (an toàn HTML cache)"
                checked={Boolean(draft.scarcity_active)}
                onChange={(v) => onPatch({ scarcity_active: v, scarcity: v ? '' : draft.scarcity })}
              />
            </div>
          </div>

          <Textarea
            label="Mô tả đầy đủ"
            value={draft.description || ''}
            onChange={(e) => onPatch({ description: e.target.value })}
            rows={4}
          />
          <Textarea
            label="Badge nổi bật phòng"
            hint="Mỗi dòng"
            value={draft.highlights || ''}
            onChange={(e) => onPatch({ highlights: e.target.value })}
            rows={2}
          />
          <Textarea
            label="Tiện nghi (mỗi dòng)"
            value={draft.amenities || ''}
            onChange={(e) => onPatch({ amenities: e.target.value })}
            rows={3}
          />
          <Textarea
            label="Bố trí giường (JSON)"
            hint='[{"name":"Phòng ngủ 1","items":[{"label":"1 giường đôi","type":"king","count":1}]}]'
            value={draft.beds_json || ''}
            onChange={(e) => onPatch({ beds_json: e.target.value })}
            rows={4}
          />
          <StayAmenityGroupsEditor
            value={draft.amenity_groups_json || ''}
            onChange={(amenity_groups_json) => onPatch({ amenity_groups_json })}
          />
          <Textarea
            label={`Lựa chọn giá / rate_options (JSON)${rateCount ? ` · ${rateCount} dòng` : ''}`}
            hint="Từ crawler #hprt-table — giữ khi chỉnh tay."
            value={draft.rate_options_json || ''}
            onChange={(e) => onPatch({ rate_options_json: e.target.value })}
            rows={6}
          />

          <div className="ui-room-photos">
            <p className="ui-room-photos__meta">
              Ảnh hạng phòng{photos.length > 0 ? ` · ${photos.length} ảnh` : ' · chưa có'}
            </p>
            {photos.length > 0 ? (
              <div className="ui-room-photos__strip" aria-label="Ảnh phòng">
                {photos.slice(0, 16).map((p, pi) => (
                  <div key={`${p.url}-${pi}`} className="ui-room-photos__shot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.alt || draft.name || `Ảnh ${pi + 1}`} loading="lazy" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            ) : null}
            <Textarea
              label="Ảnh (JSON)"
              hint='[{"url":"https://…","alt":"…","media_id":123}]'
              value={draft.photos_json || ''}
              onChange={(e) => onPatch({ photos_json: e.target.value })}
              rows={3}
            />
          </div>

          <details className="ui-stay-room-drawer__meta">
            <summary>Metadata crawler</summary>
            <div className="ui-form-grid ui-form-grid--2">
              <Input label="room_id" value={draft.room_id || ''} onChange={(e) => onPatch({ room_id: e.target.value })} />
              <Input label="hash" value={draft.hash || ''} onChange={(e) => onPatch({ hash: e.target.value })} />
            </div>
            <Textarea
              label="crawl_dates (JSON)"
              value={draft.crawl_dates_json || ''}
              onChange={(e) => onPatch({ crawl_dates_json: e.target.value })}
              rows={3}
            />
          </details>
        </div>

        <div className="ui-media-drawer__toolbar">
          <div className="ui-media-drawer__tools">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Đóng
            </Button>
          </div>
          <Button type="button" size="sm" loading={saving} onClick={onApply}>
            {persisting ? 'Lưu hạng phòng' : 'Áp dụng vào form'}
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
