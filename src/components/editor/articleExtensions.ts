import { Node, mergeAttributes } from '@tiptap/react';
import { decodePayload, encodePayload, type ArticleRouteLink } from '@/lib/articleContent';

export type RelatedLinksAttrs = {
  title: string;
  linksJson: string;
};

export const ArticleImage = Node.create({
  name: 'articleImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null as string | null },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-vt-block="image"]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return {
            caption:
              node.getAttribute('data-caption') ||
              node.querySelector('figcaption')?.textContent ||
              '',
            src: node.querySelector('img')?.getAttribute('src') || null,
          };
        },
      },
      {
        tag: 'figure',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          if (node.getAttribute('data-vt-block') === 'links') return false;
          return {
            caption: node.querySelector('figcaption')?.textContent || '',
            src: node.querySelector('img')?.getAttribute('src') || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes.caption || '');
    const src = HTMLAttributes.src as string | null;
    const children: unknown[] = [];

    if (src) {
      children.push(['img', { src, alt: caption }]);
    } else {
      children.push(['div', { class: 'vt-image-ph', 'data-caption': caption }]);
    }
    children.push(['figcaption', {}, caption]);

    return [
      'figure',
      mergeAttributes({
        'data-vt-block': 'image',
        'data-caption': caption,
      }),
      ...children,
    ];
  },
});

export const RelatedLinks = Node.create({
  name: 'relatedLinks',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: 'Xem thêm:' },
      linksJson: { default: '[]' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'aside[data-vt-block="links"]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const payload = decodePayload<{ title?: string; links?: ArticleRouteLink[] }>(
            node.getAttribute('data-vt-payload'),
            { title: 'Xem thêm:', links: [] },
          );
          const fromDom = Array.from(node.querySelectorAll('li')).map((li) => ({
            label: (li.textContent || '').trim(),
            route: decodePayload(li.getAttribute('data-vt-route'), ['#', {}]),
          }));
          const links = payload.links?.length
            ? payload.links.map((link, i) => ({
                label: fromDom[i]?.label || link.label,
                route: link.route,
              }))
            : fromDom;
          return {
            title:
              payload.title ||
              node.querySelector('.vt-links-title')?.textContent?.trim() ||
              'Xem thêm:',
            linksJson: JSON.stringify(links),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = String(HTMLAttributes.title || 'Xem thêm:');
    let links: ArticleRouteLink[] = [];
    try {
      links = JSON.parse(String(HTMLAttributes.linksJson || '[]')) as ArticleRouteLink[];
    } catch {
      links = [];
    }
    const payload = encodePayload({ title, links });
    const items = links.map((link) => [
      'li',
      { 'data-vt-route': encodePayload(link.route) },
      link.label,
    ]);

    return [
      'aside',
      mergeAttributes({
        'data-vt-block': 'links',
        'data-vt-payload': payload,
        class: 'vt-related-links',
      }),
      ['p', { class: 'vt-links-title' }, title],
      ['ul', {}, ...items],
    ];
  },
});
