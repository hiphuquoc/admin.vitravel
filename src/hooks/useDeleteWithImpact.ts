'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import type { DeleteImpact } from '@/lib/types';

type Target = { id: number; title: string };

type Options = {
  /** Invalidate sau khi xóa thành công. */
  queryKey: string | string[];
  removeFn: (id: number) => Promise<unknown>;
  impactFn: (id: number) => Promise<DeleteImpact>;
  entityLabel?: string;
  successMessage?: string;
};

/**
 * Modal xác nhận xóa + tải danh sách trang liên kết.
 * Dùng chung cho điểm đến, danh mục tour/cruise/service/blog, đối tượng khách…
 */
export function useDeleteWithImpact({
  queryKey,
  removeFn,
  impactFn,
  entityLabel = 'mục',
  successMessage = 'Đã xóa',
}: Options) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);

  const impactQuery = useQuery({
    queryKey: ['delete-impact', entityLabel, target?.id],
    queryFn: () => impactFn(target!.id),
    enabled: !!target,
    staleTime: 0,
    retry: 1,
  });

  const remove = useMutation({
    mutationFn: (id: number) => removeFn(id),
    onSuccess: async () => {
      toast.success(successMessage);
      setTarget(null);
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestDelete = useCallback((row: Target) => {
    setTarget(row);
  }, []);

  const cancel = useCallback(() => {
    if (remove.isPending) return;
    setTarget(null);
  }, [remove.isPending]);

  const confirm = useCallback(() => {
    if (!target) return;
    remove.mutate(target.id);
  }, [target, remove]);

  const impact: DeleteImpact | null = impactQuery.data
    ?? (impactQuery.isError
      ? {
          linked_count: 0,
          groups: [],
          warning:
            impactQuery.error instanceof Error
              ? `Không tải được danh sách liên kết: ${impactQuery.error.message}. Vẫn có thể xác nhận xóa.`
              : 'Không tải được danh sách liên kết. Vẫn có thể xác nhận xóa.',
        }
      : null);

  const modal = (
    <DeleteConfirmModal
      open={!!target}
      target={target}
      impact={impact}
      loadingImpact={impactQuery.isLoading || impactQuery.isFetching}
      busy={remove.isPending}
      entityLabel={entityLabel}
      onCancel={cancel}
      onConfirm={confirm}
    />
  );

  return { requestDelete, modal, isDeleting: remove.isPending };
}
