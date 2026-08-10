'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type MediaUploadBusyApi = {
  /** Có ít nhất một ảnh/video đang upload. */
  busy: boolean;
  begin: () => void;
  end: () => void;
};

const MediaUploadBusyContext = createContext<MediaUploadBusyApi | null>(null);

export function MediaUploadBusyProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const begin = useCallback(() => {
    setCount((n) => n + 1);
  }, []);

  const end = useCallback(() => {
    setCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      busy: count > 0,
      begin,
      end,
    }),
    [count, begin, end],
  );

  return (
    <MediaUploadBusyContext.Provider value={value}>{children}</MediaUploadBusyContext.Provider>
  );
}

export function useMediaUploadBusy(): boolean {
  return useContext(MediaUploadBusyContext)?.busy ?? false;
}

/** ImageField / VideoField gọi khi uploading thay đổi. */
export function useReportMediaUpload(uploading: boolean): void {
  const api = useContext(MediaUploadBusyContext);

  useEffect(() => {
    if (!api || !uploading) return;
    api.begin();
    return () => api.end();
  }, [api, uploading]);
}
