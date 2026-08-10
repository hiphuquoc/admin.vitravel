'use client';

import { Select } from '@/components/ui/Field';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { Repeater } from '@/components/ui/Repeater';
import type { SelectOption } from '@/components/ui/Select';

export type FeaturedIdRow = {
  key: string;
  id?: number;
  value: string;
};

type FeaturedSelectRepeaterProps = {
  items: FeaturedIdRow[];
  onChange: (items: FeaturedIdRow[]) => void;
  options: SelectOption[];
  selectLabel: string;
  addLabel: string;
  emptyHint: string;
  max?: number;
  /** Gom trong FormSection cha — dùng FormCluster thay vì box riêng. */
  embedded?: boolean;
  clusterTitle?: string;
  /** Box độc lập (legacy) */
  title?: string;
  description?: string;
};

let rowSeq = 0;
export function newFeaturedRow(value = ''): FeaturedIdRow {
  rowSeq += 1;
  return { key: `f-${Date.now()}-${rowSeq}`, value };
}

export function mapFeaturedRows(
  rows: Array<Record<string, unknown>> | undefined,
  valueKey: string,
): FeaturedIdRow[] {
  return (rows || []).map((row, i) => ({
    key: `f-${String(row.id ?? i)}-${i}`,
    id: typeof row.id === 'number' ? row.id : undefined,
    value: row[valueKey] != null && row[valueKey] !== '' ? String(row[valueKey]) : '',
  }));
}

export function featuredPayload(rows: FeaturedIdRow[], valueKey: string) {
  return rows
    .filter((r) => r.value !== '')
    .map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      [valueKey]: Number(r.value),
    }));
}

export function FeaturedSelectRepeater({
  items,
  onChange,
  options,
  selectLabel,
  addLabel,
  emptyHint,
  max = 12,
  embedded = false,
  clusterTitle = 'Chọn hiển thị',
  title,
  description,
}: FeaturedSelectRepeaterProps) {
  const repeater = (
    <Repeater
      items={items}
      onChange={(next) => onChange(next.slice(0, max))}
      createItem={() => newFeaturedRow()}
      addLabel={items.length >= max ? `Đã đủ ${max} mục` : addLabel}
      emptyHint={emptyHint}
      maxItems={max}
      keyOf={(row) => row.key}
      renderItem={(row, _i, { update, structureLocked }) => (
        <Select
          label={selectLabel}
          searchable
          disabled={structureLocked}
          value={row.value}
          options={options}
          onChange={(v) => update({ value: v })}
          placeholder="— Chọn —"
        />
      )}
    />
  );

  if (embedded) {
    return (
      <FormCluster title={clusterTitle} cols={1} variant="picker">
        {repeater}
      </FormCluster>
    );
  }

  return (
    <FormSection title={title || clusterTitle} description={description}>
      {repeater}
    </FormSection>
  );
}
