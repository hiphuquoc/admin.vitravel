'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast, { notify } from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import {
  getListingPageTitle,
  listingEnrichAppliedKeys,
  type ListingEnrichEntityType,
} from '@/lib/aiEnrichFields';
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
  entityType: ListingEnrichEntityType;
  locale: string;
  hubKey?: string;
  getForm: () => Record<string, unknown>;
  applyFields: (fields: Record<string, unknown>) => void;
  className?: string;
  label?: string;
};

/** Nút AI xây dựng nội dung trang listing — chỉ gửi tiêu đề, AI tự research + viết lại. */
export function AiEnrichListingButton({
  entityType,
  locale,
  hubKey,
  getForm,
  applyFields,
  className,
  label = 'AI trang listing',
}: Props) {
  const actionsLocked = useFormActionsLocked();
  const progress = useBlockingProgress();
  const { mark: markAiFilled } = useAiFilledActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = progress.state.open;

  const run = async (opts: AiConfirmResult) => {
    setConfirmOpen(false);

    progress.show({
      title: 'AI đang xây dựng trang listing',
      subtitle: entityType,
      detail: 'Chỉ dùng tiêu đề trang làm gợi ý…',
      indeterminate: true,
      percent: 10,
    });

    try {
      await new Promise<void>((r) => window.setTimeout(r, 40));
      const form = getForm() || {};
      const title = getListingPageTitle(form, entityType);
      if (!title) {
        await progress.fail({
          title: 'Thiếu tiêu đề',
          subtitle: 'Nhập tiêu đề / tên trang trước khi chạy AI.',
          detail: 'AI chỉ nhận tiêu đề — không dùng nội dung cũ để tránh nhiễu.',
          holdMs: 1600,
        });
        return;
      }

      progress.update({
        detail: 'AI đang research (web search) và soạn subtitle, SEO…',
        percent: 40,
        indeterminate: true,
      });

      const res = await apiRequest<EnrichResponse>('/ai/enrich-listing-page', {
        method: 'POST',
        body: {
          title,
          entity_type: entityType,
          hub_key: hubKey || null,
          locale,
          provider: opts.provider,
          instructions: opts.instructions || null,
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

      const filledKeys = listingEnrichAppliedKeys(applied, entityType);
      markAiFilled(filledKeys);
      if (typeof window !== 'undefined' && filledKeys.length) {
        window.setTimeout(() => markAiFilled(filledKeys), 0);
        window.setTimeout(() => markAiFilled(filledKeys), 150);
      }
      const filledCount = filledKeys.length;

      if (
        entityType === 'tour_category' &&
        Array.isArray(applied.faqs) &&
        applied.faqs.length > 0
      ) {
        notify.info(
          `AI đã soạn ${applied.faqs.length} FAQ — form chưa có ô FAQ, bỏ qua. Sẽ áp dụng khi có UI.`,
        );
      }

      const via = [res.provider, res.model].filter(Boolean).join(' · ');
      const latency =
        typeof res.latency_ms === 'number' && res.latency_ms > 0
          ? `${(res.latency_ms / 1000).toFixed(1)}s`
          : null;

      await progress.success({
        title: 'Đã xây dựng xong',
        subtitle: `${filledCount} trường — badge AI đánh dấu ô vừa cập nhật.`,
        detail: [via, latency, res.prompt_key].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1200,
      });

      toast.success(
        via
          ? `AI đã điền ${filledCount} trường (${via}). Kiểm tra rồi Lưu.`
          : `AI đã điền ${filledCount} trường. Kiểm tra rồi Lưu.`,
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
            : 'AI xây dựng nội dung trang danh mục / hub (chỉ từ tiêu đề)'
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
        title="Xây dựng trang listing bằng AI"
        description="AI chỉ đọc tiêu đề trang, tự research (web search) và viết lại subtitle, đoạn SEO, meta. Không gửi nội dung cũ để tránh nhiễu. Kết quả ghi vào form (chưa Lưu)."
        showInstructions
        confirmLabel="Chạy AI"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={run}
      />
    </>
  );
}
