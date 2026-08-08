'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

type PanelCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/**
 * Positions a portaled dropdown under (or above) an anchor, avoiding viewport clip.
 */
export function useFloatingPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  preferredMaxHeight = 280,
): CSSProperties {
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
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < Math.min(preferredMaxHeight, 200) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(preferredMaxHeight, openUp ? spaceAbove : spaceBelow));

      if (openUp) {
        setCoords({
          left: rect.left,
          width: rect.width,
          bottom: window.innerHeight - rect.top + gap,
          maxHeight,
        });
      } else {
        setCoords({
          left: rect.left,
          width: rect.width,
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
  }, [open, anchorRef, preferredMaxHeight]);

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
