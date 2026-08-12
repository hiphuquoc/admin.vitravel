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
        return mergeRow(old, {
          day_number: cell.day_number ?? i + 1,
          meals_included: cell.meals_included ?? '',
          transport_icons: old.transport_icons ?? '',
          title: cell.title ?? '',
          content: typeof cell.content === 'string' ? cell.content : (old.content ?? ''),
          overnight_at: cell.overnight_at ?? '',
          id: old.id ?? cell.id ?? null,
        });
      });
      continue;
    }

    if (key === 'faqs' && Array.isArray(value)) {
      const prevList = Array.isArray(prev.faqs) ? (prev.faqs as Record<string, unknown>[]) : [];
      out.faqs = value.map((row, i) => {
        const cell = isPlainObject(row) ? row : {};
        const old = isPlainObject(prevList[i]) ? prevList[i] : {};
        return mergeRow(old, {
          question: cell.question ?? '',
          answer: cell.answer ?? '',
          id: old.id ?? cell.id ?? null,
        });
      });
      continue;
    }

    // Context-only keys (duration…) — bỏ qua nếu form không có string field tương ứng cần AI ghi.
    if (
      [
        'duration_days',
        'duration_nights',
        'price_from',
        'currency',
        'status',
        'code',
        'country_id',
        'category_ids',
        'travel_style_ids',
        'cover',
        'cluster',
        'service_category_id',
      ].includes(key)
    ) {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      if (typeof prev[key] === 'boolean') {
        out[key] = Boolean(value);
      } else if (typeof prev[key] === 'number') {
        const n = Number(value);
        out[key] = Number.isFinite(n) ? n : prev[key];
      } else {
        out[key] = value == null ? '' : String(value);
      }
    }
  }

  return out as T;
}

/** Payload gửi AI — gồm nội dung + context kỹ thuật (không phải media/id). */
export function buildPackageEnrichPayload(form: Record<string, unknown>): Record<string, unknown> {
  return {
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
    itinerary: Array.isArray(form.itinerary)
      ? (form.itinerary as Record<string, unknown>[]).map((row, i) => ({
          day_number: row.day_number || i + 1,
          meals_included: row.meals_included || '',
          title: row.title || '',
          // Không gửi HTML ngày cũ — tránh model giữ nguyên / chỉ viết lại ngày cuối.
          content: '',
          overnight_at: row.overnight_at || '',
          content_rewrite: true,
        }))
      : [],
    faqs: Array.isArray(form.faqs)
      ? (form.faqs as Record<string, unknown>[]).map((row) => ({
          question: row.question || '',
          answer: row.answer || '',
        }))
      : [],
  };
}

export function buildServiceEnrichPayload(form: Record<string, unknown>): Record<string, unknown> {
  return {
    title: form.title || '',
    code: form.code || '',
    cluster: form.cluster || '',
    location_label: form.location_label || '',
    price_from: form.price_from || '',
    currency: form.currency || '',
    summary: form.summary || '',
    // Không gửi HTML cũ — tránh model giữ nguyên / viết sơ.
    content: '',
    content_rewrite: true,
    highlights: form.highlights || '',
    inclusions: form.inclusions || '',
    exclusions: form.exclusions || '',
    notes: form.notes || '',
    seo_slug: form.seo_slug || '',
    seo_title: form.seo_title || '',
    seo_description: form.seo_description || '',
  };
}
