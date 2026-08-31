/**
 * Merge AI enrich `fields` vào form state — ưu tiên list itinerary/faqs từ AI,
 * giữ `id` cũ theo index khi có.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function mergeRow(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  if (prev.id != null && out.id == null) {
    out.id = prev.id;
  }
  return out;
}

/** Chuẩn hoá FAQ từ AI (question/answer hoặc q/a / cau_hoi…). */
function normalizeFaqRow(cell: Record<string, unknown>): { question: string; answer: string; id?: unknown } {
  const question =
    cell.question ?? cell.q ?? cell.Question ?? cell.cau_hoi ?? '';
  const answer =
    cell.answer ?? cell.a ?? cell.Answer ?? cell.cau_tra_loi ?? cell.tra_loi ?? '';
  const row = {
    question: typeof question === 'string' ? question.trim() : '',
    answer: typeof answer === 'string' ? answer.trim() : '',
  };
  if (cell.id != null && cell.id !== '') {
    return { ...row, id: cell.id };
  }
  return row;
}

export function mergeEnrichFields<T extends Record<string, unknown>>(
  prev: T,
  fields: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...prev };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    if (key === 'itinerary' && Array.isArray(value)) {
      const prevList = Array.isArray(prev.itinerary) ? (prev.itinerary as Record<string, unknown>[]) : [];
      out.itinerary = value.map((row, i) => {
        const cell = isPlainObject(row) ? row : {};
        const byDay = prevList.find(
          (r) => Number(r.day_number) === Number(cell.day_number ?? i + 1),
        );
        const old = isPlainObject(byDay) ? byDay : isPlainObject(prevList[i]) ? prevList[i] : {};
        const meals = cell.meals_included;
        const mealsStr = Array.isArray(meals)
          ? meals.map((x) => String(x).trim()).filter(Boolean).join('; ')
          : String(meals ?? '');
        return mergeRow(old, {
          day_number: cell.day_number ?? i + 1,
          meals_included: mealsStr,
          transport_icons: old.transport_icons ?? '',
          title: cell.title ?? '',
          content: typeof cell.content === 'string' ? cell.content : (old.content ?? ''),
          overnight_at: cell.overnight_at ?? '',
          id: old.id ?? null,
        });
      });
      continue;
    }

    if (key === 'faqs' && Array.isArray(value)) {
      if (value.length === 0) continue;
      const prevList = Array.isArray(prev.faqs) ? (prev.faqs as Record<string, unknown>[]) : [];
      out.faqs = value.map((row, i) => {
        const cell = isPlainObject(row) ? row : {};
        const normalized = normalizeFaqRow(cell);
        const old = isPlainObject(prevList[i]) ? prevList[i] : {};
        return mergeRow(old, {
          question: normalized.question,
          answer: normalized.answer,
          id: old.id ?? null,
        });
      });
      continue;
    }

    if (
      [
        'duration_days',
        'duration_nights',
        'price_from',
        'currency',
        'status',
        'code',
        'country_id',
        'cruise_type',
        'seo_parent_id',
        'category_ids',
        'travel_style_ids',
        'cover',
        'cluster',
        'service_category_id',
        'content_rewrite',
        'faq_rewrite',
      ].includes(key)
    ) {
      continue;
    }

    if (key === 'rating_aggregate_star' || key === 'rating_aggregate_count') {
      if (value === null || value === '') continue;
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      out[key] = key === 'rating_aggregate_count' ? String(Math.round(n)) : String(n);
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      if (typeof prev[key] === 'boolean') {
        out[key] = Boolean(value);
      } else if (typeof prev[key] === 'number') {
        const n = Number(value);
        out[key] = Number.isFinite(n) ? n : prev[key];
      } else {
        let next = value == null ? '' : String(value);
        if (key === 'featured_quote_text' || key === 'featured_quote_author' || key === 'seo_title' || key === 'title') {
          next = next.slice(0, 255);
        } else if (key === 'seo_description') {
          next = next.slice(0, 350);
        }
        out[key] = next;
      }
    } else if (Array.isArray(value) && typeof prev[key] === 'string') {
      out[key] = value.map((x) => String(x).trim()).filter(Boolean).join('\n');
    }
  }

  return out as T;
}

