'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast, { notify } from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import {
  buildListingEnrichPayload,
  getListingPageTitle,
  listingEnrichAppliedKeys,
  mergeListingEnrichFields,
  snapshotFormForAiRun,
  type ListingEnrichEntityType,
  type ListingEnrichStage,
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
  entityType: ListingEnrichEntityType;
  locale: string;
  hubKey?: string;
  getForm: () => Record<string, unknown>;
  applyFields: (fields: Record<string, unknown>) => void;
  className?: string;
  label?: string;
};

const STAGE_OPTIONS = [
  { value: 'meta', label: '1. Tiêu đề + SEO (chỉ tiêu đề trang)' },
  { value: 'body', label: '2. Nội dung SEO (seo_body)' },
  { value: 'faq', label: '3. Câu hỏi thường gặp' },
];

const STAGE_ORDER: ListingEnrichStage[] = ['meta', 'body', 'faq'];

const STAGE_META: Record<ListingEnrichStage, { title: string; detail: string }> = {
  meta: { title: 'Tiêu đề + SEO', detail: 'Đang soạn H1, subtitle, meta…' },
  body: { title: 'Nội dung listing', detail: 'Đang soạn seo_body HTML…' },
  faq: { title: 'Câu hỏi thường gặp', detail: 'Đang soạn FAQ từ tiêu đề + SEO + nội dung…' },
};

function resolveStages(selected: string[]): ListingEnrichStage[] {
  const set = new Set(selected);
  return STAGE_ORDER.filter((s) => set.has(s));
}

/** Nút AI xây dựng nội dung trang listing — 3 luồng, mặc định tuần tự. */
export function AiEnrichListingButton({
  entityType,
  locale,
  hubKey,
  getForm,
  applyFields,
  className,
  label = 'AI trang listing',
}: Props) {
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
      title: multi ? `AI đang chạy ${stages.length} luồng listing` : `AI — ${STAGE_META[stages[0]].title}`,
      subtitle: entityType,
      detail: 'Đang đọc tiêu đề trang…',
      indeterminate: true,
      percent: 8,
    });

    try {
      await new Promise<void>((r) => window.setTimeout(r, 40));
      // Snapshot form hiện tại; các bước sau merge vào `live` (không đọc lại server / getForm giữa chừng).
      let live = snapshotFormForAiRun(getForm() || {});
      const title = getListingPageTitle(live, entityType);
      if (!title) {
        await progress.fail({
          title: 'Thiếu tiêu đề',
          subtitle: 'Nhập tiêu đề / tên trang trước khi chạy AI.',
          detail: 'Luồng SEO chỉ nhận tiêu đề — không dùng nội dung cũ.',
          holdMs: 1600,
        });
        return;
      }

      let filledCount = 0;
      let lastRes: EnrichResponse | null = null;
      let totalMs = 0;
      let faqCount = 0;

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const meta = STAGE_META[stage];
        progress.update({
          title: multi ? `Bước ${i + 1}/${stages.length}: ${meta.title}` : `AI — ${meta.title}`,
          detail: meta.detail,
          percent: 12 + Math.round((i / stages.length) * 70),
          indeterminate: true,
        });

        const payload = buildListingEnrichPayload(live, entityType, stage);
        const res = await apiRequest<EnrichResponse>('/ai/enrich-listing-page', {
          method: 'POST',
          projectCode,
          body: {
            title: String(payload.title || title),
            entity_type: entityType,
            hub_key: hubKey || null,
            locale,
            stage,
            provider: opts.provider,
            instructions: opts.instructions || null,
            fields: payload,
          },
        });

        const applied = res.fields || {};
        live = mergeListingEnrichFields(live, applied, entityType);
        applyFields(applied);
        const filledKeys = listingEnrichAppliedKeys(applied, entityType);
        markAiFilled(filledKeys);
        if (typeof window !== 'undefined' && filledKeys.length) {
          window.setTimeout(() => markAiFilled(filledKeys), 0);
          window.setTimeout(() => markAiFilled(filledKeys), 150);
        }
        filledCount += filledKeys.length;
        if (Array.isArray(applied.faqs)) {
          faqCount = applied.faqs.length;
        }
        lastRes = res;
        if (typeof res.latency_ms === 'number' && res.latency_ms > 0) {
          totalMs += res.latency_ms;
        }
      }

      if (faqCount > 0) {
        notify.info(
          `AI đã soạn ${faqCount} FAQ listing — form chưa có ô FAQ thì chỉ giữ trong state. Sẽ áp dụng khi có UI.`,
        );
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
        subtitle: `${filledCount} trường — ${keys}`,
        detail: [via, latency].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1400,
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
            : 'AI trang listing: 3 luồng tuần tự hoặc chạy riêng'
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
        description="Mặc định chạy tuần tự cả 3 bước: tiêu đề + SEO (chỉ title) → seo_body HTML → FAQ. Bước sau dùng dữ liệu vừa ghi. Bỏ tick nếu chỉ muốn chạy lại 1–2 bước."
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
