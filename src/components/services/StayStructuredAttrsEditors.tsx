'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';

/** Labels khớp config/stay.php — key lạ (tiếng Booking) hiện nguyên. */
export const AMENITY_GROUP_LABELS: Record<string, string> = {
  popular: 'Tiện ích nổi bật',
  bathroom: 'Phòng tắm',
  bedroom: 'Phòng ngủ',
  view: 'Hướng tầm nhìn',
  kitchen: 'Nhà bếp',
  living: 'Khu sinh hoạt',
  media: 'Truyền thông & công nghệ',
  outdoor: 'Ngoài trời',
  wellness: 'Spa & thể thao',
  pool_beach: 'Hồ bơi & biển',
  dining: 'Ẩm thực',
  family: 'Gia đình & trẻ em',
  accessibility: 'Tiếp cận',
  safety: 'An toàn',
  parking: 'Đậu xe & đưa đón',
  general: 'Tiện nghi chỗ nghỉ',
  business: 'Công việc',
  other: 'Khác',
};

export const NEARBY_GROUP_LABELS: Record<string, string> = {
  landmark: 'Địa danh',
  beach: 'Bãi biển / thiên nhiên',
  nature: 'Thiên nhiên',
  transport: 'Giao thông',
  dining: 'Ăn uống',
  shop: 'Mua sắm',
  other: 'Lân cận',
};

/** Tag chuẩn — dùng làm giá trị filter sau này. */
export const REVIEW_SCORE_TAGS: { tag: string; label: string }[] = [
  { tag: 'staff', label: 'Nhân viên' },
  { tag: 'facilities', label: 'Cơ sở vật chất' },
  { tag: 'cleanliness', label: 'Sạch sẽ' },
  { tag: 'comfort', label: 'Thoải mái' },
  { tag: 'value', label: 'Đáng giá tiền' },
  { tag: 'location', label: 'Vị trí' },
  { tag: 'wifi', label: 'WiFi miễn phí' },
];

const AMENITY_KEY_OPTIONS = [
  { value: '', label: '— Chọn nhóm —' },
  ...Object.entries(AMENITY_GROUP_LABELS).map(([value, label]) => ({ value, label: `${label} (${value})` })),
  { value: '__custom__', label: 'Khác (tự nhập key)' },
];

const NEARBY_KEY_OPTIONS = [
  { value: '', label: '— Chọn nhóm —' },
  ...Object.entries(NEARBY_GROUP_LABELS).map(([value, label]) => ({ value, label: `${label} (${value})` })),
  { value: '__custom__', label: 'Khác (tự nhập key)' },
];

type NearbyItem = {
  name: string;
  distance: string;
  icon?: string;
  category?: string;
};

type ReviewScoreRow = { tag: string; score: number };

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function parseObjectRecord(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function parseAmenityGroups(raw?: string): { key: string; items: string[] }[] {
  const obj = parseObjectRecord(raw);
  return Object.entries(obj).map(([key, value]) => ({
    key,
    items: Array.isArray(value)
      ? value.map((x) => String(x).trim()).filter(Boolean)
      : typeof value === 'string' && value.trim()
        ? [value.trim()]
        : [],
  }));
}

function serializeAmenityGroups(rows: { key: string; items: string[] }[]): string {
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.items.map((x) => x.trim()).filter(Boolean);
  }
  return Object.keys(out).length ? pretty(out) : '';
}

function parseNearbyGroups(raw?: string): { key: string; items: NearbyItem[] }[] {
  const obj = parseObjectRecord(raw);
  return Object.entries(obj).map(([key, value]) => ({
    key,
    items: Array.isArray(value)
      ? (value
          .map((row) => {
            if (typeof row === 'string') return { name: row.trim(), distance: '', icon: '', category: '' };
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const name = String(r.name || r.title || '').trim();
            if (!name) return null;
            return {
              name,
              distance: String(r.distance || '').trim(),
              icon: String(r.icon || '').trim(),
              category: String(r.category || '').trim(),
            };
          })
          .filter(Boolean) as NearbyItem[])
      : [],
  }));
}

