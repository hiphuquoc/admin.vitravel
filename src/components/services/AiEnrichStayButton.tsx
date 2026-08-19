'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { applyAiFilledMarks } from '@/lib/aiTranslateFields';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import {
  buildStayEnrichPayload,
  mergeStayEnrichFields,
  type StayEnrichStage,
} from '@/lib/aiEnrichFields';
import clsx from 'clsx';

type EnrichResponse = {
  fields: Record<string, unknown>;
  provider?: string;
  model?: string;
  latency_ms?: number;
};

type Props = {
  locale: string;
  getForm: () => Record<string, unknown>;
  applyFields: (fields: Record<string, unknown>) => void;
  className?: string;
};

const STAGE_OPTIONS = [
  { value: 'meta', label: '1. Thông tin + SEO (chỉ tên chỗ nghỉ)' },
  { value: 'property', label: '2. Giới thiệu, tiện ích, phòng, chính sách' },
  { value: 'faq', label: '3. Câu hỏi thường gặp' },
];

const STAGE_ORDER: StayEnrichStage[] = ['meta', 'property', 'faq'];

const STAGE_META: Record<StayEnrichStage, { title: string; detail: string }> = {
  meta: { title: 'Thông tin + SEO', detail: 'Đang soạn summary, vị trí, meta…' },
  property: { title: 'Nội dung lưu trú', detail: 'Đang soạn giới thiệu, tiện ích, hạng phòng…' },
  faq: { title: 'FAQ đặt phòng', detail: 'Đang soạn FAQ từ nội dung đã có…' },
};

function resolveStages(selected: string[]): StayEnrichStage[] {
  const set = new Set(selected);
  return STAGE_ORDER.filter((s) => set.has(s));
}

export function AiEnrichStayButton({ locale, getForm, applyFields, className }: Props) {
  const actionsLocked = useFormActionsLocked();
  const progress = useBlockingProgress();
  const { mark: markAiFilled } = useAiFilledActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = progress.state.open;

  const run = async (opts: AiConfirmResult) => {
    setConfirmOpen(false);
    const stages = resolveStages(opts.stages);
    if (!stages.length) {
      toast.error('Chọn ít nhất một luồng để chạy AI.');
      return;
    }
    const multi = stages.length > 1;

    progress.show({
      title: multi ? `AI lưu trú — ${stages.length} luồng` : `AI — ${STAGE_META[stages[0]].title}`,
      subtitle: 'accommodation_stay',
      detail: 'Đang đọc form…',
      indeterminate: true,
      percent: 8,
    });

    try {
      let live = { ...(getForm() || {}) };
      if (!String(live.title || '').trim()) {
        await progress.fail({
          title: 'Thiếu tên chỗ nghỉ',
          subtitle: 'Nhập tên khách sạn/resort trước khi chạy AI.',
          detail: 'Luồng meta chỉ nhận title.',
          holdMs: 1600,
        });
        return;
      }

      let filledCount = 0;
      let lastRes: EnrichResponse | null = null;
      let totalMs = 0;

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const meta = STAGE_META[stage];
        progress.update({
          title: multi ? `Bước ${i + 1}/${stages.length}: ${meta.title}` : `AI — ${meta.title}`,
          detail: meta.detail,
          percent: 12 + Math.round((i / stages.length) * 70),
          indeterminate: true,
        });

        const res = await apiRequest<EnrichResponse>('/ai/enrich-stay', {
          method: 'POST',
          body: {
            locale,
            stage,
            provider: opts.provider,
            instructions: opts.instructions || null,
            fields: buildStayEnrichPayload(live, stage),
          },
        });

        const applied = res.fields || {};
        live = mergeStayEnrichFields(live, applied);
        applyFields(applied);
        filledCount += applyAiFilledMarks(markAiFilled, applied).length;
        lastRes = res;
        if (typeof res.latency_ms === 'number' && res.latency_ms > 0) totalMs += res.latency_ms;
      }

      const via = [lastRes?.provider, lastRes?.model].filter(Boolean).join(' · ');
      await progress.success({
        title: multi ? `Đã chạy xong ${stages.length} luồng lưu trú` : 'Đã xây dựng xong',
        subtitle: `${filledCount} nhóm nội dung`,
        detail: via || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1400,
      });
      toast.success(`AI đã điền ${filledCount} nhóm. Kiểm tra rồi Lưu.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI lưu trú thất bại';
      await progress.fail({
        title: 'AI lưu trú thất bại',
        subtitle: 'Các bước đã xong vẫn giữ trên form.',
        detail: message,
        holdMs: 1800,
      });
      toast.error(message);
    }
  };

  return (
    <>
      <button
        type="button"
        className={clsx('ui-form-footer__ai', busy && 'is-loading', actionsLocked && 'is-blocked', className)}
        onClick={() => !busy && !actionsLocked && setConfirmOpen(true)}
        disabled={busy || actionsLocked}
        title="AI xây dựng trang lưu trí — 3 luồng tuần tự"
      >
        {busy ? <Loader2 size={17} className="ui-spin" /> : <Sparkles size={17} strokeWidth={2.15} />}
        <span>{busy ? 'Đang soạn…' : 'AI lưu trú'}</span>
      </button>

      <AiConfirmModal
        open={confirmOpen}
        mode="enrich"
        title="Xây dựng trang lưu trí bằng AI"
        description="Mặc định chạy cả 3 bước: meta → nội dung & phòng → FAQ. Bước sau dùng dữ liệu vừa ghi trên form."
        showInstructions
        stageOptions={STAGE_OPTIONS}
        confirmLabel="Chạy AI"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={run}
      />
    </>
  );
}
