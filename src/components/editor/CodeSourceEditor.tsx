'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import clsx from 'clsx';

type Language = 'html' | 'json';

type Props = {
  language: Language;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
  /** CSS height, mặc định cân theo viewport */
  height?: string;
};

const highlightStyle = HighlightStyle.define([
  { tag: t.tagName, color: '#0f766e', fontWeight: '600' },
  { tag: t.angleBracket, color: '#64748b' },
  { tag: t.attributeName, color: '#b45309' },
  { tag: t.attributeValue, color: '#047857' },
  { tag: t.string, color: '#047857' },
  { tag: t.keyword, color: '#7c3aed' },
  { tag: t.propertyName, color: '#1d4ed8', fontWeight: '600' },
  { tag: t.number, color: '#c2410c' },
  { tag: t.bool, color: '#a21caf', fontWeight: '600' },
  { tag: t.null, color: '#a21caf', fontWeight: '600' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.punctuation, color: '#64748b' },
  { tag: t.bracket, color: '#475569' },
  { tag: t.meta, color: '#0e7490' },
  { tag: t.name, color: '#1d4ed8' },
]);

const shellTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize: '0.84rem',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    caretColor: 'var(--admin-primary-600)',
    paddingTop: '0.75rem',
    paddingBottom: '0.75rem',
    minHeight: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.55',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in srgb, var(--admin-page) 78%, var(--admin-surface))',
    color: 'var(--admin-muted)',
    border: 'none',
    borderRight: '1px solid var(--admin-line)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 0.65rem 0 0.35rem',
    minWidth: '2rem',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--admin-primary-100) 55%, transparent)',
    color: 'var(--admin-primary-800)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--admin-primary-50) 70%, transparent)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--admin-primary-600)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--admin-primary-200) 70%, transparent) !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--admin-primary-200) 80%, transparent)',
    outline: '1px solid var(--admin-primary-400)',
  },
  '.cm-foldPlaceholder': {
    background: 'var(--admin-primary-50)',
    border: '1px solid var(--admin-line)',
    color: 'var(--admin-ink-soft)',
  },
});

/** ~52vh, sàn 28rem, trần 44rem — khung soạn HTML/JSON */
const DEFAULT_HEIGHT = 'clamp(28rem, 52vh, 44rem)';

export function CodeSourceEditor({
  language,
  value,
  onChange,
  disabled,
  className,
  height = DEFAULT_HEIGHT,
  'aria-label': ariaLabel,
}: Props) {
  const extensions = useMemo(() => {
    const lang = language === 'html' ? html() : json();
    return [
      lang,
      shellTheme,
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      EditorView.editable.of(!disabled),
      EditorView.contentAttributes.of({
        'aria-label': ariaLabel || (language === 'html' ? 'HTML' : 'JSON'),
      }),
    ];
  }, [language, disabled, ariaLabel]);

  return (
    <div className={clsx('ui-code-source', className)} data-lang={language}>
      <CodeMirror
        value={value}
        height={height}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          bracketMatching: true,
          autocompletion: language === 'html',
          indentOnInput: true,
          syntaxHighlighting: false,
        }}
        extensions={extensions}
        editable={!disabled}
        onChange={onChange}
      />
    </div>
  );
}
