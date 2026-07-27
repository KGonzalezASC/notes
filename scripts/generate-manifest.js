const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'cards');
const MANIFEST_PATH = path.join(__dirname, '..', 'notes-manifest.json');

/**
 * Strips date-hierarchy and normalizes to kebab-case slug.
 * Matches Next.js slug logic: cards/Year2026/Quarter1/Month03/Day09/file.md -> file
 */
function pathToSlug(filePath) {
  // Normalize windows backslashes to forward slashes for regex consistency
  const normalized = filePath.replace(/\\/g, '/');
  // Strip cards/YearYYYY/QuarterQ/MonthMM/DayDD/
  const withoutHierarchy = normalized.replace(/^cards\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//, '');

  return withoutHierarchy
    .replace(/\.md$/, '')
    .replace(/\.excalidraw\.md$/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Recursively find all markdown files in a directory
 */
function getMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Remove fenced and inline code so manifest scans only real embeds.
 */
function stripCodeLiterals(content) {
  return content
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/`[^`]*`/g, '');
}

/**
 * Extract Excalidraw references like ![[diagram.excalidraw]]
 */
function extractExcalidrawRefs(content) {
  const references = [];
  const regex = /!\[\[([^\]|]+\.excalidraw)(?:\|[^\]]*)?\]\]/g;
  const searchable = stripCodeLiterals(content);
  let match;
  while ((match = regex.exec(searchable)) !== null) {
    references.push(match[1]);
  }
  return references;
}

/**
 * Strip surrounding single/double quotes from a scalar.
 */
function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a YAML inline array: [a, b, "c"]
 */
function parseInlineArray(value) {
  return value
    .slice(1, -1)
    .split(',')
    .map((t) => stripQuotes(t.trim()))
    .filter(Boolean);
}

/**
 * Derive YYYY-MM-DD from cards/YearYYYY/QuarterN/MonthMM/DayDD/...
 */
function dateFromHierarchyPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const match = normalized.match(
    /Year(\d{4})\/Quarter\d+\/Month(\d{1,2})\/Day(\d{1,2})\//
  );
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Resolve note date: frontmatter date → updated → folder hierarchy → epoch.
 * Avoid file mtime so local and CI generate identical manifests.
 */
function resolveNoteDate(metadata, relativePath) {
  const fromMeta = metadata.date || metadata.updated;
  if (typeof fromMeta === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fromMeta)) {
    return fromMeta.slice(0, 10);
  }
  return dateFromHierarchyPath(relativePath) || '1970-01-01';
}

/**
 * Parse frontmatter yaml-like properties without external dependency.
 * Supports inline arrays and Obsidian-style YAML lists.
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const rawMetadata = match[1];
  const body = match[2];
  const metadata = {};

  const lines = rawMetadata.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip indented list continuations; they are consumed with their key
    if (/^\s+- /.test(line)) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    if (!key) continue;

    let value = line.slice(colonIndex + 1).trim();

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = parseInlineArray(value);
      continue;
    }

    // Empty value: may be followed by a YAML list
    if (value === '') {
      const listItems = [];
      while (i + 1 < lines.length && /^\s+- /.test(lines[i + 1])) {
        i += 1;
        const item = stripQuotes(lines[i].replace(/^\s+- /, '').trim());
        if (item) listItems.push(item);
      }
      if (listItems.length > 0) {
        metadata[key] = listItems;
      } else {
        metadata[key] = '';
      }
      continue;
    }

    value = stripQuotes(value);

    if (value === 'true') {
      metadata[key] = true;
    } else if (value === 'false') {
      metadata[key] = false;
    } else {
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

/**
 * Extract an excerpt from the body text
 */
function extractExcerpt(body) {
  // Strip out markdown headings and lists, find the first substantive paragraph
  const lines = body.split('\n');
  let firstParagraph = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('-')) continue;
    if (trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('`')) continue;
    if (trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('>')) continue;
    if (trimmed.startsWith('![')) continue;

    firstParagraph = trimmed;
    break;
  }

  if (!firstParagraph) return '';

  // Clean raw markdown syntax slightly
  let cleanText = firstParagraph
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link syntax
    .replace(/[*_`~]/g, '');                  // formatting symbols

  if (cleanText.length > 150) {
    return cleanText.slice(0, 147) + '...';
  }
  return cleanText;
}

/**
 * Extract title from body heading if frontmatter lacks a title
 */
function extractTitleFromHeading(body, fallbackTitle) {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
    if (trimmed.startsWith('## ')) {
      return trimmed.slice(3).trim();
    }
    if (trimmed.startsWith('### ')) {
      return trimmed.slice(4).trim();
    }
  }
  return fallbackTitle;
}

/**
 * Build reverse lookup: embed ref → note slugs that reference it.
 * Computed at publish time so the portfolio webhook never scans all notes.
 */
function buildExcalidrawIndex(notes) {
  const index = Object.create(null);
  for (const entry of notes) {
    for (const ref of entry.excalidrawRefs) {
      if (!index[ref]) index[ref] = [];
      index[ref].push(entry.slug);
    }
  }
  return index;
}

function main() {
  console.log('Generating notes manifest...');
  if (!fs.existsSync(CARDS_DIR)) {
    console.error(`Error: cards directory not found at ${CARDS_DIR}`);
    process.exit(1);
  }

  const files = getMarkdownFiles(CARDS_DIR);
  const manifest = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    const slug = pathToSlug(relativePath);
    const { metadata, body } = parseFrontmatter(content);

    // Standardize metadata keys
    const titleFallback = path.basename(file, '.md');
    const title = metadata.title || extractTitleFromHeading(body, titleFallback);
    const date = resolveNoteDate(metadata, relativePath);
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const featured = metadata.featured === true;
    const excerpt = metadata.excerpt || extractExcerpt(body);
    const excalidrawRefs = extractExcalidrawRefs(body);

    manifest.push({
      slug,
      title,
      date,
      tags,
      featured,
      excerpt,
      excalidrawRefs,
      filePath: relativePath
    });
  }

  // Sort manifest by date descending (newest first), then title for stability
  manifest.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title);
  });

  const bundle = {
    version: 2,
    notes: manifest,
    excalidrawIndex: buildExcalidrawIndex(manifest),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(bundle, null, 2), 'utf8');
  const indexSize = Object.keys(bundle.excalidrawIndex).length;
  console.log(
    `Successfully generated manifest v2 with ${manifest.length} notes ` +
      `and ${indexSize} indexed diagram(s) at ${MANIFEST_PATH}`
  );
}

main();