export type DetailEnrichStage = 'meta' | 'content' | 'faq';
export type ListingEnrichStage = 'meta' | 'body' | 'faq';

function itinerarySkeleton(form: Record<string, unknown>, includeContent: boolean): Record<string, unknown>[] {
  const days = Array.isArray(form.itinerary) ? (form.itinerary as Record<string, unknown>[]) : [];
  return days.map((row, i) => ({
    day_number: row.day_number || i + 1,
    meals_included: row.meals_included || '',
    title: row.title || '',
    content: includeContent ? String(row.content ?? '') : '',
    overnight_at: row.overnight_at || '',
    ...(includeContent ? {} : { content_rewrite: true }),
  }));
}

function faqSkeleton(form: Record<string, unknown>, includeAnswers: boolean): Record<string, unknown>[] {
  const faqs = Array.isArray(form.faqs) ? (form.faqs as Record<string, unknown>[]) : [];
  return faqs.map((row) => ({
    question: row.question || '',
    answer: includeAnswers ? String(row.answer ?? '') : '',
    ...(includeAnswers ? {} : { faq_rewrite: true }),
  }));
}

/**
 * Snapshot form cho multi-stage AI — clone list lồng nhau để `live` tách khỏi React state.
 * Bước sau trong cùng lần chạy đọc `live` (đã merge), không gọi lại API server.
 */
export function snapshotFormForAiRun(form: Record<string, unknown>): Record<string, unknown> {
  const snap: Record<string, unknown> = { ...form };
  if (Array.isArray(form.itinerary)) {
    snap.itinerary = (form.itinerary as Record<string, unknown>[]).map((row) =>
      isPlainObject(row) ? { ...row } : row,
    );
  }
  if (Array.isArray(form.faqs)) {
    snap.faqs = (form.faqs as Record<string, unknown>[]).map((row) =>
      isPlainObject(row) ? { ...row } : row,
    );
  }
  return snap;
}

/** Payload gửi AI theo luồng — meta chỉ title; content/faq mang context đầy đủ. */
export function buildPackageEnrichPayload(
  form: Record<string, unknown>,
  stage: DetailEnrichStage = 'content',
): Record<string, unknown> {
  if (stage === 'meta') {
    return { title: form.title || '' };
  }

  const base: Record<string, unknown> = {
    title: form.title || '',
    code: form.code || '',
    duration_days: Number(form.duration_days) || null,
    duration_nights: Number(form.duration_nights) || null,
    price_from: form.price_from || '',
    currency: form.currency || '',
    discount_badge: form.discount_badge || '',
    cruise_type: form.cruise_type || '',
    departure_port: form.departure_port || '',
    boat_class: form.boat_class || '',
    nights_on_board: form.nights_on_board || '',
    start_location: form.start_location || '',
    end_location: form.end_location || '',
    summary: form.summary || '',
    highlights_intro: form.highlights_intro || '',
    featured_quote_text: form.featured_quote_text || '',
    featured_quote_author: form.featured_quote_author || '',
    places_to_visit: form.places_to_visit || '',
    highlight_bullets: form.highlight_bullets || '',
    inclusions: form.inclusions || '',
    exclusions: form.exclusions || '',
    notes: form.notes || '',
    seo_slug: form.seo_slug || '',
    seo_title: form.seo_title || '',
    seo_description: form.seo_description || '',
    itinerary: itinerarySkeleton(form, stage === 'faq'),
  };

  if (stage === 'faq') {
    base.faqs = faqSkeleton(form, false);
    base.faq_rewrite = true;
  }

  return base;
}

