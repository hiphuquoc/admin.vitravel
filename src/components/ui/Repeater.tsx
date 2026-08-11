'use client';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useStructureLocked } from '@/hooks/useStructureLock';

type RepeaterProps<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel?: string;
  emptyHint?: string;
  keyOf?: (item: T, index: number) => string | number;
  /** Khóa thêm/xóa/sắp xếp khi bản dịch (mặc định true). Nội dung từng dòng vẫn sửa được. */
  lockStructure?: boolean;
  /** Giới hạn số dòng (nút Thêm bị disable khi đủ). */
  maxItems?: number;
  renderItem: (
    item: T,
    index: number,
    helpers: {
      update: (patch: Partial<T>) => void;
      remove: () => void;
      structureLocked: boolean;
    },
  ) => ReactNode;
};

export function Repeater<T>({
  items,
  onChange,
  createItem,
  addLabel = 'Thêm dòng',
  emptyHint = 'Chưa có mục nào. Bấm thêm để bắt đầu.',
  keyOf,
  lockStructure = true,
  maxItems,
  renderItem,
}: RepeaterProps<T>) {
  const structureLocked = useStructureLocked() && lockStructure;
  const atMax = typeof maxItems === 'number' && items.length >= maxItems;
  // Luôn patch trên snapshot mới nhất — tránh TipTap onUpdate (sau AI apply) ghi đè bằng `items` cũ.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const updateAt = (index: number, patch: Partial<T>) => {
    const current = itemsRef.current;
    onChange(current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeAt = (index: number) => {
    if (structureLocked) return;
    onChange(itemsRef.current.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    if (structureLocked) return;
    if (to < 0 || to >= itemsRef.current.length) return;
    const next = [...itemsRef.current];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div className="ui-repeater">
      {items.length === 0 ? (
        <p className="ui-repeater__empty">{emptyHint}</p>
      ) : (
        <div className="ui-repeater__list">
          {items.map((item, index) => (
            <div key={keyOf ? keyOf(item, index) : index} className="ui-repeater__item">
              <span className="ui-repeater__watermark" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="ui-repeater__rail" aria-hidden>
                <button
                  type="button"
                  className="ui-repeater__move"
                  title="Đưa lên"
                  disabled={structureLocked || index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <GripVertical size={15} />
                </button>
              </div>

              <div className="ui-repeater__content">
                {renderItem(item, index, {
                  update: (patch) => updateAt(index, patch),
                  remove: () => removeAt(index),
                  structureLocked,
                })}
              </div>

              {structureLocked ? null : (
                <button
                  type="button"
                  className="ui-repeater__delete"
                  onClick={() => removeAt(index)}
                  title="Xóa"
                  aria-label="Xóa mục"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="ui-repeater__footer">
        <Button
          type="button"
          variant="secondary"
          disabled={structureLocked || atMax}
          onClick={() => {
            if (structureLocked || atMax) return;
            onChange([...items, createItem()]);
          }}
        >
          <Plus size={16} />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
