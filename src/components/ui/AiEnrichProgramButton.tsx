'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { listAiFilledFieldKeys, applyAiFilledMarks } from '@/lib/aiTranslateFields';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import clsx from 'clsx';

type EnrichResponse = {
  fields: Record<string, unknown>;
  provider?: string;
  model?: string;
  latency_ms?: number;
  prompt_key?: string;
  prompt_version?: number | null;
};

type Props = {
  entityType: string;
  locale: string;
  getFields: () => Record<string, unknown>;
  applyFields: (fields: Record<string, unknown>) => void;
  className?: string;
  label?: string;
};

/** Nút AI xây dựng chương trình — đặt sát trái nhóm Hủy/Xem/Lưu. */
export function AiEnrichProgramButton({
  entityType,
  locale,
  getFields,
  applyFields,
  className,
  label = 'AI chương trình',
}: Props) {
  const actionsLocked = useFormActionsLocked();
  const progress = useBlockingProgress();
  const { mark: markAiFilled } = useAiFilledActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = progress.state.open;

  const run = async (opts: AiConfirmResult) => {
    setConfirmOpen(false);

    progress.show({
      title: 'AI đang xây dựng chương trình',
      subtitle: entityType,
      detail: 'Đang gửi context sản phẩm…',
      indeterminate: true,
      percent: 10,
    });

    try {
      await new Promise<void>((r) => window.setTimeout(r, 40));
      const fields = getFields() || {};
      if (Object.keys(fields).length === 0) {
        await progress.fail({
          title: 'Thiếu dữ liệu nguồn',
          subtitle: 'Hãy nhập ít nhất tiêu đề / tóm tắt / thời lượng.',
          detail: 'AI cần context tối thiểu để viết chương trình.',
          holdMs: 1600,
        });
        return;
      }

      progress.update({
        detail: 'AI đang soạn lịch trình, điểm nhấn, FAQ, SEO…',
        percent: 40,
        indeterminate: true,
      });

      const res = await apiRequest<EnrichResponse>('/ai/enrich-detail-program', {
        method: 'POST',
        body: {
          entity_type: entityType,
          locale,
          provider: opts.provider,
          instructions: opts.instructions || null,
          fields,
        },
      });

      progress.update({
        title: 'Đang áp dụng vào form',
        detail: 'Ghi nội dung AI vào các trường…',
        percent: 88,
        indeterminate: false,
      });

      await new Promise<void>((r) => window.setTimeout(r, 80));
      const applied = res.fields || {};
      applyFields(applied);
      const filledCount = applyAiFilledMarks(markAiFilled, applied).length;

      const via = [res.provider, res.model].filter(Boolean).join(' · ');
      const latency =
        typeof res.latency_ms === 'number' && res.latency_ms > 0
          ? `${(res.latency_ms / 1000).toFixed(1)}s`
          : null;

      await progress.success({
        title: 'Đã xây dựng xong',
        subtitle: `${filledCount} nhóm nội dung — badge AI đánh dấu ô vừa cập nhật.`,
        detail: [via, latency, res.prompt_key].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1200,
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
        subtitle: 'Không ghi đè form. Bạn có thể thử lại.',
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
            : 'AI xây dựng / hoàn thiện chương trình chi tiết'
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
        description="AI đọc toàn bộ thông tin hiện có và hoàn thiện nội dung chi tiết theo đúng định dạng form. Kết quả ghi vào ô đang mở (chưa Lưu)."
        showInstructions
        confirmLabel="Chạy AI"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={run}
      />
    </>
  );
}
