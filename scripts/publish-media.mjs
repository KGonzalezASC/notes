import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import { imageSize } from 'image-size';
import remarkObsidianImages, { IMAGE_EXTENSION, decodeReference, imageReferenceKey } from './obsidian-images.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
for (const arg of args) if (!['--dry-run', '--github-only'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
const dryRun = args.has('--dry-run');
const githubOnly = args.has('--github-only');
const manifestPath = path.join(root, 'notes-media-manifest.json');
const previous = await fs.readFile(manifestPath, 'utf8').then(JSON.parse).catch((error) => {
  if (error.code === 'ENOENT') return { version: 1, assets: {}, notes: {}, assetParents: {} };
  throw error;
});
if (previous.version !== 1 || !previous.assets || !previous.notes || !previous.assetParents) throw new Error('Invalid previous media manifest');
const git = (...arguments_) => execFileSync('git', arguments_, { cwd: root, encoding: 'utf8' }).trim();
const revision = process.env.SOURCE_REVISION || git('rev-parse', 'HEAD');
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('SOURCE_REVISION must be a full Git commit SHA');
const repository = process.env.GITHUB_REPOSITORY || git('remote', 'get-url', 'origin').replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Expected a GitHub owner/repository');
const blobHost = process.env.NOTES_BLOB_HOST || '';
if (blobHost && !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(blobHost)) throw new Error('NOTES_BLOB_HOST must be the exact public store hostname');
if (!dryRun && !githubOnly && (!process.env.BLOB_READ_WRITE_TOKEN || !blobHost)) throw new Error('Blob publishing needs BLOB_READ_WRITE_TOKEN and NOTES_BLOB_HOST. Use --github-only explicitly for source-only publishing.');

const excluded = (segment) => segment.startsWith('.') || ['node_modules', 'banyan_config', 'scratch', 'scripts', 'docs'].includes(segment);
const files = [];
async function scan(directory) {
  for (const entry of (await fs.readdir(path.join(root, directory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (excluded(entry.name)) continue;
    const relative = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await scan(relative);
    else if (entry.isFile()) files.push(relative);
  }
}
await scan('');
const images = files.filter((file) => IMAGE_EXTENSION.test(file));
const imageSet = new Set(images);
function canonical(value) {
  const decoded = decodeReference(value).replace(/\\/g, '/');
  if (decoded.includes('\0') || /[?#]/.test(decoded) || /^[a-z][\w+.-]*:/i.test(decoded) || decoded.startsWith('//')) throw new Error(`Unsafe attachment path: ${value}`);
  const normalized = path.posix.normalize(decoded.replace(/^\//, ''));
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').some(excluded)) throw new Error(`Attachment outside publishable vault: ${value}`);
  return normalized;
}
function resolveAttachment(notePath, reference, obsidian) {
  const decoded = decodeReference(reference).replace(/\\/g, '/');
  // Bare Obsidian names are global: never select the first duplicate basename.
  if (obsidian && !decoded.includes('/')) {
    const matches = images.filter((file) => path.posix.basename(file) === decoded);
    if (matches.length !== 1) throw new Error(`${matches.length ? 'Ambiguous' : 'Missing'} attachment ${reference} in ${notePath}${matches.length ? `: ${matches.join(', ')}` : ''}`);
    return matches[0];
  }
  const relativePath = canonical(decoded.startsWith('/') ? decoded : path.posix.join(path.posix.dirname(notePath), decoded));
  const vaultPath = decoded.split('/').includes('..') ? null : canonical(reference);
  const candidates = (obsidian ? [vaultPath, relativePath] : [relativePath, vaultPath]).filter(Boolean);
  const match = candidates.find((candidate) => imageSet.has(candidate));
  if (!match) throw new Error(`Missing attachment ${reference} in ${notePath}`);
  return match;
}
const slugFor = (file) => file.replace(/^cards\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//, '').replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const notes = {};
const noteHashes = {};
const parents = {};
const errors = [];
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkObsidianImages);
for (const notePath of files.filter((file) => file.startsWith('cards/') && file.endsWith('.md') && !file.endsWith('.excalidraw.md'))) {
  const content = await fs.readFile(path.join(root, notePath), 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const metadata = frontmatter ? parseYaml(frontmatter[1]) : {};
  if (metadata?.draft === true) continue;
  noteHashes[slugFor(notePath)] = crypto.createHash('sha256').update(content).digest('hex');
  const body = frontmatter ? content.slice(frontmatter[0].length) : content;
  const tree = await parser.run(parser.parse(body));
  const definitions = new Map();
  visit(tree, 'definition', (node) => definitions.set(node.identifier.toUpperCase(), node));
  const refs = {};
  function discover(node) {
    if (/^[a-z][\w+.-]*:|^\/\//i.test(node.url)) return; // Remote media is never uploaded.
    try {
      if (!IMAGE_EXTENSION.test(decodeReference(node.url))) return;
      const assetPath = resolveAttachment(notePath, node.url, Boolean(node.data?.hProperties?.dataObsidianImage));
      refs[imageReferenceKey(node)] = assetPath;
      (parents[assetPath] ||= new Set()).add(slugFor(notePath));
    } catch (error) { errors.push(error.message); }
  }
  visit(tree, 'image', discover);
  visit(tree, 'imageReference', (node) => {
    const definition = definitions.get(node.identifier.toUpperCase());
    if (definition) discover({ ...node, url: definition.url });
  });
  notes[slugFor(notePath)] = Object.fromEntries(Object.entries(refs).sort(([a], [b]) => a.localeCompare(b)));
}
if (errors.length) throw new Error(`Media discovery failed:\n${errors.join('\n')}`);
const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp' };
const assets = {};
const bytesByHash = new Map();
const plan = [];
for (const assetPath of Object.keys(parents).sort()) {
  const bytes = await fs.readFile(path.join(root, assetPath));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const dimensions = imageSize(bytes);
  const ext = path.extname(assetPath).slice(1).toLowerCase();
  const expectedType = { jpg: 'jpg', jpeg: 'jpg' }[ext] || ext;
  if (dimensions.type !== expectedType || !dimensions.width || !dimensions.height) throw new Error(`Invalid image bytes or dimensions: ${assetPath}`);
  const old = previous.assets[assetPath];
  const same = old?.hash === hash;
  const sourceRevision = same && old.sourceRevision ? old.sourceRevision : (git('status', '--porcelain', '--', assetPath) ? null : revision);
  const rawPath = assetPath.split('/').map(encodeURIComponent).join('/');
  const fallbackUrl = `https://raw.githubusercontent.com/${repository}/${sourceRevision || 'main'}/${rawPath}`;
  const pathname = `notes-media/${hash}/original.${expectedType === 'jpg' ? 'jpg' : ext}`;
  const reusable = Object.values(previous.assets).find((asset) => asset.hash === hash && asset.url && (!blobHost || new URL(asset.url).hostname === blobHost));
  const url = reusable?.url;
  const action = url ? 'reuse' : bytesByHash.has(hash) ? 'shared' : githubOnly ? 'github-only' : 'upload';
  plan.push({ path: assetPath, hash, action, parents: [...parents[assetPath]].sort() });
  assets[assetPath] = { path: assetPath, hash, sourceRevision, mimeType: mimeTypes[ext], width: dimensions.width, height: dimensions.height, bytes: bytes.length, ...(url ? { url } : {}), fallbackUrl };
  bytesByHash.set(hash, { bytes, pathname, mimeType: mimeTypes[ext] });
}

if (!dryRun && !githubOnly) {
  const { put, head, BlobNotFoundError } = await import('@vercel/blob');
  const uploaded = new Map();
  async function verify(url, expectedHash) {
    if (new URL(url).hostname !== blobHost) throw new Error('Blob token returned a URL outside NOTES_BLOB_HOST');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Blob delivery check failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Blob content digest mismatch');
  }
  for (const asset of Object.values(assets)) {
    if (asset.url) continue;
    if (uploaded.has(asset.hash)) { asset.url = uploaded.get(asset.hash); continue; }
    const { bytes, pathname, mimeType } = bytesByHash.get(asset.hash);
    let existing;
    try { existing = await head(pathname); }
    catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
    let result = existing;
    if (!result) {
      try { result = await put(pathname, bytes, { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: mimeType }); }
      catch (uploadError) {
        // A lost response or competing publisher can leave the deterministic key present.
        for (let attempt = 0; attempt < 3 && !result; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          try { result = await head(pathname); }
          catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
        }
        if (!result) throw uploadError;
      }
    }
    await verify(result.url, asset.hash);
    asset.url = result.url;
    uploaded.set(asset.hash, result.url);
  }
}
const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
const manifest = { version: 1, assets: sorted(assets), notes: sorted(notes), noteHashes: sorted(noteHashes), assetParents: sorted(Object.fromEntries(Object.entries(parents).map(([key, values]) => [key, [...values].sort()]))) };
const affected = new Set();
for (const assetPath of new Set([...Object.keys(previous.assets), ...Object.keys(assets)])) {
  if (JSON.stringify(previous.assets[assetPath]) !== JSON.stringify(assets[assetPath])) {
    for (const slug of [...(previous.assetParents[assetPath] || []), ...(manifest.assetParents[assetPath] || [])]) affected.add(slug);
  }
}
for (const slug of new Set([...Object.keys(previous.notes), ...Object.keys(notes)])) {
  if (JSON.stringify(previous.notes[slug]) !== JSON.stringify(notes[slug]) || previous.noteHashes?.[slug] !== noteHashes[slug]) affected.add(slug);
}
console.log(JSON.stringify({ dryRun, mode: githubOnly ? 'github-only' : 'blob', sourceRevision: revision, assets: plan, affectedSlugs: [...affected].sort() }, null, 2));
if (!dryRun) {
  const serialized = JSON.stringify(manifest, null, 2) + '\n';
  const current = await fs.readFile(manifestPath, 'utf8').catch((error) => { if (error.code === 'ENOENT') return ''; throw error; });
  if (current !== serialized) {
    await fs.writeFile(`${manifestPath}.tmp`, serialized);
    await fs.rename(`${manifestPath}.tmp`, manifestPath);
  }
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `affected_slugs=${JSON.stringify([...affected].sort())}\n`);
}