export function buildServiceEnrichPayload(
  form: Record<string, unknown>,
  stage: DetailEnrichStage = 'content',
): Record<string, unknown> {
  if (stage === 'meta') {
    return { title: form.title || '' };
  }

  const base: Record<string, unknown> = {
    title: form.title || '',
    code: form.code || '',
    cluster: form.cluster || '',
    location_label: form.location_label || '',
    price_from: form.price_from || '',
    currency: form.currency || '',
    summary: form.summary || '',
    content: stage === 'faq' ? String(form.content ?? '') : '',
    ...(stage === 'content' ? { content_rewrite: true } : {}),
    highlights: form.highlights || '',
    inclusions: form.inclusions || '',
    exclusions: form.exclusions || '',
    notes: form.notes || '',
    seo_slug: form.seo_slug || '',
    seo_title: form.seo_title || '',
    seo_description: form.seo_description || '',
  };

  if (stage === 'faq') {
    base.faqs = faqSkeleton(form, false);
    base.faq_rewrite = true;
  }

  return base;
}

export type ListingEnrichEntityType =
  | 'listing_hub'
  | 'country'
  | 'tour_category'
  | 'cruise_type'
  | 'service_category';

/** Tiêu đề trang listing. */
export function getListingPageTitle(
  form: Record<string, unknown>,
  entityType: ListingEnrichEntityType,
): string {
  if (entityType === 'listing_hub') {
    return String(form.title || '').trim();
  }
  return String(form.name || '').trim();
}

/** Canonical listing fields từ form admin (map ngược alias). */
export function listingCanonicalFromForm(
  form: Record<string, unknown>,
  entityType: ListingEnrichEntityType,
): Record<string, string> {
  const title = getListingPageTitle(form, entityType);
  let subtitle = '';
  let seoBody = '';
  if (entityType === 'listing_hub') {
    subtitle = String(form.body || '').trim();
    seoBody = String(form.seo_body || '').trim();
  } else if (entityType === 'country') {
    subtitle = String(form.tagline || '').trim();
    seoBody = String(form.long_form_content || '').trim();
  } else if (entityType === 'tour_category') {
    subtitle = String(form.description || '').trim();
    seoBody = String(form.seo_intro || '').trim();
  } else {
    subtitle = String(form.intro || '').trim();
    seoBody = String(form.seo_body || '').trim();
  }

  return {
    title,
    subtitle,
    seo_body: seoBody,
    seo_title: String(form.seo_title || '').trim(),
    seo_description: String(form.seo_description || '').trim(),
    seo_slug: String(form.seo_slug || '').trim(),
  };
}

export function buildListingEnrichPayload(
  form: Record<string, unknown>,
  entityType: ListingEnrichEntityType,
  stage: ListingEnrichStage,
): Record<string, unknown> {
  const canonical = listingCanonicalFromForm(form, entityType);
  if (stage === 'meta') {
    return { title: canonical.title };
  }
  if (stage === 'body') {
    return {
      title: canonical.title,
      subtitle: canonical.subtitle,
      seo_title: canonical.seo_title,
      seo_description: canonical.seo_description,
      seo_slug: canonical.seo_slug,
    };
  }
  return canonical;
}

