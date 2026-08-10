'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

type PanelCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

export type FloatingPanelOptions = {
  /** Chiều cao list ưu tiên (px). */
  preferredMaxHeight?: number;
  /**
   * Độ rộng tối thiểu của drawer — không bắt buộc bằng trigger
   * (vd. project switcher / filter toolbar hẹp).
   */
  minWidth?: number;
  /**
   * Khi trigger hẹp hơn mức này và không truyền minWidth,
   * panel tự mở rộng để đọc label dài (filter list, header…).
   * @default 264
   */
  comfortableMinWidth?: number;
  /** Căn panel theo cạnh trái (start) hoặc phải (end) của trigger. */
  align?: 'start' | 'end';
};

/**
 * Positions a portaled dropdown under (or above) an anchor, avoiding viewport clip.
 */
export function useFloatingPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  preferredMaxHeightOrOptions: number | FloatingPanelOptions = 280,
): CSSProperties {
  const options: FloatingPanelOptions =
    typeof preferredMaxHeightOrOptions === 'number'
      ? { preferredMaxHeight: preferredMaxHeightOrOptions }
      : preferredMaxHeightOrOptions;

  const preferredMaxHeight = options.preferredMaxHeight ?? 280;
  const minWidth = options.minWidth ?? 0;
  const comfortableMinWidth = options.comfortableMinWidth ?? 264;
  const align = options.align ?? 'start';

  const [coords, setCoords] = useState<PanelCoords | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 6;
      const pad = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
      const spaceAbove = rect.top - gap - pad;
      const openUp = spaceBelow < Math.min(preferredMaxHeight, 200) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(preferredMaxHeight, openUp ? spaceAbove : spaceBelow));

      // Trigger hẹp (toolbar filter) → panel rộng hơn để đọc hết option.
      const floor =
        minWidth > 0
          ? minWidth
          : rect.width < comfortableMinWidth
            ? comfortableMinWidth
            : rect.width;

      const width = Math.min(
        Math.max(rect.width, floor),
        Math.max(120, window.innerWidth - pad * 2),
      );

      let left = align === 'end' ? rect.right - width : rect.left;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

      if (openUp) {
        setCoords({
          left,
          width,
          bottom: window.innerHeight - rect.top + gap,
          maxHeight,
        });
      } else {
        setCoords({
          left,
          width,
          top: rect.bottom + gap,
          maxHeight,
        });
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, preferredMaxHeight, minWidth, comfortableMinWidth, align]);

  if (!coords) {
    return { position: 'fixed', visibility: 'hidden', pointerEvents: 'none' };
  }

  return {
    position: 'fixed',
    zIndex: 1200,
    left: coords.left,
    width: coords.width,
    top: coords.top,
    bottom: coords.bottom,
    maxHeight: coords.maxHeight,
  };
}
