import { visit } from 'unist-util-visit';

export const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i;

export function decodeReference(value) {
  try { return decodeURIComponent(value).normalize('NFC'); }
  catch { throw new Error(`Invalid encoded attachment reference: ${value}`); }
}

export function imageReferenceKey(node) {
  return `${node.data?.hProperties?.dataObsidianImage ? 'obsidian' : 'markdown'}:${decodeReference(node.url)}`;
}

export default function remarkObsidianImages() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number' || parent.type === 'link') return;
      const matches = [...node.value.matchAll(/!\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g)];
      const children = [];
      let cursor = 0;
      for (const match of matches) {
        const url = match[1].trim();
        if (!IMAGE_EXTENSION.test(decodeReference(url))) continue;
        if (match.index > cursor) children.push({ type: 'text', value: node.value.slice(cursor, match.index) });
        const suffix = match[2]?.trim();
        const size = suffix?.match(/^(\d+)(?:x(\d+))?$/);
        const width = size ? Number(size[1]) : undefined;
        const height = size?.[2] ? Number(size[2]) : undefined;
        children.push({
          type: 'image', url,
          alt: (size ? undefined : suffix) || decodeReference(url).split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          data: { hProperties: { dataObsidianImage: true, ...(width > 0 ? { width } : {}), ...(height > 0 ? { height } : {}) } },
        });
        cursor = match.index + match[0].length;
      }
      if (!children.length) return;
      if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) });
      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
}
