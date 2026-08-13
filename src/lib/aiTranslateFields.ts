/** Keys cấu trúc — không gửi AI dịch (đồng bộ khóa UI bản dịch). */
const STRUCTURE_KEYS = new Set([
  'id',
  'locale',
  'sort',
  'status',
  'code',
  'key',
  'type',
  'cluster',
  'icon',
  'cta_url',
  'meals_included',
  'transport_icons',
  'day_number',
  'currency',
  'cruise_type',
  'country_id',
  'blog_category_id',
  'seo_parent_id',
  'rating_aggregate_star',
  'rating_aggregate_count',
  'duration_days',
  'duration_nights',
  'nights_on_board',
  'price_from',
  'discount_badge',
  'home_grid_size',
  'cover',
  'banner',
  'listing_banner',
  'thumbnail',
  'video',
  'avatar',
  'source',
  'youtube_input',
  'youtube_id',
]);

/** Luôn dịch khi có nội dung — không bị regex cấu trúc nuốt nhầm. */
const ALWAYS_TRANSLATABLE = new Set([
  'title',
  'name',
  'body',
  'seo_body',
  'excerpt',
  'content',
  'description',
  'subtitle',
  'eyebrow',
  'cta_label',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'seo_slug',
  'author_name',
  'slogan',
  'mission_title',
  'mission_text',
  'vision_title',
  'vision_text',
  'about_page_title',
  'about_page_subtitle',
  'about_seo_title',
  'about_seo_description',
  'sales_policy_title',
  'sales_policy_content',
  'values_section_title',
  'reasons_section_title',
  'reference_section_title',
  'role',
  'bio',
  'quote',
  'question',
  'answer',
  'summary',
  'highlights_intro',
  'featured_quote_text',
  'featured_quote_author',
  'places_to_visit',
  'highlight_bullets',
  'inclusions',
  'exclusions',
  'notes',
  'departure_port',
  'boat_class',
  'start_location',
  'end_location',
  'overnight_at',
  'position',
  'short_bio',
  'full_bio',
  'tagline',
  'intro',
  'intro_text',
  'long_form_content',
  'seo_intro',
]);

/** Prefix / exact structural — có $ để không nuốt seo_description, title, … */
const STRUCTURE_KEY_RE =
  /^(id|locale|sort|status|code|type|cluster|icon|key|currency|cruise_type|seo_parent_id|seo_parent)$/i;
const STRUCTURE_PREFIX_RE =
  /^(is_|show_|remove_|price_|duration_|nights_|home_grid|discount_badge|rating_aggregate|stat_|years_|contact_)/i;
const STRUCTURE_SUFFIX_RE = /(_media_id|_ids?)$/i;
const STRUCTURE_MEDIA_RE =
  /^(cover|banner|listing_banner|thumbnail|video|avatar|youtube_input|youtube_id|video_media)$/i;
const STRUCTURE_CONTACT_RE = /^(phone|email|whatsapp|map_embed|license)$/i;

function isStructureKey(key: string): boolean {
  if (ALWAYS_TRANSLATABLE.has(key)) return false;
  if (STRUCTURE_KEYS.has(key)) return true;
  if (STRUCTURE_KEY_RE.test(key)) return true;
  if (STRUCTURE_PREFIX_RE.test(key)) return true;
  if (STRUCTURE_SUFFIX_RE.test(key)) return true;
  if (STRUCTURE_MEDIA_RE.test(key)) return true;
  if (STRUCTURE_CONTACT_RE.test(key)) return true;
  if (key.endsWith('_id') || key.endsWith('_ids')) return true;
  if (key.startsWith('is_') || key.startsWith('show_') || key.startsWith('remove_')) return true;
  return false;
}

function isTranslatableValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.some(isTranslatableValue);
  if (typeof value === 'object') {
    if ('media' in (value as object) && 'remove' in (value as object)) return false;
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => !isStructureKey(k) && isTranslatableValue(v),
    );
  }
  return false;
}

/** Lọc form state → chỉ field nội dung gửi AI. */
export function pickTranslatableFields(form: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (isStructureKey(key)) continue;
    if (!isTranslatableValue(value)) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((row) =>
        row && typeof row === 'object' && !Array.isArray(row)
          ? pickTranslatableFields(row as Record<string, unknown>)
          : row,
      );
      continue;
    }
    if (value && typeof value === 'object') {
      out[key] = pickTranslatableFields(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Deep-merge bản dịch vào form (chỉ ghi đè key có trong translated). */
export function mergeTranslatedFields<T extends Record<string, unknown>>(
  form: T,
  translated: Record<string, unknown>,
): T {
  const next: Record<string, unknown> = { ...form };
  for (const [key, value] of Object.entries(translated)) {
    if (!(key in form)) continue;
    if (value === null || value === undefined) continue;
    const prev = form[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      next[key] = mergeTranslatedFields(prev as Record<string, unknown>, value as Record<string, unknown>);
    } else if (Array.isArray(value) && Array.isArray(prev)) {
      next[key] = value.map((row, i) => {
        const base = prev[i];
        if (row && typeof row === 'object' && base && typeof base === 'object') {
          return mergeTranslatedFields(
            base as Record<string, unknown>,
            row as Record<string, unknown>,
          );
        }
        return row ?? base;
      });
    } else {
      next[key] = value;
    }
  }
  return next as T;
}

/** Key top-level + nested (itinerary.0.title, faqs.1.answer…) AI trả về — dùng highlight input. */
export function listAiFilledFieldKeys(translated: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const walk = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      // Nested content (title/content/question…) vẫn đánh dấu dù key trùng STRUCTURE ở chỗ khác
      const nestedContent =
        prefix !== '' &&
        (ALWAYS_TRANSLATABLE.has(key) ||
          key === 'title' ||
          key === 'content' ||
          key === 'question' ||
          key === 'answer' ||
          key === 'overnight_at' ||
          key === 'summary' ||
          key === 'meals_included');

      if (!nestedContent && isStructureKey(key)) continue;
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      // HTML rỗng TipTap
      if (typeof value === 'string' && /^<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>$/i.test(value.trim())) {
        continue;
      }

      const path = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        // Không mark key mảng cha — chỉ mark từng field con để khớp name input
        value.forEach((item, i) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            walk(item as Record<string, unknown>, `${path}.${i}`);
          }
        });
        continue;
      }

      if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>, path);
        continue;
      }

      keys.add(path);
    }
  };
  walk(translated);
  return [...keys];
}

/** Mark AI-filled keys; re-apply sau sync TipTap/controlled để không bị clear sớm. */
export function applyAiFilledMarks(
  mark: (keys: string[]) => void,
  fields: Record<string, unknown>,
): string[] {
  const keys = listAiFilledFieldKeys(fields);
  mark(keys);
  if (typeof window !== 'undefined' && keys.length) {
    window.setTimeout(() => mark(keys), 0);
    window.setTimeout(() => mark(keys), 150);
  }
  return keys;
}
