'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';

export type AiConfirmResult = {
  provider: string | null;
  instructions: string;
  /** Các luồng đã chọn — chạy tuần tự theo thứ tự trong modal. */
  stages: string[];
};

type AiStatus = {
  configured?: boolean;
  default_provider?: string;
  providers?: Record<
    string,
    { configured?: boolean; model?: string | null; base_url?: string | null }
  >;
};

type Props = {
  open: boolean;
  /** translate | enrich */
  mode: 'translate' | 'enrich';
  title: string;
  description: string;
  /** Hiện ô hướng dẫn thêm (enrich). */
  showInstructions?: boolean;
  /** Checkbox từng luồng AI (meta / content / faq…). */
  stageOptions?: { value: string; label: string }[];
  /** Mặc định tick — không truyền thì tick tất cả option. */
  defaultStages?: string[];
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (result: AiConfirmResult) => void;
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Gemini',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
};

/** Modal 1 bước: chọn model + (tuỳ chọn) hướng dẫn — thay alert/confirm/prompt. */
export function AiConfirmModal({
  open,
  mode,
  title,
  description,
  showInstructions = false,
  stageOptions,
  defaultStages,
  confirmLabel = 'Tiếp tục',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [provider, setProvider] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(() => new Set());

  const allStageValues = useMemo(
    () => (stageOptions || []).map((o) => o.value),
    [stageOptions],
  );

  const statusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiRequest<AiStatus>('/ai/status'),
    enabled: open,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    const providers = statusQuery.data?.providers || {};
    const list = Object.entries(providers)
      .filter(([, meta]) => meta?.configured)
      .map(([key, meta]) => {
        const label = PROVIDER_LABELS[key] || key;
        const model = meta.model ? ` · ${meta.model}` : '';
        return { value: key === 'gemini' ? 'google' : key, label: `${label}${model}` };
      });
    return list.length
      ? list
      : [{ value: '', label: 'Chưa cấu hình API key — kiểm tra .env' }];
  }, [statusQuery.data]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setInstructions('');
    const defaults = defaultStages?.length ? defaultStages : allStageValues;
    setSelectedStages(new Set(defaults));
    const def = statusQuery.data?.default_provider || '';
    const normalized = def === 'gemini' ? 'google' : def;
    const first = options.find((o) => o.value)?.value || '';
    const pick =
      options.some((o) => o.value === normalized) ? normalized : first;
    setProvider(pick);
  }, [open, statusQuery.data, options, defaultStages, allStageValues]);

  const toggleStage = (value: string, checked: boolean) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, busy, onCancel]);

  if (!mounted || !open) return null;

  const hasStages = !!stageOptions?.length;
  const canSubmit = !!provider && !busy && (!hasStages || selectedStages.size > 0);

  return createPortal(
    <div
      className={clsx('ui-modal', open && 'ui-modal--open')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-ai-confirm-title"
    >
      <button
        type="button"
        className="ui-modal__veil"
        aria-label="Đóng"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="ui-modal__card ui-modal__card--form">
        <header className="ui-modal__head">
          <p className="ui-modal__eyebrow">{mode === 'translate' ? 'AI dịch' : 'AI chương trình'}</p>
          <h2 id="ui-ai-confirm-title" className="ui-modal__title">
            {title}
          </h2>
          <p className="ui-modal__desc">{description}</p>
        </header>

        <div className="ui-modal__body">
          <Select
            label="Model / provider"
            hint={
              statusQuery.isLoading
                ? 'Đang tải danh sách đã cấu hình…'
                : 'Chỉ hiện provider đã có API key'
            }
            value={provider}
            options={options}
            onChange={setProvider}
            disabled={busy || statusQuery.isLoading || options.every((o) => !o.value)}
            searchable={options.length > 5}
          />
          {hasStages ? (
            <Field
              label="Luồng chạy"
              hint="Chạy tuần tự theo thứ tự đã chọn — bước sau dùng dữ liệu vừa ghi. Bỏ tick nếu chỉ muốn chạy lại 1–2 bước."
            >
              <div className="ui-ai-stage-checks">
                {stageOptions!.map((opt) => (
                  <label key={opt.value} className="ui-ai-stage-checks__item">
                    <input
                      type="checkbox"
                      checked={selectedStages.has(opt.value)}
                      disabled={busy}
                      onChange={(e) => toggleStage(opt.value, e.target.checked)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          ) : null}
          {showInstructions ? (
            <Textarea
              label="Hướng dẫn thêm (tuỳ chọn)"
              hint="Ví dụ: nhấn mạnh trải nghiệm biển, 3N2Đ, giọng thân thiện…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              disabled={busy}
            />
          ) : null}
        </div>

        <footer className="ui-modal__foot">
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            loading={busy}
            onClick={() =>
              onConfirm({
                provider: provider || null,
                instructions: instructions.trim(),
                stages: hasStages ? Array.from(selectedStages) : [],
              })
            }
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
