import type { PriceTableAdmin } from './types';

export type PriceVariantForm = {
  key: string;
  id: number | null;
  code: string;
  name: string;
  description: string;
  source: string;
  source_id: number | null;
  sort: number;
  is_active: boolean;
};

export type PricePeriodForm = {
  key: string;
  id: number | null;
  kind: 'date' | 'range' | 'year';
  starts_on: string;
  ends_on: string;
  year: string;
  label: string;
  is_promo: boolean;
  priority: string;
  is_active: boolean;
  rates: Record<string, { amount: string; compare_at: string }>;
};

export type PriceTableForm = {
  currency: string;
  unit: string;
  notes: string;
  variants: PriceVariantForm[];
  periods: PricePeriodForm[];
  suggested_variants: { code: string; name: string; description?: string | null; source: string; source_id?: number | null }[];
  units: Record<string, string>;
  period_kinds: Record<string, string>;
};

export function uid(prefix = 'k'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function rateKey(variantKey: string, guestTypeId: number): string {
  return `${variantKey}:${guestTypeId}`;
}

export function emptyVariant(partial?: Partial<PriceVariantForm>): PriceVariantForm {
  return {
    key: uid('v'),
    id: null,
    code: '',
    name: '',
    description: '',
    source: 'custom',
    source_id: null,
    sort: 0,
    is_active: true,
    ...partial,
  };
}

export function emptyPeriod(kind: PricePeriodForm['kind'] = 'range'): PricePeriodForm {
  return {
    key: uid('p'),
    id: null,
    kind,
    starts_on: '',
    ends_on: '',
    year: String(new Date().getFullYear()),
    label: '',
    is_promo: false,
    priority: '0',
    is_active: true,
    rates: {},
  };
}

export function emptyPriceTable(currency = 'VND'): PriceTableForm {
  return {
    currency,
    unit: 'per_person',
    notes: '',
    variants: [],
    periods: [],
    suggested_variants: [],
    units: {},
    period_kinds: {},
  };
}

export function hydratePriceTable(
  raw: PriceTableAdmin | null | undefined,
  currency = 'VND',
): PriceTableForm {
  if (!raw) {
    return emptyPriceTable(currency);
  }

  const variants = (raw.variants || []).map((row, i) =>
    emptyVariant({
      key: row.id ? `v-${row.id}` : uid('v'),
      id: row.id ?? null,
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      source: row.source || 'custom',
      source_id: row.source_id ?? null,
      sort: row.sort ?? i,
      is_active: row.is_active !== false,
    }),
  );

  const byId = new Map(variants.filter((v) => v.id).map((v) => [v.id as number, v.key]));

  const periods = (raw.periods || []).map((row, i) => {
    const rates: PricePeriodForm['rates'] = {};
    for (const rate of row.rates || []) {
      const variantKey = byId.get(rate.variant_id);
      if (!variantKey) continue;
      rates[rateKey(variantKey, rate.guest_type_id)] = {
        amount: rate.amount != null ? String(Math.round(Number(rate.amount))) : '',
        compare_at:
          rate.compare_at_amount != null ? String(Math.round(Number(rate.compare_at_amount))) : '',
      };
    }
    const kind = row.kind === 'date' || row.kind === 'year' ? row.kind : 'range';
    return {
      key: row.id ? `p-${row.id}` : uid('p'),
      id: row.id ?? null,
      kind,
      starts_on: row.starts_on || '',
      ends_on: row.ends_on || '',
      year: row.year != null ? String(row.year) : '',
      label: row.label || '',
      is_promo: !!row.is_promo,
      priority: String(row.priority ?? i),
      is_active: row.is_active !== false,
      rates,
    } satisfies PricePeriodForm;
  });

  return {
    currency: raw.currency || currency,
    unit: raw.unit || 'per_person',
    notes: raw.notes || '',
    variants,
    periods,
    suggested_variants: raw.suggested_variants || [],
    units: raw.units || {},
    period_kinds: raw.period_kinds || {},
  };
}

export function serializePriceTable(form: PriceTableForm): Record<string, unknown> {
  return {
    currency: form.currency || 'VND',
    unit: form.unit || 'per_person',
    notes: form.notes || null,
    variants: form.variants
      .filter((row) => row.name.trim() || row.code.trim() || row.id)
      .map((row, i) => ({
      id: row.id || undefined,
      code: row.code || undefined,
      name: row.name,
      description: row.description || null,
      source: row.source || 'custom',
      source_id: row.source_id || undefined,
      sort: i,
      is_active: row.is_active,
    })),
    periods: form.periods
      .filter((row) => (row.kind === 'year' ? !!row.year : !!row.starts_on))
      .map((row, i) => {
      const rates = Object.entries(row.rates)
        .map(([key, cell]) => {
          if (!cell.amount) return null;
          const [variantKey, guestId] = key.split(':');
          const variant = form.variants.find((v) => v.key === variantKey);
          if (!variant) return null;
          return {
            variant_id: variant.id || undefined,
            variant_code: variant.code || undefined,
            guest_type_id: Number(guestId),
            amount: Number(cell.amount),
            compare_at_amount: cell.compare_at ? Number(cell.compare_at) : null,
          };
        })
        .filter(Boolean);

      return {
        id: row.id || undefined,
        kind: row.kind,
        starts_on: row.starts_on || undefined,
        ends_on: row.ends_on || undefined,
        year: row.kind === 'year' && row.year ? Number(row.year) : undefined,
        label: row.label || null,
        is_promo: row.is_promo,
        priority: Number(row.priority) || 0,
        sort: i,
        is_active: row.is_active,
        rates,
      };
    }),
  };
}
