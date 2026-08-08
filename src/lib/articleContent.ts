/** Article body = JSON array of blocks (seed / API / public Blade). */

export type ArticleRouteLink = {
  label: string;
  route: [string, Record<string, string>?] | unknown[];
};

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; id: string; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'image'; caption: string; src?: string }
  | { type: 'links'; title: string; links: ArticleRouteLink[] };

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function slugifyHeading(text: string): string {
  const base = stripTags(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return base || 'section';
}

export function parseArticleContent(raw: unknown): ArticleBlock[] {
  if (Array.isArray(raw)) {
    return raw.filter(isArticleBlock) as ArticleBlock[];
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];

  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(isArticleBlock) as ArticleBlock[];
    }
  } catch {
    /* plain HTML / text fallback */
  }

  if (trimmed.startsWith('<')) {
    return htmlToBlocks(trimmed);
  }

  return [{ type: 'p', text: trimmed }];
}

function isArticleBlock(b: unknown): boolean {
  if (!b || typeof b !== 'object') return false;
  const type = (b as { type?: string }).type;
  return (
    type === 'p' ||
    type === 'h2' ||
    type === 'h3' ||
    type === 'ul' ||
    type === 'ol' ||
    type === 'image' ||
    type === 'links'
  );
}

export function serializeArticleContent(blocks: ArticleBlock[]): string {
  return JSON.stringify(blocks);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function encodePayload(data: unknown): string {
  return encodeURIComponent(JSON.stringify(data));
}

export function decodePayload<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}

/** Inner HTML for text nodes — keep safe inline tags from TipTap. */
function inlineHtml(text: string): string {
  return text || '';
}

export function blocksToHtml(blocks: ArticleBlock[]): string {
  if (!blocks.length) return '<p></p>';

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
          return `<p>${inlineHtml(block.text)}</p>`;
        case 'h2': {
          const id = block.id || slugifyHeading(block.text);
          return `<h2 id="${escapeAttr(id)}">${inlineHtml(block.text)}</h2>`;
        }
        case 'h3': {
          const id = block.id || slugifyHeading(block.text);
          return `<h3 id="${escapeAttr(id)}">${inlineHtml(block.text)}</h3>`;
        }
        case 'ul':
          return `<ul>${(block.items || [])
            .map((item) => `<li>${inlineHtml(item)}</li>`)
            .join('')}</ul>`;
        case 'ol':
          return `<ol>${(block.items || [])
            .map((item) => `<li>${inlineHtml(item)}</li>`)
            .join('')}</ol>`;
        case 'image': {
          const caption = block.caption || '';
          const src = block.src ? ` src="${escapeAttr(block.src)}"` : '';
          const img = block.src
            ? `<img${src} alt="${escapeAttr(caption)}" />`
            : `<div class="vt-image-ph" data-caption="${escapeAttr(caption)}"></div>`;
          return `<figure data-vt-block="image" data-caption="${escapeAttr(caption)}">${img}<figcaption>${escapeAttr(caption)}</figcaption></figure>`;
        }
        case 'links': {
          const payload = encodePayload({ title: block.title, links: block.links });
          const items = (block.links || [])
            .map((link) => {
              const routePayload = encodePayload(link.route);
              return `<li data-vt-route="${routePayload}">${escapeAttr(link.label)}</li>`;
            })
            .join('');
          return `<aside data-vt-block="links" data-vt-payload="${payload}"><p class="vt-links-title">${escapeAttr(block.title || 'Xem thêm:')}</p><ul>${items}</ul></aside>`;
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('');
}

function listItemsFromEl(el: Element): string[] {
  return Array.from(el.querySelectorAll(':scope > li')).map((li) => li.innerHTML.trim());
}

export function htmlToBlocks(html: string): ArticleBlock[] {
  if (typeof document === 'undefined') {
    return [];
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim() || '<p></p>';

  const blocks: ArticleBlock[] = [];

  Array.from(wrap.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (text) blocks.push({ type: 'p', text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const vt = el.getAttribute('data-vt-block');

    if (vt === 'links' || (tag === 'aside' && el.getAttribute('data-vt-payload'))) {
      const payload = decodePayload<{ title?: string; links?: ArticleRouteLink[] }>(
        el.getAttribute('data-vt-payload'),
        { title: '', links: [] },
      );
      const title =
        payload.title ||
        el.querySelector('.vt-links-title')?.textContent?.trim() ||
        'Xem thêm:';
      const linksFromDom = Array.from(el.querySelectorAll('li')).map((li) => {
        const route = decodePayload<ArticleRouteLink['route']>(
          li.getAttribute('data-vt-route'),
          ['#', {}],
        );
        return {
          label: (li.textContent || '').trim(),
          route,
        };
      });
      blocks.push({
        type: 'links',
        title,
        links: (payload.links?.length ? payload.links : linksFromDom).map((link, i) => ({
          label: linksFromDom[i]?.label || link.label,
          route: link.route,
        })),
      });
      return;
    }

    if (vt === 'image' || tag === 'figure') {
      const caption =
        el.getAttribute('data-caption') ||
        el.querySelector('figcaption')?.textContent?.trim() ||
        '';
      const src = el.querySelector('img')?.getAttribute('src') || undefined;
      blocks.push({ type: 'image', caption, ...(src ? { src } : {}) });
      return;
    }

    if (tag === 'p') {
      const text = el.innerHTML.trim();
      if (text && text !== '<br>') blocks.push({ type: 'p', text });
      return;
    }

    if (tag === 'h2' || tag === 'h3') {
      const text = el.innerHTML.trim();
      const id = el.getAttribute('id') || slugifyHeading(text);
      blocks.push(
        tag === 'h2' ? { type: 'h2', id, text } : { type: 'h3', id, text },
      );
      return;
    }

    if (tag === 'ul') {
      blocks.push({ type: 'ul', items: listItemsFromEl(el) });
      return;
    }

    if (tag === 'ol') {
      blocks.push({ type: 'ol', items: listItemsFromEl(el) });
      return;
    }

    if (tag === 'blockquote') {
      const text = el.innerHTML.trim();
      if (text) blocks.push({ type: 'p', text });
      return;
    }

    // Unknown wrapper — flatten children
    if (el.children.length) {
      blocks.push(...htmlToBlocks(el.innerHTML));
    } else {
      const text = el.innerHTML.trim();
      if (text) blocks.push({ type: 'p', text });
    }
  });

  return blocks.length ? blocks : [];
}

export function contentValueToHtml(value: string): string {
  return blocksToHtml(parseArticleContent(value));
}

export function htmlToContentValue(html: string): string {
  return serializeArticleContent(htmlToBlocks(html));
}