/** Map canonical AI fields → form admin theo loại trang. */
export function mergeListingEnrichFields<T extends Record<string, unknown>>(
  prev: T,
  fields: Record<string, unknown>,
  entityType: ListingEnrichEntityType,
): T {
  const out: Record<string, unknown> = { ...prev };

  const title = typeof fields.title === 'string' ? fields.title.trim() : '';
  const subtitle = typeof fields.subtitle === 'string' ? fields.subtitle.trim() : '';
  const seoBody = typeof fields.seo_body === 'string' ? fields.seo_body.trim() : '';

  if (entityType === 'listing_hub') {
    if (title) out.title = title;
    if (subtitle) out.body = subtitle;
    if (seoBody) out.seo_body = seoBody;
  } else if (entityType === 'country') {
    if (title) out.name = title;
    if (subtitle) out.tagline = subtitle;
    if (seoBody) out.long_form_content = seoBody;
  } else if (entityType === 'tour_category') {
    if (title) out.name = title;
    if (subtitle) out.description = subtitle;
    if (seoBody) out.seo_intro = seoBody;
  } else if (entityType === 'cruise_type') {
    if (title) out.name = title;
    if (subtitle) out.intro = subtitle;
    if (seoBody) out.seo_body = seoBody;
  } else if (entityType === 'service_category') {
    if (title) out.name = title;
    if (subtitle) out.intro = subtitle;
    if (seoBody) out.seo_body = seoBody;
  }

  for (const key of ['seo_slug', 'seo_title', 'seo_description'] as const) {
    const val = fields[key];
    if (typeof val === 'string' && val.trim() !== '') {
      out[key] = val.trim();
    }
  }

  for (const key of ['rating_aggregate_star', 'rating_aggregate_count'] as const) {
    const val = fields[key];
    if (val === null || val === undefined || val === '') continue;
    const n = Number(val);
    if (!Number.isFinite(n)) continue;
    out[key] = key === 'rating_aggregate_count' ? String(Math.round(n)) : String(n);
  }

  if (Array.isArray(fields.faqs) && fields.faqs.length > 0) {
    const prevList = Array.isArray(prev.faqs) ? (prev.faqs as Record<string, unknown>[]) : [];
    out.faqs = fields.faqs.map((row, i) => {
      const cell = isPlainObject(row) ? row : {};
      const normalized = normalizeFaqRow(cell);
      const old = isPlainObject(prevList[i]) ? prevList[i] : {};
      return mergeRow(old, {
        question: normalized.question,
        answer: normalized.answer,
        id: old.id ?? null,
      });
    });
  }

  return out as T;
}

/** Keys để đánh dấu badge AI sau enrich listing. */
export function listingEnrichAppliedKeys(
  fields: Record<string, unknown>,
  entityType: ListingEnrichEntityType,
): string[] {
  const keys: string[] = [];
  if (typeof fields.title === 'string' && fields.title.trim()) {
    keys.push(entityType === 'listing_hub' ? 'title' : 'name');
  }
  if (typeof fields.subtitle === 'string' && fields.subtitle.trim()) {
    if (entityType === 'listing_hub') keys.push('body');
    else if (entityType === 'country') keys.push('tagline');
    else if (entityType === 'tour_category') keys.push('description');
    else if (entityType === 'cruise_type' || entityType === 'service_category') keys.push('intro');
  }
  if (typeof fields.seo_body === 'string' && fields.seo_body.trim()) {
    if (entityType === 'listing_hub') keys.push('seo_body');
    else if (entityType === 'country') keys.push('long_form_content');
    else if (entityType === 'tour_category') keys.push('seo_intro');
    else if (entityType === 'cruise_type' || entityType === 'service_category') keys.push('seo_body');
  }
  for (const key of ['seo_slug', 'seo_title', 'seo_description']) {
    if (typeof fields[key] === 'string' && String(fields[key]).trim()) {
      keys.push(key);
    }
  }
  for (const key of ['rating_aggregate_star', 'rating_aggregate_count']) {
    if (fields[key] !== null && fields[key] !== undefined && fields[key] !== '') {
      keys.push(key);
    }
  }
  if (Array.isArray(fields.faqs) && fields.faqs.length > 0) {
    keys.push('faqs');
  }
  return keys;
}

export type StayEnrichStage = 'meta' | 'property' | 'faq';

export type StayRoomFormRow = {
  id?: number | null;
  code?: string;
  name: string;
  description?: string;
  price_from?: number | string | null;
  capacity?: number | null;
  bed_label?: string;
  size_sqm?: number | null;
  view?: string;
  amenities?: string;
  unit_type?: string;
  bathroom_count?: number | null;
  bedroom_count?: number | null;
  smoking?: string;
  highlights?: string;
  beds_json?: string;
  amenity_groups_json?: string;
  photos_json?: string;
  /** JSON attrs.rate_options[] từ #hprt-table */
  rate_options_json?: string;
  comfort_score?: number | null;
  comfort_reviews?: number | null;
  scarcity?: string;
  scarcity_active?: boolean;
  deal_key?: string;
  room_id?: string;
  hash?: string;
  crawl_dates_json?: string;
};

