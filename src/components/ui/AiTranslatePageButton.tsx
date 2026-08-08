'use client';

import { Languages, Loader2 } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAiTranslateBridge } from '@/hooks/useAiFormTranslate';
import { useAiFilledActions } from '@/hooks/useAiFilledFields';
import { listAiFilledFieldKeys } from '@/lib/aiTranslateFields';
import { useStructureLocked, useFormActionsLocked } from '@/hooks/useStructureLock';
import { useBlockingProgress } from '@/components/ui/BlockingProgress';
import clsx from 'clsx';

type TranslateResponse = {
  fields: Record<string, unknown>;
  provider?: string;
  model?: string;
  latency_ms?: number;
};

/** Nút AI dịch toàn trang — chỉ hiện khi đang sửa bản dịch (≠ locale mặc định). */
export function AiTranslatePageButton({ className }: { className?: string }) {
  const structureLocked = useStructureLocked();
  const actionsLocked = useFormActionsLocked();
  const bridge = useAiTranslateBridge();
  const progress = useBlockingProgress();
  const { mark: markAiFilled } = useAiFilledActions();
  const busy = progress.state.open;

  if (!structureLocked || !bridge) return null;

  const blocked = actionsLocked;

  const onClick = async () => {
    if (busy || blocked) {
      if (blocked && !busy) {
        toast.error('Trang cha chưa có bản dịch cho ngôn ngữ này — không thể AI dịch.');
      }
      return;
    }

    const source = bridge.sourceLocale.toUpperCase();
    const target = bridge.targetLocale.toUpperCase();
    const ok = window.confirm(
      `Dịch toàn bộ nội dung từ «${source}» sang «${target}» bằng AI?\n` +
        'Lấy nội dung ngôn ngữ nguồn (kể cả SEO đang trống trên bản dịch).\n' +
        'Kết quả ghi đè các ô đang mở (chưa Lưu). Có thể chỉnh lại trước khi lưu.',
    );
    if (!ok) return;

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
        detail: 'AI đang dịch nội dung (gồm SEO title / mô tả / slug)…',
        percent: 35,
        indeterminate: true,
      });

      const res = await apiRequest<TranslateResponse>('/ai/translate-page', {
        method: 'POST',
        body: {
          source_locale: bridge.sourceLocale,
          target_locale: bridge.targetLocale,
          entity_type: bridge.entityType,
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
      markAiFilled(listAiFilledFieldKeys(applied));

      const via = [res.provider, res.model].filter(Boolean).join(' · ');
      const latency =
        typeof res.latency_ms === 'number' && res.latency_ms > 0
          ? `${(res.latency_ms / 1000).toFixed(1)}s`
          : null;
      const filledCount = listAiFilledFieldKeys(applied).length;

      await progress.success({
        title: 'Đã dịch xong',
        subtitle: `${filledCount} trường đã điền — ô viền xanh là nội dung AI vừa cập nhật.`,
        detail: [via, latency].filter(Boolean).join(' · ') || 'Kiểm tra rồi bấm Lưu',
        holdMs: 1200,
      });

      toast.success(
        via
          ? `Đã dịch ${filledCount} trường (${via}). Ô highlight = AI vừa điền.`
          : `Đã dịch ${filledCount} trường. Ô highlight = AI vừa điền.`,
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
    <button
      type="button"
      className={clsx(
        'ui-form-footer__ai',
        busy && 'is-loading',
        blocked && 'is-blocked',
        className,
      )}
      onClick={onClick}
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
  );
}
