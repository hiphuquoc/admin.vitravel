'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Redo2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import { Field } from '@/components/ui/FieldShell';
import {
  contentValueToHtml,
  htmlToContentValue,
  parseArticleContent,
  serializeArticleContent,
  slugifyHeading,
  type ArticleRouteLink,
} from '@/lib/articleContent';
import { ArticleImage, RelatedLinks } from '@/components/editor/articleExtensions';
import { CodeSourceEditor } from '@/components/editor/CodeSourceEditor';
import { useAiFilled, useAiFilledActions } from '@/hooks/useAiFilledFields';

type Mode = 'visual' | 'html' | 'json';

type Props = {
  label?: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** `blocks` = JSON article blocks (blog). `html` = TipTap HTML string (itinerary…). */
  format?: 'blocks' | 'html';
  /** Shorter editor surface for nested repeaters. */
  compact?: boolean;
  /** Key đánh dấu AI vừa điền. */
  aiFieldKey?: string;
};

/** Debounce commit HTML/JSON → form + TipTap (tránh parse mỗi phím). */
const SOURCE_SYNC_MS = 420;

function ToolbarBtn({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={clsx('ui-rte__btn', active && 'is-active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ArticleContentEditor({
  label = 'Nội dung',
  hint = 'Soạn trực quan, hoặc sửa HTML / JSON — tự đồng bộ khi dừng gõ hoặc khi chuyển tab Trực quan.',
  value,
  onChange,
  disabled,
  format = 'blocks',
  compact = false,
  aiFieldKey,
}: Props) {
  const [mode, setMode] = useState<Mode>('visual');
  const [htmlDraft, setHtmlDraft] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');
  const lastEmitted = useRef(value);
  const skipNextSync = useRef(false);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const formatRef = useRef(format);
  formatRef.current = format;
  const aiFilled = useAiFilled(aiFieldKey);
  const { clear: clearAiFilled } = useAiFilledActions();

  const availableModes = useMemo(
    () =>
      (format === 'html'
        ? ([['visual', 'Trực quan'], ['html', 'HTML']] as const)
        : ([['visual', 'Trực quan'], ['html', 'HTML'], ['json', 'JSON']] as const)),
    [format],
  );

  const initialHtml = useMemo(() => contentValueToHtml(value), []); // eslint-disable-line react-hooks/exhaustive-deps

  const emitFromHtml = useCallback(
    (html: string) => {
      const safe = html || '<p></p>';
      const next =
        formatRef.current === 'html'
          ? safe === '<p></p>'
            ? ''
            : safe
          : htmlToContentValue(safe);
      lastEmitted.current = next;
      skipNextSync.current = true;
      // Không clear AI highlight ở đây — TipTap sync sau applyFields dễ kích hoạt onUpdate
      // và xóa badge trước khi user kịp thấy. Clear khi user focus vào editor.
      onChange(next);
    },
    [onChange],
  );

  const commitHtmlDraft = useCallback(
    (html: string, ed: NonNullable<ReturnType<typeof useEditor>>) => {
      const safe = html || '<p></p>';
      ed.commands.setContent(safe, { emitUpdate: false });
      emitFromHtml(safe);
    },
    [emitFromHtml],
  );

  const commitJsonDraft = useCallback(
    (raw: string, ed: NonNullable<ReturnType<typeof useEditor>>): boolean => {
      try {
        const blocks = JSON.parse(raw);
        if (!Array.isArray(blocks)) return false;
        const serialized = serializeArticleContent(blocks);
        const html = contentValueToHtml(serialized);
        ed.commands.setContent(html, { emitUpdate: false });
        if (formatRef.current === 'html') {
          lastEmitted.current = html === '<p></p>' ? '' : html;
          skipNextSync.current = true;
          onChange(lastEmitted.current);
        } else {
          lastEmitted.current = serialized;
          skipNextSync.current = true;
          onChange(serialized);
        }
        return true;
      } catch {
        return false;
      }
    },
    [onChange],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled && mode === 'visual',
    extensions: [
      StarterKit.configure({
        heading: false,
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      Heading.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            id: {
              default: null,
              parseHTML: (element) => element.getAttribute('id'),
              renderHTML: (attributes) =>
                attributes.id ? { id: attributes.id as string } : {},
            },
          };
        },
      }).configure({ levels: [2, 3] }),
      Placeholder.configure({
        placeholder: format === 'html' ? 'Viết nội dung lịch trình ngày…' : 'Viết nội dung bài viết…',
      }),
      ArticleImage,
      RelatedLinks,
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: clsx('ui-rte__prose', compact && 'ui-rte__prose--compact'),
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (modeRef.current !== 'visual') return;
      emitFromHtml(ed.getHTML());
    },
  });

  // External value (locale / load) → editor
  useEffect(() => {
    if (!editor) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const html = contentValueToHtml(value);
    editor.commands.setContent(html, { emitUpdate: false });
    if (mode === 'html') setHtmlDraft(html);
    if (mode === 'json') {
      setJsonDraft(JSON.stringify(parseArticleContent(value), null, 2));
    }
  }, [value, editor, mode]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && mode === 'visual');
  }, [editor, disabled, mode]);

  // Debounce: HTML/JSON draft → form value + TipTap (ẩn)
  useEffect(() => {
    if (!editor || (mode !== 'html' && mode !== 'json')) return;

    const timer = window.setTimeout(() => {
      if (mode === 'html') {
        commitHtmlDraft(htmlDraft, editor);
        return;
      }
      commitJsonDraft(jsonDraft, editor);
    }, SOURCE_SYNC_MS);

    return () => window.clearTimeout(timer);
  }, [htmlDraft, jsonDraft, mode, editor, commitHtmlDraft, commitJsonDraft]);

  const switchMode = (next: Mode) => {
    if (!editor || next === mode) return;

    // Rời visual → nạp draft nguồn từ TipTap
    if (mode === 'visual') {
      const html = editor.getHTML();
      if (next === 'html') setHtmlDraft(html);
      if (next === 'json') {
        setJsonDraft(JSON.stringify(parseArticleContent(htmlToContentValue(html)), null, 2));
      }
    }

    // Rời HTML → flush ngay (kể cả sang Trực quan)
    if (mode === 'html') {
      commitHtmlDraft(htmlDraft, editor);
      if (next === 'json') {
        setJsonDraft(
          JSON.stringify(parseArticleContent(htmlToContentValue(htmlDraft || '<p></p>')), null, 2),
        );
      }
    }

    // Rời JSON → flush; JSON lỗi thì chặn đổi tab
    if (mode === 'json') {
      const ok = commitJsonDraft(jsonDraft, editor);
      if (!ok) {
        window.alert('JSON blocks không hợp lệ — sửa rồi thử lại.');
        return;
      }
      if (next === 'html') {
        setHtmlDraft(contentValueToHtml(lastEmitted.current));
      }
    }

    setMode(next);
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL liên kết', prev || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const insertImage = () => {
    if (!editor) return;
    const src = window.prompt('URL ảnh (để trống nếu chỉ có chú thích / placeholder)', '') || '';
    const caption = window.prompt('Chú thích ảnh', '') || '';
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'articleImage',
        attrs: { src: src.trim() || null, caption: caption.trim() },
      })
      .run();
  };

  const insertRelatedLinks = () => {
    if (!editor) return;
    const title = window.prompt('Tiêu đề khối liên kết', 'Xem thêm:') || 'Xem thêm:';
    const raw = window.prompt(
      'Nhãn liên kết (mỗi dòng một nhãn). Route giữ nguyên khi sửa nhãn; chỉnh route ở tab JSON.',
      'Tour gợi ý\nCẩm nang liên quan',
    );
    if (raw === null) return;
    const links: ArticleRouteLink[] = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, route: ['#', {}] }));
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'relatedLinks',
        attrs: { title, linksJson: JSON.stringify(links) },
      })
      .run();
  };

  const ensureHeadingId = (level: 2 | 3) => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level }).run();
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name === 'heading') {
      const text = node.textContent;
      const id = slugifyHeading(text);
      editor.commands.updateAttributes('heading', { id });
    }
  };

  return (
    <Field label={label} hint={hint} aiFilled={aiFilled}>
      <div
        className={clsx(
          'ui-rte',
          compact && 'ui-rte--compact',
          disabled && 'is-disabled',
          aiFilled && 'ui-rte--ai-filled',
        )}
        onFocusCapture={() => {
          if (aiFieldKey) clearAiFilled(aiFieldKey);
        }}
      >
        <div className="ui-rte__modes" role="tablist" aria-label="Chế độ soạn thảo">
          {availableModes.map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={clsx('ui-rte__mode', mode === key && 'is-active')}
              onClick={() => switchMode(key)}
              disabled={disabled}
            >
              {text}
            </button>
          ))}
        </div>

        {mode === 'visual' ? (
          <>
            <div className="ui-rte__toolbar" role="toolbar" aria-label="Định dạng">
              <ToolbarBtn
                title="Hoàn tác"
                disabled={!editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 />
              </ToolbarBtn>
              <ToolbarBtn
                title="Làm lại"
                disabled={!editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 />
              </ToolbarBtn>
              <span className="ui-rte__sep" />
              <ToolbarBtn
                title="Đoạn văn"
                active={editor?.isActive('paragraph')}
                onClick={() => editor?.chain().focus().setParagraph().run()}
              >
                <Type />
              </ToolbarBtn>
              <ToolbarBtn
                title="Tiêu đề H2"
                active={editor?.isActive('heading', { level: 2 })}
                onClick={() => ensureHeadingId(2)}
              >
                <Heading2 />
              </ToolbarBtn>
              <ToolbarBtn
                title="Tiêu đề H3"
                active={editor?.isActive('heading', { level: 3 })}
                onClick={() => ensureHeadingId(3)}
              >
                <Heading3 />
              </ToolbarBtn>
              <span className="ui-rte__sep" />
              <ToolbarBtn
                title="Đậm"
                active={editor?.isActive('bold')}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold />
              </ToolbarBtn>
              <ToolbarBtn
                title="Nghiêng"
                active={editor?.isActive('italic')}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic />
              </ToolbarBtn>
              <ToolbarBtn
                title="Gạch dưới"
                active={editor?.isActive('underline')}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <UnderlineIcon />
              </ToolbarBtn>
              <span className="ui-rte__sep" />
              <ToolbarBtn
                title="Danh sách"
                active={editor?.isActive('bulletList')}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List />
              </ToolbarBtn>
              <ToolbarBtn
                title="Danh sách số"
                active={editor?.isActive('orderedList')}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered />
              </ToolbarBtn>
              <span className="ui-rte__sep" />
              <ToolbarBtn title="Chèn / sửa liên kết" active={editor?.isActive('link')} onClick={setLink}>
                <Link2 />
              </ToolbarBtn>
              <ToolbarBtn
                title="Gỡ liên kết"
                disabled={!editor?.isActive('link')}
                onClick={() => editor?.chain().focus().unsetLink().run()}
              >
                <Unlink />
              </ToolbarBtn>
              <ToolbarBtn title="Chèn ảnh / chú thích" onClick={insertImage}>
                <ImageIcon />
              </ToolbarBtn>
              <ToolbarBtn title="Chèn khối liên kết nội bộ" onClick={insertRelatedLinks}>
                <LinkIcon />
              </ToolbarBtn>
              <ToolbarBtn title="Xem HTML" onClick={() => switchMode('html')}>
                <Code2 />
              </ToolbarBtn>
            </div>
            <EditorContent
              editor={editor}
              className={clsx('ui-rte__surface', compact && 'ui-rte__surface--compact')}
            />
          </>
        ) : null}

        {mode === 'html' ? (
          <div className="ui-rte__source">
            <CodeSourceEditor
              language="html"
              value={htmlDraft}
              disabled={disabled}
              aria-label="HTML nội dung"
              onChange={setHtmlDraft}
            />
          </div>
        ) : null}

        {mode === 'json' ? (
          <div className="ui-rte__source">
            <CodeSourceEditor
              language="json"
              value={jsonDraft}
              disabled={disabled}
              aria-label="JSON blocks"
              onChange={setJsonDraft}
            />
          </div>
        ) : null}
      </div>
    </Field>
  );
}