function linesFromUnknown(value: unknown): string {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean).join('\n');
  return value == null ? '' : String(value);
}

function attrsFromForm(form: Record<string, unknown>): Record<string, unknown> {
  const raw = form.stay_attrs;
  return isPlainObject(raw) ? { ...raw } : isPlainObject(form.attrs) ? { ...(form.attrs as object) } : {};
}

/** Payload AI lưu trú theo luồng meta / property / faq. */
export function buildStayEnrichPayload(
  form: Record<string, unknown>,
  stage: StayEnrichStage,
): Record<string, unknown> {
  if (stage === 'meta') {
    return { title: form.title || '' };
  }

  const attrs = normalizeStayAttrsForAi(attrsFromForm(form));
  const roomSummaries = Array.isArray(form.options)
    ? (form.options as StayRoomFormRow[])
        .map((row) => ({
          name: row.name || '',
          capacity: row.capacity ?? null,
          size_sqm: row.size_sqm ?? null,
          view: row.view || '',
          bed_label: row.bed_label || '',
          amenities: row.amenities
            ? row.amenities.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8)
            : [],
        }))
        .filter((r) => r.name)
    : [];

  if (stage === 'property') {
    // Facts khách sạn chỉ để AI đọc — backend cũng chỉ nhận content.
    return {
      title: form.title || '',
      location_label: form.location_label || '',
      star_rating: form.star_rating ?? null,
      price_from: form.price_from || '',
      currency: form.currency || '',
      seo_title: form.seo_title || '',
      seo_description: form.seo_description || '',
      attrs,
      options: roomSummaries,
      content: form.content || '',
    };
  }

  const base: Record<string, unknown> = {
    title: form.title || '',
    location_label: form.location_label || '',
    featured_quote_text: form.featured_quote_text || '',
    featured_quote_author: form.featured_quote_author || '',
    seo_slug: form.seo_slug || '',
    seo_title: form.seo_title || '',
    seo_description: form.seo_description || '',
    star_rating: form.star_rating ?? null,
    price_from: form.price_from || '',
    currency: form.currency || '',
    content: String(form.content ?? ''),
    attrs,
    options: roomSummaries,
  };

  if (stage === 'faq') {
    base.faqs = faqSkeleton(form, false);
    base.faq_rewrite = true;
  }

  return base;
}

function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Decode *_json form fields so the model reads structured facts. */
function normalizeStayAttrsForAi(attrs: Record<string, unknown>): Record<string, unknown> {
  const out = { ...attrs };
  for (const [from, to] of [
    ['amenity_groups_json', 'amenity_groups'],
    ['nearby_groups_json', 'nearby_groups'],
    ['review_scores_json', 'review_scores'],
    ['nearby_json', 'nearby'],
  ] as const) {
    if (out[from] != null && out[from] !== '') {
      const parsed = tryParseJson(out[from]);
      if (parsed !== undefined) out[to] = parsed;
    }
    delete out[from];
  }
  delete out.nearby;
  return out;
}

/** Merge kết quả AI lưu trú vào form admin. */
export function mergeStayEnrichFields<T extends Record<string, unknown>>(
  prev: T,
  fields: Record<string, unknown>,
): T {
  const filtered = { ...fields };
  delete filtered.summary;
  delete filtered.highlights;
  delete filtered.inclusions;
  delete filtered.exclusions;
  delete filtered.notes;
  // Facts khách sạn (tiện ích / phòng / chính sách) không nhận từ AI.
  delete filtered.attrs;
  delete filtered.options;
  delete filtered.stay_attrs;

  const out: Record<string, unknown> = { ...prev, ...mergeEnrichFields(prev, filtered) };

  return out as T;
}
