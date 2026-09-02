'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth-context';
import { runWithProjectScope } from '@/lib/apiScope';

export type AiTranslateFields = Record<string, unknown>;

export type AiTranslateBridge = {
  entityType: string;
  sourceLocale: string;
  targetLocale: string;
  /** Field đang mở trên form (target) — fallback nếu không lấy được nguồn. */
  getFields: () => AiTranslateFields;
  /**
   * Field từ ngôn ngữ nguồn (VI) — ưu tiên khi dịch.
   * Tránh bỏ sót seo_description khi bản dịch đang trống.
   */
  getSourceFields?: () => Promise<AiTranslateFields>;
  applyFields: (fields: AiTranslateFields) => void;
};

type BridgeMeta = {
  entityType: string;
  sourceLocale: string;
  targetLocale: string;
};

type Ctx = {
  bridge: AiTranslateBridge | null;
  register: (value: AiTranslateBridge) => void;
  unregister: () => void;
};

const AiFormTranslateContext = createContext<Ctx | null>(null);

function sameMeta(a: BridgeMeta | null, b: BridgeMeta): boolean {
  return (
    !!a &&
    a.entityType === b.entityType &&
    a.sourceLocale === b.sourceLocale &&
    a.targetLocale === b.targetLocale
  );
}

/** Bọc layout dashboard (hoặc từng form) — FormFooter đọc bridge để hiện nút AI. */
export function AiFormTranslateProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<BridgeMeta | null>(null);
  const handlersRef = useRef<{
    getFields: () => AiTranslateFields;
    getSourceFields?: () => Promise<AiTranslateFields>;
    applyFields: (fields: AiTranslateFields) => void;
  } | null>(null);

  const register = useCallback((value: AiTranslateBridge) => {
    handlersRef.current = {
      getFields: value.getFields,
      getSourceFields: value.getSourceFields,
      applyFields: value.applyFields,
    };
    const next: BridgeMeta = {
      entityType: value.entityType,
      sourceLocale: value.sourceLocale,
      targetLocale: value.targetLocale,
    };
    setMeta((prev) => (sameMeta(prev, next) ? prev : next));
  }, []);

  const unregister = useCallback(() => {
    handlersRef.current = null;
    setMeta((prev) => (prev === null ? prev : null));
  }, []);

  const bridge = useMemo<AiTranslateBridge | null>(() => {
    if (!meta) return null;
    return {
      entityType: meta.entityType,
      sourceLocale: meta.sourceLocale,
      targetLocale: meta.targetLocale,
      getFields: () => handlersRef.current?.getFields() ?? {},
      getSourceFields: async () => {
        if (handlersRef.current?.getSourceFields) {
          return handlersRef.current.getSourceFields();
        }
        return handlersRef.current?.getFields() ?? {};
      },
      applyFields: (fields) => {
        handlersRef.current?.applyFields(fields);
      },
    };
  }, [meta]);

  const value = useMemo(() => ({ bridge, register, unregister }), [bridge, register, unregister]);

  return (
    <AiFormTranslateContext.Provider value={value}>{children}</AiFormTranslateContext.Provider>
  );
}

/** Form đăng ký field dịch — gọi trong mỗi trang edit đa ngôn ngữ. */
export function useRegisterAiTranslate(opts: {
  enabled: boolean;
  entityType: string;
  sourceLocale: string;
  targetLocale: string;
  getFields: () => AiTranslateFields;
  /** Nên fetch bản locale nguồn (VI) — đủ SEO description / field trống trên bản dịch. */
  getSourceFields?: () => Promise<AiTranslateFields>;
  applyFields: (fields: AiTranslateFields) => void;
}) {
  const ctx = useContext(AiFormTranslateContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;
  const { projectCode } = useAuth();
  const projectCodeRef = useRef(projectCode);
  projectCodeRef.current = projectCode;

  const getRef = useRef(opts.getFields);
  const getSourceRef = useRef(opts.getSourceFields);
  const applyRef = useRef(opts.applyFields);
  getRef.current = opts.getFields;
  getSourceRef.current = opts.getSourceFields;
  applyRef.current = opts.applyFields;

  const { enabled, entityType, sourceLocale, targetLocale } = opts;

  useEffect(() => {
    if (!register || !unregister) return;

    if (!enabled) {
      unregister();
      return;
    }

    register({
      entityType,
      sourceLocale,
      targetLocale,
      getFields: () => getRef.current(),
      getSourceFields: getSourceRef.current
        ? async () =>
            runWithProjectScope(projectCodeRef.current ?? '_', () => getSourceRef.current!())
        : undefined,
      applyFields: (f) => applyRef.current(f),
    });

    return () => {
      unregister();
    };
  }, [register, unregister, enabled, entityType, sourceLocale, targetLocale, projectCode]);
}

export function useAiTranslateBridge(): AiTranslateBridge | null {
  return useContext(AiFormTranslateContext)?.bridge ?? null;
}
