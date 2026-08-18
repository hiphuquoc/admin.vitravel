'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { priceGuestTypesApi } from '@/lib/services';
import { useStructureLocked } from '@/hooks/useStructureLock';
import { Button } from '@/components/ui/Button';
import { Input, MoneyInput, Select, Switch, Textarea } from '@/components/ui/Field';
import { Repeater } from '@/components/ui/Repeater';
import {
  emptyPeriod,
  emptyVariant,
  rateKey,
  type PricePeriodForm,
  type PriceTableForm,
} from '@/lib/priceTable';

type Props = {
  value: PriceTableForm;
  onChange: (next: PriceTableForm) => void;
  locale?: string;
};

export function PriceTableEditor({ value, onChange, locale = 'vi' }: Props) {
  const structureLocked = useStructureLocked();
  const qc = useQueryClient();
  const [newGuestName, setNewGuestName] = useState('');
  const guestsQuery = useQuery({
    queryKey: ['price-guest-types', locale],
    queryFn: () => priceGuestTypesApi.list(locale),
  });

  const guestTypes = (guestsQuery.data?.items ?? []).filter((g) => g.is_active);
  const units = Object.keys(value.units).length
    ? value.units
    : guestsQuery.data?.units || { per_person: 'Người' };
  const periodKinds = Object.keys(value.period_kinds).length
    ? value.period_kinds
    : guestsQuery.data?.period_kinds || {
        date: 'Theo ngày',
        range: 'Khoảng ngày',
        year: 'Theo năm',
      };

  const usedSuggested = useMemo(() => {
    const set = new Set(
      value.variants.map((v) => `${v.source}:${v.source_id ?? ''}`),
    );
    return (value.suggested_variants || []).filter(
      (s) => !set.has(`${s.source}:${s.source_id ?? ''}`),
    );
  }, [value.suggested_variants, value.variants]);

  const patch = (partial: Partial<PriceTableForm>) => onChange({ ...value, ...partial });

  const addGuest = useMutation({
    mutationFn: () =>
      priceGuestTypesApi.create({
        name: newGuestName.trim(),
        locale,
      }),
    onSuccess: async () => {
      setNewGuestName('');
      toast.success('Đã thêm đối tượng khách');
      await qc.invalidateQueries({ queryKey: ['price-guest-types'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setRate = (
    periodKey: string,
    variantKey: string,
    guestTypeId: number,
    field: 'amount' | 'compare_at',
    amount: string,
  ) => {
    patch({
      periods: value.periods.map((p) => {
        if (p.key !== periodKey) return p;
        const key = rateKey(variantKey, guestTypeId);
        const prev = p.rates[key] || { amount: '', compare_at: '' };
        return { ...p, rates: { ...p.rates, [key]: { ...prev, [field]: amount } } };
      }),
    });
  };

  return (
    <div className="price-table-editor">
      <div className="ui-form-grid ui-form-grid--2">
        <Select
          label="Đơn vị tính"
          value={value.unit}
          onChange={(v) => patch({ unit: v })}
          disabled={structureLocked}
          options={Object.entries(units).map(([k, label]) => ({ value: k, label }))}
        />
        <Textarea
          label="Ghi chú bảng giá"
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          hint="Hiện dưới bảng giá public"
        />
      </div>

      <div className="price-table-editor__block">
        <div className="price-table-editor__block-head">
          <h3>Đối tượng khách</h3>
          <p>Cột giá — thêm loại mới (trẻ em, cao tuổi…) theo dự án, không hardcode.</p>
        </div>
        {guestTypes.length === 0 ? (
          <p className="ui-repeater__empty">
            Chưa có đối tượng khách. Thêm bên dưới hoặc chạy{' '}
            <code>php artisan db:seed --class=PriceGuestTypeSeeder</code>.
          </p>
        ) : (
          <ul className="price-table-editor__guests">
            {guestTypes.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong>
                {(g.age_min != null || g.age_max != null) && (
                  <span>
                    {g.age_min ?? 0}–{g.age_max ?? '+'} tuổi
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="price-table-editor__add-guest">
          <Input
            label="Thêm đối tượng"
            value={newGuestName}
            onChange={(e) => setNewGuestName(e.target.value)}
            placeholder="VD: Em bé dưới 2 tuổi"
            disabled={structureLocked}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={structureLocked || !newGuestName.trim()}
            loading={addGuest.isPending}
            onClick={() => addGuest.mutate()}
          >
            Thêm
          </Button>
        </div>
      </div>

      <div className="price-table-editor__block">
        <div className="price-table-editor__block-head">
          <h3>Tuỳ chọn / hạng</h3>
          <p>Cabin, loại phòng, ghế tàu, hoặc tuỳ chọn tự đặt.</p>
        </div>
        {usedSuggested.length > 0 && !structureLocked ? (
          <div className="price-table-editor__suggest">
            {usedSuggested.map((s) => (
              <Button
                key={`${s.source}-${s.source_id}-${s.code}`}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({
                    variants: [
                      ...value.variants,
                      emptyVariant({
                        code: s.code,
                        name: s.name,
                        description: s.description || '',
                        source: s.source,
                        source_id: s.source_id ?? null,
                      }),
                    ],
                  })
                }
              >
                <Plus size={14} /> {s.name}
              </Button>
            ))}
          </div>
        ) : null}
        <Repeater
          items={value.variants}
          onChange={(variants) => patch({ variants })}
          createItem={() => emptyVariant({ name: `Tuỳ chọn ${value.variants.length + 1}` })}
          addLabel="Thêm tuỳ chọn"
          emptyHint="Chưa có tuỳ chọn. Thêm một hạng / option để làm hàng của bảng giá."
          keyOf={(row) => row.key}
          renderItem={(row, _i, { update }) => (
            <>
              <Input
                label="Tên tuỳ chọn"
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <Input
                label="Mã"
                value={row.code}
                onChange={(e) => update({ code: e.target.value })}
                hint="Để trống sẽ tự tạo"
                disabled={structureLocked}
              />
            </>
          )}
        />
      </div>

      <div className="price-table-editor__block">
        <div className="price-table-editor__block-head">
          <h3>Giai đoạn giá</h3>
          <p>Theo ngày, khoảng ngày hoặc cả năm. Bật “Ưu đãi” để giai đoạn này đè giá gốc khi quote.</p>
        </div>
        <Repeater
          items={value.periods}
          onChange={(periods) => patch({ periods })}
          createItem={() => emptyPeriod('range')}
          addLabel="Thêm giai đoạn"
          emptyHint="Chưa có giai đoạn. Thêm khoảng ngày (mùa thấp / cao / lễ) rồi nhập ô giá."
          keyOf={(row) => row.key}
          renderItem={(row, _i, { update }) => (
            <PeriodBlock
              period={row}
              variants={value.variants}
              guestTypes={guestTypes}
              periodKinds={periodKinds}
              onUpdate={update}
              onRate={setRate}
              structureLocked={structureLocked}
            />
          )}
        />
      </div>
    </div>
  );
}

function PeriodBlock({
  period,
  variants,
  guestTypes,
  periodKinds,
  onUpdate,
  onRate,
  structureLocked,
}: {
  period: PricePeriodForm;
  variants: PriceTableForm['variants'];
  guestTypes: { id: number; name: string }[];
  periodKinds: Record<string, string>;
  onUpdate: (patch: Partial<PricePeriodForm>) => void;
  onRate: (
    periodKey: string,
    variantKey: string,
    guestTypeId: number,
    field: 'amount' | 'compare_at',
    amount: string,
  ) => void;
  structureLocked: boolean;
}) {
  return (
    <div className="price-table-editor__period">
      <div className="ui-form-grid ui-form-grid--2">
        <Select
          label="Kiểu giai đoạn"
          value={period.kind}
          onChange={(v) => onUpdate({ kind: v as PricePeriodForm['kind'] })}
          disabled={structureLocked}
          options={Object.entries(periodKinds).map(([k, label]) => ({ value: k, label }))}
        />
        <Input
          label="Nhãn"
          value={period.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="VD: Mùa hè 2026"
        />
        {period.kind === 'year' ? (
          <Input
            label="Năm"
            type="number"
            min={2000}
            max={2100}
            value={period.year}
            onChange={(e) => onUpdate({ year: e.target.value })}
            disabled={structureLocked}
          />
        ) : (
          <>
            <Input
              label={period.kind === 'date' ? 'Ngày' : 'Từ ngày'}
              type="date"
              value={period.starts_on}
              onChange={(e) =>
                onUpdate({
                  starts_on: e.target.value,
                  ends_on: period.kind === 'date' ? e.target.value : period.ends_on,
                })
              }
              disabled={structureLocked}
            />
            {period.kind === 'range' ? (
              <Input
                label="Đến ngày"
                type="date"
                value={period.ends_on}
                onChange={(e) => onUpdate({ ends_on: e.target.value })}
                disabled={structureLocked}
              />
            ) : null}
          </>
        )}
      </div>
      <div className="ui-form-flags">
        <Switch
          label="Giai đoạn khuyến mãi"
          checked={period.is_promo}
          onChange={(v) => onUpdate({ is_promo: v })}
          hint="Đè giá gốc khi cùng ngày"
        />
      </div>

      {variants.length === 0 || guestTypes.length === 0 ? (
        <p className="ui-repeater__empty">Cần ít nhất một tuỳ chọn và một đối tượng khách để nhập ô giá.</p>
      ) : (
        <div className="price-table-editor__scroll">
          <table className="price-table-editor__grid">
            <thead>
              <tr>
                <th>Tuỳ chọn</th>
                {guestTypes.map((g) => (
                  <th key={g.id}>{g.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.key}>
                  <th>{variant.name || variant.code || '—'}</th>
                  {guestTypes.map((g) => {
                    const cell = period.rates[rateKey(variant.key, g.id)] || {
                      amount: '',
                      compare_at: '',
                    };
                    return (
                      <td key={g.id}>
                        <MoneyInput
                          label="Giá"
                          value={cell.amount}
                          onValueChange={(v) =>
                            onRate(period.key, variant.key, g.id, 'amount', v)
                          }
                        />
                        <MoneyInput
                          label="Giá gốc (gạch)"
                          value={cell.compare_at}
                          onValueChange={(v) =>
                            onRate(period.key, variant.key, g.id, 'compare_at', v)
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
