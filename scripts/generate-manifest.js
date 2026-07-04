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
 * Extract Excalidraw references like ![[diagram.excalidraw]]
 */
function extractExcalidrawRefs(content) {
  const references = [];
  const regex = /!\[\[([\s\S]+?\.excalidraw)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    references.push(match[1]);
  }
  return references;
}

/**
 * Parse frontmatter yaml-like properties without external dependency
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
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Parse array format: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = value
        .slice(1, -1)
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
    } else {
      // Clean quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse boolean or string
      if (value === 'true') {
        metadata[key] = true;
      } else if (value === 'false') {
        metadata[key] = false;
      } else {
        metadata[key] = value;
      }
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
    const date = metadata.date || new Date().toISOString().split('T')[0];
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

  // Sort manifest by date descending (newest first)
  manifest.sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Successfully generated manifest with ${manifest.length} notes at ${MANIFEST_PATH}`);
}

main();
