'use client';

import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAiTranslateBridge } from '@/hooks/useAiFormTranslate';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { applyAiFilledMarks } from '@/lib/aiTranslateFields';
import { useStructureLocked, useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import { AiConfirmModal, type AiConfirmResult } from '@/components/ui/AiConfirmModal';
import clsx from 'clsx';

type TranslateResponse = {
  fields: Record<string, unknown>;
  provider?: string;
  model?: string;
  latency_ms?: number;
};

/** Nút AI dịch toàn trang — chỉ hiện khi đang sửa bản dịch (≠ locale mặc định). */
export function AiTranslatePageButton({ className }: { className?: string }) {
  const { projectCode } = useAuth();
  const structureLocked = useStructureLocked();
  const actionsLocked = useFormActionsLocked();
  const bridge = useAiTranslateBridge();
  const progress = useBlockingProgress();
  const { mark: markAiFilled } = useAiFilledActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = progress.state.open;

  if (!structureLocked || !bridge) return null;

  const blocked = actionsLocked;
  const source = bridge.sourceLocale.toUpperCase();
  const target = bridge.targetLocale.toUpperCase();

  const run = async (opts: AiConfirmResult) => {
    setConfirmOpen(false);
    progress.show({
      title: 'AI đang dịch toàn trang',
      subtitle: `${source} → ${target}`,
      detail: 'Đang lấy nội dung ngôn ngữ nguồn…',
      indeterminate: true,
      percent: 8,
    });

    try {
      await new Promise<void>((r) => window.setTimeout(r, 40));

      let fields: Record<string, unknown> = {};
      try {
        fields = bridge.getSourceFields
          ? await bridge.getSourceFields()
          : bridge.getFields();
      } catch {
        fields = bridge.getFields();
      }

      if (!fields || Object.keys(fields).length === 0) {
        await progress.fail({
          title: 'Không có nội dung để dịch',
          subtitle: `Bản «${source}» chưa có dữ liệu văn bản.`,
          detail: 'Hãy lưu nội dung ngôn ngữ nguồn trước.',
          holdMs: 1600,
        });
        return;
      }

      const fieldCount = Object.keys(fields).length;
      progress.update({
        subtitle: `${source} → ${target} · ${fieldCount} nhóm nội dung`,
        detail: 'AI đang dịch nội dung (gồm SEO)…',
        percent: 35,
        indeterminate: true,
      });

      const res = await apiRequest<TranslateResponse>('/ai/translate-page', {
        method: 'POST',
        projectCode,
        body: {
          source_locale: bridge.sourceLocale,
          target_locale: bridge.targetLocale,
          entity_type: bridge.entityType,
          provider: opts.provider,
          fields,
        },
      });

      progress.update({
        title: 'Đang áp dụng bản dịch',
        subtitle: `${source} → ${target}`,
        detail: 'Ghi nội dung đã dịch vào form…',
        percent: 88,
        indeterminate: false,
      });

      await new Promise<void>((r) => window.setTimeout(r, 80));
      const applied = res.fields || {};
      bridge.applyFields(applied);
      const filledCount = applyAiFilledMarks(markAiFilled, applied).length;

      const via = [res.provider, res.model].filter(Boolean).join(' · ');
      const latency =
        typeof res.latency_ms === 'number' && res.latency_ms > 0
          ? `${(res.latency_ms / 1000).toFixed(1)}s`
          : null;

      await progress.success({
        title: 'Đã dịch xong',
        subtitle: `${filledCount} trường đã điền — badge AI đánh dấu ô vừa cập nhật.`,
        detail: [via, latency].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1100,
      });

      toast.success(
        via
          ? `Đã dịch ${filledCount} trường (${via}).`
          : `Đã dịch ${filledCount} trường.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dịch AI thất bại';
      await progress.fail({
        title: 'Dịch AI thất bại',
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
          blocked && 'is-blocked',
          className,
        )}
        onClick={() => {
          if (busy || blocked) {
            if (blocked && !busy) {
              toast.error('Trang cha chưa có bản dịch cho ngôn ngữ này — không thể AI dịch.');
            }
            return;
          }
          setConfirmOpen(true);
        }}
        disabled={busy || blocked}
        title={
          blocked
            ? 'Trang cha chưa có bản dịch cho ngôn ngữ này — không thể AI dịch'
            : 'AI dịch toàn trang từ ngôn ngữ mặc định'
        }
        aria-label="AI dịch toàn trang"
        aria-busy={busy}
        aria-disabled={blocked}
      >
        {busy ? <Loader2 size={17} className="ui-spin" /> : <Languages size={17} strokeWidth={2.15} />}
        <span>{busy ? 'Đang dịch…' : 'AI dịch'}</span>
      </button>

      <AiConfirmModal
        open={confirmOpen}
        mode="translate"
        title={`Dịch ${source} → ${target}`}
        description="Lấy nội dung ngôn ngữ nguồn (kể cả SEO đang trống trên bản dịch) và ghi vào form đang mở. Chưa tự Lưu — bạn có thể chỉnh lại."
        confirmLabel="Dịch bằng AI"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={run}
      />
    </>
  );
}
