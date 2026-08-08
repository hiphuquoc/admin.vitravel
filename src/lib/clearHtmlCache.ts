import { cacheApi } from '@/lib/services';
import type { BlockingProgressApi } from '@/components/ui/BlockingProgress';

/**
 * Xóa HTML cache theo lô + cập nhật overlay tiến trình realtime.
 * Dùng chung từ menu hoặc chỗ khác qua `useBlockingProgress()`.
 */
export async function clearHtmlCacheWithProgress(progress: BlockingProgressApi): Promise<number> {
  progress.show({
    title: 'Đang xóa HTML cache',
    subtitle: 'Đang quét thư mục cache…',
    detail: 'Chuẩn bị…',
    percent: 0,
    indeterminate: true,
  });

  const meta = await cacheApi.meta();
  const sessionTotal = meta.total_files;
  const batchSize = meta.batch_size || 80;

  if (sessionTotal <= 0) {
    await cacheApi.finish();
    await progress.success({
      title: 'Không có cache để xóa',
      subtitle: 'Thư mục cache đang trống.',
      detail: '0 file',
      holdMs: 800,
    });
    return 0;
  }

  let cleared = 0;
  let safety = 0;
  const maxLoops = Math.ceil(sessionTotal / Math.max(1, batchSize)) + 20;

  progress.update({
    indeterminate: false,
    percent: 0,
    subtitle: `Tổng ${sessionTotal.toLocaleString('vi-VN')} file`,
    detail: `0 / ${sessionTotal.toLocaleString('vi-VN')} file`,
  });

  while (safety < maxLoops) {
    safety += 1;
    const batch = await cacheApi.clearBatch(batchSize);
    cleared += batch.deleted;

    const pct = Math.min(100, Math.round((cleared / sessionTotal) * 100));
    progress.update({
      percent: pct,
      detail: `${cleared.toLocaleString('vi-VN')} / ${sessionTotal.toLocaleString('vi-VN')} file`,
      subtitle:
        batch.remaining > 0
          ? `Còn ${batch.remaining.toLocaleString('vi-VN')} file…`
          : 'Đang dọn cache menu…',
    });

    if (batch.done) break;
    // Nhường event loop để UI kịp paint
    await new Promise<void>((r) => window.setTimeout(r, 0));
  }

  progress.update({
    percent: 100,
    subtitle: 'Đang dọn cache menu…',
    detail: `${cleared.toLocaleString('vi-VN')} file HTML đã xóa`,
  });
  await cacheApi.finish();

  await progress.success({
    title: 'Đã xóa HTML cache',
    subtitle: 'Trang public sẽ dựng lại cache khi được truy cập.',
    detail: `${cleared.toLocaleString('vi-VN')} file`,
    holdMs: 1000,
  });

  return cleared;
}