function serializeNearbyGroups(rows: { key: string; items: NearbyItem[] }[]): string {
  const out: Record<string, NearbyItem[]> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.items
      .map((r) => {
        const name = r.name.trim();
        if (!name) return null;
        const item: NearbyItem = {
          name,
          distance: r.distance.trim(),
        };
        if (r.icon?.trim()) item.icon = r.icon.trim();
        if (r.category?.trim()) item.category = r.category.trim();
        return item;
      })
      .filter(Boolean) as NearbyItem[];
  }
  return Object.keys(out).length ? pretty(out) : '';
}

function parseReviewScores(raw?: string): ReviewScoreRow[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const r = row as Record<string, unknown>;
          const tag = String(r.tag || r.key || '').trim();
          const score = Number(r.score);
          if (!tag || !Number.isFinite(score) || score <= 0 || score > 10) return null;
          return { tag, score: Math.round(score * 10) / 10 };
        })
        .filter(Boolean) as ReviewScoreRow[];
    }
    if (parsed && typeof parsed === 'object') {
      const out: ReviewScoreRow[] = [];
      for (const tag of Object.keys(REVIEW_SCORE_TAGS.reduce((acc, t) => ({ ...acc, [t.tag]: true }), {} as Record<string, boolean>))) {
        const score = Number((parsed as Record<string, unknown>)[tag]);
        if (Number.isFinite(score) && score > 0 && score <= 10) {
          out.push({ tag, score: Math.round(score * 10) / 10 });
        }
      }
      for (const [tag, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (tag === 'total' || out.some((r) => r.tag === tag)) continue;
        const score = Number(value);
        if (Number.isFinite(score) && score > 0 && score <= 10) {
          out.push({ tag, score: Math.round(score * 10) / 10 });
        }
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function serializeReviewScores(rows: ReviewScoreRow[]): string {
  const known = REVIEW_SCORE_TAGS.map((t) => t.tag);
  const ordered = [
    ...known.filter((tag) => rows.some((r) => r.tag === tag)).map((tag) => rows.find((r) => r.tag === tag)!),
    ...rows.filter((r) => !known.includes(r.tag)),
  ].filter((r) => r.tag && r.score > 0 && r.score <= 10);
  return ordered.length ? pretty(ordered.map((r) => ({ tag: r.tag, score: r.score }))) : '';
}

function groupLabel(key: string, map: Record<string, string>): string {
  return map[key] || key;
}

function reviewLabel(tag: string): string {
  return REVIEW_SCORE_TAGS.find((t) => t.tag === tag)?.label || tag;
}

function dirty(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function usePortalMount() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function GroupDrawerShell({
  title,
  kicker,
  icon,
  onClose,
  onApply,
  children,
}: {
  title: string;
  kicker: string;
  icon: ReactNode;
  onClose: () => void;
  onApply: () => void;
  children: ReactNode;
}) {
  const mounted = usePortalMount();

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
    <div className="ui-media-drawer ui-stay-group-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ui-media-drawer__veil" aria-label="Đóng" onClick={onClose} />
      <aside className="ui-media-drawer__panel ui-stay-group-drawer__panel">
        <header className="ui-media-drawer__head">
          <span className="ui-media-drawer__head-icon" aria-hidden>
            {icon}
          </span>
          <div className="ui-media-drawer__head-copy">
            <p className="ui-media-drawer__kicker">{kicker}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ui-media-drawer__close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="ui-media-drawer__body ui-stay-group-drawer__body">{children}</div>
        <div className="ui-media-drawer__toolbar">
          <div className="ui-media-drawer__tools">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
          </div>
          <Button type="button" variant="primary" onClick={onApply}>
            Áp dụng
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/* ─── Amenity groups ─────────────────────────────────────────── */

export function StayAmenityGroupsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const rows = useMemo(() => parseAmenityGroups(value), [value]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ key: string; itemsText: string } | null>(null);
  const [baseline, setBaseline] = useState<{ key: string; itemsText: string } | null>(null);

  const openEdit = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const snap = { key: row.key, itemsText: row.items.join('\n') };
    setEditIndex(index);
    setDraft(snap);
    setBaseline(snap);
  };

  const closeDrawer = (force = false) => {
    if (!force && draft && baseline && dirty(draft, baseline)) {
      if (!window.confirm('Có thay đổi chưa áp dụng. Đóng drawer và bỏ qua?')) return;
    }
    setEditIndex(null);
    setDraft(null);
    setBaseline(null);
  };

  const handleApply = () => {
    if (editIndex == null || !draft) return;
    const key = draft.key.trim();
    if (!key) {
      window.alert('Nhập key nhóm tiện ích.');
      return;
    }
    const row = {
      key,
      items: draft.itemsText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    const next = [...rows];
    if (editIndex >= rows.length) next.push(row);
    else next[editIndex] = row;
    onChange(serializeAmenityGroups(next));
    closeDrawer(true);
  };

  const handleAdd = () => {
    const snap = { key: 'other', itemsText: '' };
    setEditIndex(rows.length);
    setDraft(snap);
    setBaseline(snap);
  };

  const handleDelete = (index: number) => {
    const row = rows[index];
    if (!row) return;
    if (!window.confirm(`Xóa nhóm «${groupLabel(row.key, AMENITY_GROUP_LABELS)}»?`)) return;
    onChange(serializeAmenityGroups(rows.filter((_, i) => i !== index)));
    if (editIndex === index) closeDrawer(true);
    else if (editIndex != null && editIndex > index) setEditIndex(editIndex - 1);
  };

  const knownKey = draft && AMENITY_GROUP_LABELS[draft.key] ? draft.key : draft?.key ? '__custom__' : '';

  return (
    <div className="ui-stay-groups">
      {rows.length === 0 ? (
        <p className="ui-stay-groups__empty">Chưa có nhóm tiện ích. Thêm mới hoặc chạy crawler.</p>
      ) : (
        <ul className="ui-stay-groups__list">
          {rows.map((row, i) => (
            <li key={`${row.key}-${i}`} className="ui-stay-group-card">
              <button type="button" className="ui-stay-group-card__main" onClick={() => openEdit(i)}>
                <span className="ui-stay-group-card__icon" aria-hidden>
                  <Sparkles size={16} strokeWidth={2} />
                </span>
                <span className="ui-stay-group-card__body">
                  <span className="ui-stay-group-card__title-row">
                    <strong>{groupLabel(row.key, AMENITY_GROUP_LABELS)}</strong>
                    <code>{row.key}</code>
                    <span className="ui-stay-group-card__count">{row.items.length} mục</span>
                  </span>
                  {row.items.length > 0 ? (
                    <span className="ui-stay-group-card__tags">
                      {row.items.slice(0, 6).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                      {row.items.length > 6 ? (
                        <span className="ui-stay-group-card__more">+{row.items.length - 6}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="ui-stay-group-card__muted">Chưa có tiện ích</span>
                  )}
                </span>
              </button>
              <div className="ui-stay-group-card__actions">
                <button type="button" className="ui-stay-group-card__action" aria-label="Sửa" onClick={() => openEdit(i)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="ui-stay-group-card__action ui-stay-group-card__action--danger"
                  aria-label="Xóa"
                  onClick={() => handleDelete(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ui-repeater__add" onClick={handleAdd}>
        <Plus size={16} /> Thêm nhóm tiện ích
      </button>

      {draft && editIndex != null ? (
        <GroupDrawerShell
          title={groupLabel(draft.key || 'Nhóm mới', AMENITY_GROUP_LABELS)}
          kicker={`Nhóm tiện ích #${editIndex + 1}`}
          icon={<Sparkles size={16} strokeWidth={2.15} />}
          onClose={() => closeDrawer()}
          onApply={handleApply}
        >
          <Select
            label="Nhóm chuẩn"
            value={knownKey}
            options={AMENITY_KEY_OPTIONS}
            onChange={(v) => {
              if (v === '__custom__') {
                setDraft((p) => (p ? { ...p, key: p.key && !AMENITY_GROUP_LABELS[p.key] ? p.key : '' } : p));
                return;
              }
              setDraft((p) => (p ? { ...p, key: v } : p));
            }}
          />
          {(knownKey === '__custom__' || !AMENITY_GROUP_LABELS[draft.key]) && (
            <Input
              label="Key nhóm"
              hint="VD: bathroom, kitchen — hoặc tiêu đề Booking gốc"
              value={draft.key}
              onChange={(e) => setDraft((p) => (p ? { ...p, key: e.target.value } : p))}
            />
          )}
          <Textarea
            label="Tiện ích (mỗi dòng một mục)"
            value={draft.itemsText}
            onChange={(e) => setDraft((p) => (p ? { ...p, itemsText: e.target.value } : p))}
            rows={12}
          />
        </GroupDrawerShell>
      ) : null}
    </div>
  );
}

/* ─── Nearby groups ──────────────────────────────────────────── */

type NearbyGroupDraft = {
  key: string;
  items: NearbyItem[];
};

export function StayNearbyGroupsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const rows = useMemo(() => parseNearbyGroups(value), [value]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<NearbyGroupDraft | null>(null);
  const [baseline, setBaseline] = useState<NearbyGroupDraft | null>(null);

  const openEdit = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const snap = { key: row.key, items: row.items.map((x) => ({ ...x })) };
    setEditIndex(index);
    setDraft(snap);
    setBaseline(snap);
  };

  const closeDrawer = (force = false) => {
    if (!force && draft && baseline && dirty(draft, baseline)) {
      if (!window.confirm('Có thay đổi chưa áp dụng. Đóng drawer và bỏ qua?')) return;
    }
    setEditIndex(null);
    setDraft(null);
    setBaseline(null);
  };

  const handleApply = () => {
    if (editIndex == null || !draft) return;
    const key = draft.key.trim();
    if (!key) {
      window.alert('Nhập key nhóm lân cận.');
      return;
    }
    const row = {
      key,
      items: draft.items.filter((x) => x.name.trim()),
    };
    const next = [...rows];
    if (editIndex >= rows.length) next.push(row);
    else next[editIndex] = row;
    onChange(serializeNearbyGroups(next));
    closeDrawer(true);
  };

  const handleAdd = () => {
    const snap = { key: 'other', items: [] as NearbyItem[] };
    setEditIndex(rows.length);
    setDraft(snap);
    setBaseline(snap);
  };

  const handleDelete = (index: number) => {
    const row = rows[index];
    if (!row) return;
    if (!window.confirm(`Xóa nhóm «${groupLabel(row.key, NEARBY_GROUP_LABELS)}»?`)) return;
    onChange(serializeNearbyGroups(rows.filter((_, i) => i !== index)));
    if (editIndex === index) closeDrawer(true);
    else if (editIndex != null && editIndex > index) setEditIndex(editIndex - 1);
  };

  const knownKey = draft && NEARBY_GROUP_LABELS[draft.key] ? draft.key : draft?.key ? '__custom__' : '';

  return (
    <div className="ui-stay-groups">
      {rows.length === 0 ? (
        <p className="ui-stay-groups__empty">Chưa có nhóm lân cận.</p>
      ) : (
        <ul className="ui-stay-groups__list">
          {rows.map((row, i) => (
            <li key={`${row.key}-${i}`} className="ui-stay-group-card">
              <button type="button" className="ui-stay-group-card__main" onClick={() => openEdit(i)}>
                <span className="ui-stay-group-card__icon" aria-hidden>
                  <MapPin size={16} strokeWidth={2} />
                </span>
                <span className="ui-stay-group-card__body">
                  <span className="ui-stay-group-card__title-row">
                    <strong>{groupLabel(row.key, NEARBY_GROUP_LABELS)}</strong>
                    <code>{row.key}</code>
                    <span className="ui-stay-group-card__count">{row.items.length} điểm</span>
                  </span>
                  {row.items.length > 0 ? (
                    <span className="ui-stay-group-card__tags">
                      {row.items.slice(0, 4).map((t) => (
                        <span key={`${t.name}-${t.distance}`}>
                          {t.name}
                          {t.distance ? ` · ${t.distance}` : ''}
                        </span>
                      ))}
                      {row.items.length > 4 ? (
                        <span className="ui-stay-group-card__more">+{row.items.length - 4}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="ui-stay-group-card__muted">Chưa có điểm</span>
                  )}
                </span>
              </button>
              <div className="ui-stay-group-card__actions">
                <button type="button" className="ui-stay-group-card__action" aria-label="Sửa" onClick={() => openEdit(i)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="ui-stay-group-card__action ui-stay-group-card__action--danger"
                  aria-label="Xóa"
                  onClick={() => handleDelete(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ui-repeater__add" onClick={handleAdd}>
        <Plus size={16} /> Thêm nhóm lân cận
      </button>

      {draft && editIndex != null ? (
        <GroupDrawerShell
          title={groupLabel(draft.key || 'Nhóm mới', NEARBY_GROUP_LABELS)}
          kicker={`Nhóm lân cận #${editIndex + 1}`}
          icon={<MapPin size={16} strokeWidth={2.15} />}
          onClose={() => closeDrawer()}
          onApply={handleApply}
        >
          <Select
            label="Nhóm chuẩn"
            value={knownKey}
            options={NEARBY_KEY_OPTIONS}
            onChange={(v) => {
              if (v === '__custom__') {
                setDraft((p) => (p ? { ...p, key: p.key && !NEARBY_GROUP_LABELS[p.key] ? p.key : '' } : p));
                return;
              }
              setDraft((p) => (p ? { ...p, key: v } : p));
            }}
          />
          {(knownKey === '__custom__' || !NEARBY_GROUP_LABELS[draft.key]) && (
            <Input
              label="Key nhóm"
              hint="landmark, beach, transport…"
              value={draft.key}
              onChange={(e) => setDraft((p) => (p ? { ...p, key: e.target.value } : p))}
            />
          )}
          <div className="ui-stay-nearby-rows">
            <div className="ui-stay-nearby-rows__head">
              <span>Điểm trong nhóm</span>
              <button
                type="button"
                className="ui-link-btn"
                onClick={() =>
                  setDraft((p) =>
                    p ? { ...p, items: [...p.items, { name: '', distance: '', icon: '', category: '' }] } : p,
                  )
                }
              >
                <Plus size={14} /> Thêm điểm
              </button>
            </div>
            {draft.items.length === 0 ? (
              <p className="ui-stay-groups__empty">Chưa có điểm — thêm hoặc crawl lại.</p>
            ) : (
              draft.items.map((item, i) => (
                <div key={i} className="ui-stay-nearby-rows__row">
                  <Input
                    label="Tên"
                    value={item.name}
                    onChange={(e) =>
                      setDraft((p) => {
                        if (!p) return p;
                        const items = [...p.items];
                        items[i] = { ...items[i], name: e.target.value };
                        return { ...p, items };
                      })
                    }
                  />
                  <Input
                    label="Khoảng cách"
                    value={item.distance}
                    onChange={(e) =>
                      setDraft((p) => {
                        if (!p) return p;
                        const items = [...p.items];
                        items[i] = { ...items[i], distance: e.target.value };
                        return { ...p, items };
                      })
                    }
                  />
                  <button
                    type="button"
                    className="ui-stay-group-card__action ui-stay-group-card__action--danger"
                    aria-label="Xóa điểm"
                    onClick={() =>
                      setDraft((p) => (p ? { ...p, items: p.items.filter((_, j) => j !== i) } : p))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </GroupDrawerShell>
      ) : null}
    </div>
  );
}

/* ─── Review score tags ──────────────────────────────────────── */

export function StayReviewScoresEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const rows = useMemo(() => parseReviewScores(value), [value]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReviewScoreRow | null>(null);
  const [baseline, setBaseline] = useState<ReviewScoreRow | null>(null);

  const usedTags = useMemo(() => new Set(rows.map((r) => r.tag)), [rows]);
  const availableTags = REVIEW_SCORE_TAGS.filter((t) => !usedTags.has(t.tag) || draft?.tag === t.tag);

  const openEdit = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const snap = { ...row };
    setEditIndex(index);
    setDraft(snap);
    setBaseline(snap);
  };

  const closeDrawer = (force = false) => {
    if (!force && draft && baseline && dirty(draft, baseline)) {
      if (!window.confirm('Có thay đổi chưa áp dụng. Đóng drawer và bỏ qua?')) return;
    }
    setEditIndex(null);
    setDraft(null);
    setBaseline(null);
  };

  const handleApply = () => {
    if (editIndex == null || !draft) return;
    const tag = draft.tag.trim();
    if (!tag) {
      window.alert('Chọn tag tiêu chí.');
      return;
    }
    const score = Number(draft.score);
    if (!Number.isFinite(score) || score <= 0 || score > 10) {
      window.alert('Điểm phải từ 0.1 đến 10.');
      return;
    }
    const row = { tag, score: Math.round(score * 10) / 10 };
    const next = [...rows];
    if (editIndex >= rows.length) next.push(row);
    else next[editIndex] = row;
    onChange(serializeReviewScores(next));
    closeDrawer(true);
  };

  const handleAdd = () => {
    const first = availableTags[0]?.tag || REVIEW_SCORE_TAGS[0]?.tag || 'staff';
    const snap = { tag: first, score: 8 };
    setEditIndex(rows.length);
    setDraft(snap);
    setBaseline(snap);
  };

  const handleDelete = (index: number) => {
    const row = rows[index];
    if (!row) return;
    if (!window.confirm(`Xóa điểm «${reviewLabel(row.tag)}»?`)) return;
    onChange(serializeReviewScores(rows.filter((_, i) => i !== index)));
    if (editIndex === index) closeDrawer(true);
    else if (editIndex != null && editIndex > index) setEditIndex(editIndex - 1);
  };

  return (
    <div className="ui-stay-groups">
      {rows.length === 0 ? (
        <p className="ui-stay-groups__empty">Chưa có điểm theo hạng mục. Thêm tag chuẩn để filter sau này.</p>
      ) : (
        <ul className="ui-stay-groups__list ui-stay-groups__list--scores">
          {rows.map((row, i) => (
            <li key={`${row.tag}-${i}`} className="ui-stay-group-card ui-stay-group-card--score">
              <button type="button" className="ui-stay-group-card__main" onClick={() => openEdit(i)}>
                <span className="ui-stay-group-card__icon" aria-hidden>
                  <Star size={16} strokeWidth={2} />
                </span>
                <span className="ui-stay-group-card__body">
                  <span className="ui-stay-group-card__title-row">
                    <strong>{reviewLabel(row.tag)}</strong>
                    <code>{row.tag}</code>
                  </span>
                  <span className="ui-stay-score">{row.score.toFixed(1)}</span>
                </span>
              </button>
              <div className="ui-stay-group-card__actions">
                <button type="button" className="ui-stay-group-card__action" aria-label="Sửa" onClick={() => openEdit(i)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="ui-stay-group-card__action ui-stay-group-card__action--danger"
                  aria-label="Xóa"
                  onClick={() => handleDelete(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ui-repeater__add" onClick={handleAdd} disabled={availableTags.length === 0 && editIndex == null}>
        <Plus size={16} /> Thêm tiêu chí điểm
      </button>

      {draft && editIndex != null ? (
        <GroupDrawerShell
          title={reviewLabel(draft.tag) || 'Tiêu chí điểm'}
          kicker={`Tag filter · ${draft.tag || '…'}`}
          icon={<Star size={16} strokeWidth={2.15} />}
          onClose={() => closeDrawer()}
          onApply={handleApply}
        >
          <Select
            label="Tag tiêu chí (chuẩn filter)"
            value={draft.tag}
            options={[
              ...REVIEW_SCORE_TAGS.filter((t) => !usedTags.has(t.tag) || t.tag === draft.tag).map((t) => ({
                value: t.tag,
                label: `${t.label} (${t.tag})`,
              })),
              ...(draft.tag && !REVIEW_SCORE_TAGS.some((t) => t.tag === draft.tag)
                ? [{ value: draft.tag, label: `${draft.tag} (tuỳ chỉnh)` }]
                : []),
            ]}
            onChange={(v) => setDraft((p) => (p ? { ...p, tag: v } : p))}
          />
          <Input
            label="Điểm (0–10)"
            type="number"
            step="0.1"
            min={0.1}
            max={10}
            value={String(draft.score)}
            onChange={(e) =>
              setDraft((p) => (p ? { ...p, score: Number(e.target.value) || 0 } : p))
            }
          />
        </GroupDrawerShell>
      ) : null}
    </div>
  );
}
