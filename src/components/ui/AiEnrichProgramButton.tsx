'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { applyAiFilledMarks } from '@/lib/aiTranslateFields';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import {
  buildPackageEnrichPayload,
  buildServiceEnrichPayload,
  mergeEnrichFields,
  snapshotFormForAiRun,
  type DetailEnrichStage,
} from '@/lib/aiEnrichFields';
import clsx from 'clsx';

type EnrichResponse = {
  fields: Record<string, unknown>;
  provider?: string;
  model?: string;
  latency_ms?: number;
  prompt_key?: string;
  prompt_version?: number | null;
  stage?: string;
};

type Props = {
  entityType: string;
  locale: string;
  kind?: 'package' | 'service';
  getForm: () => Record<string, unknown>;
  applyFields: (fields: Record<string, unknown>) => void;
  className?: string;
  label?: string;
};

const STAGE_OPTIONS = [
  { value: 'meta', label: '1. Thông tin bài + SEO (chỉ tiêu đề)' },
  { value: 'content', label: '2. Nội dung chi tiết (lịch trình / bài)' },
  { value: 'faq', label: '3. Câu hỏi thường gặp' },
];

const STAGE_ORDER: DetailEnrichStage[] = ['meta', 'content', 'faq'];

const STAGE_META: Record<DetailEnrichStage, { title: string; detail: string }> = {
  meta: { title: 'Thông tin bài + SEO', detail: 'Đang soạn tóm tắt, điểm đến, meta…' },
  content: { title: 'Nội dung chi tiết', detail: 'Đang soạn lịch trình / nội dung HTML…' },
  faq: { title: 'Câu hỏi thường gặp', detail: 'Đang soạn FAQ từ tiêu đề + SEO + nội dung…' },
};

function resolveStages(selected: string[]): DetailEnrichStage[] {
  const set = new Set(selected);
  return STAGE_ORDER.filter((s) => set.has(s));
}

/** Nút AI xây dựng chương trình — đặt sát trái nhóm Hủy/Xem/Lưu. */
export function AiEnrichProgramButton({
  entityType,
  locale,
  kind,
  getForm,
  applyFields,
  className,
  label = 'AI chương trình',
}: Props) {
  const resolvedKind: 'package' | 'service' =
    kind ?? (entityType === 'service' || entityType === 'service_product' ? 'service' : 'package');
  const { projectCode } = useAuth();
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
      title: multi ? `AI đang chạy ${stages.length} luồng tuần tự` : `AI — ${STAGE_META[stages[0]].title}`,
      subtitle: entityType,
      detail: 'Đang đọc form…',
      indeterminate: true,
      percent: 8,
    });

    try {
      await new Promise<void>((r) => window.setTimeout(r, 40));
      // Snapshot form hiện tại (DB + chỉnh trên form, chưa lưu). Các bước sau merge vào `live`
      // — không đọc lại server, không dùng getForm() giữa chừng (tránh React state chưa kịp flush).
      let live = snapshotFormForAiRun(getForm() || {});
      if (!String(live.title || '').trim()) {
        await progress.fail({
          title: 'Thiếu tiêu đề',
          subtitle: 'Nhập tiêu đề chương trình trước khi chạy AI.',
          detail: 'Luồng thông tin + SEO chỉ nhận tiêu đề.',
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

        const fields =
          resolvedKind === 'service'
            ? buildServiceEnrichPayload(live, stage)
            : buildPackageEnrichPayload(live, stage);

        const res = await apiRequest<EnrichResponse>('/ai/enrich-detail-program', {
          method: 'POST',
          projectCode,
          body: {
            entity_type: entityType,
            locale,
            stage,
            provider: opts.provider,
            instructions: opts.instructions || null,
            fields,
          },
        });

        const applied = res.fields || {};
        live = mergeEnrichFields(live, applied);
        applyFields(applied);
        filledCount += applyAiFilledMarks(markAiFilled, applied).length;
        lastRes = res;
        if (typeof res.latency_ms === 'number' && res.latency_ms > 0) {
          totalMs += res.latency_ms;
        }
      }

      progress.update({
        title: 'Đang áp dụng vào form',
        detail: 'Đã ghi từng bước vào các trường…',
        percent: 92,
        indeterminate: false,
      });

      await new Promise<void>((r) => window.setTimeout(r, 80));

      const via = [lastRes?.provider, lastRes?.model].filter(Boolean).join(' · ');
      const latency = totalMs > 0 ? `${(totalMs / 1000).toFixed(1)}s` : null;
      const keys = stages.map((s) => STAGE_META[s].title).join(' → ');

      await progress.success({
        title: multi ? `Đã chạy xong ${stages.length} luồng` : 'Đã xây dựng xong',
        subtitle: `${filledCount} nhóm nội dung — ${keys}`,
        detail: [via, latency].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1400,
      });

      toast.success(
        via
          ? `AI đã điền ${filledCount} nhóm (${via}). Kiểm tra rồi Lưu.`
          : `AI đã điền ${filledCount} nhóm. Kiểm tra rồi Lưu.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI xây dựng thất bại';
      await progress.fail({
        title: 'AI xây dựng thất bại',
        subtitle: 'Các bước đã xong vẫn giữ trên form. Bước lỗi không ghi đè.',
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
        className={clsx(
          'ui-form-footer__ai',
          busy && 'is-loading',
          actionsLocked && 'is-blocked',
          className,
        )}
        onClick={() => {
          if (busy || actionsLocked) {
            if (actionsLocked && !busy) {
              toast.error('Trang cha chưa có bản dịch cho ngôn ngữ này — không thể chạy AI.');
            }
            return;
          }
          setConfirmOpen(true);
        }}
        disabled={busy || actionsLocked}
        title={
          actionsLocked
            ? 'Trang cha chưa có bản dịch — không thể chạy AI'
            : 'AI xây dựng chương trình: 3 luồng tuần tự hoặc chạy riêng'
        }
        aria-label={label}
        aria-busy={busy}
      >
        {busy ? <Loader2 size={17} className="ui-spin" /> : <Sparkles size={17} strokeWidth={2.15} />}
        <span>{busy ? 'Đang soạn…' : label}</span>
      </button>

      <AiConfirmModal
        open={confirmOpen}
        mode="enrich"
        title="Xây dựng chương trình bằng AI"
        description="Mặc định chạy tuần tự cả 3 bước: thông tin + SEO (chỉ tiêu đề) → nội dung chi tiết → FAQ (dùng dữ liệu mới nhất). Bỏ tick nếu chỉ muốn chạy lại 1–2 bước."
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
