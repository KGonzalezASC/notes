# Obsidian image publishing

## Status

Vercel Blob and the GitHub publishing Action are configured. A successful notes push uploads referenced images and refreshes the affected website articles.

The original twist-socket PNG lives in `assets/twist-socket.png`. The VR article now embeds that image and retains its Google Drive source link.

## Authoring

In Obsidian, set **Settings → Files and links → Default location for new attachments → In the folder specified below** to `assets`.

This vault is configured to save attachments in `assets` and new notes directly in `cards`. Banyan also uses `cards`, without creating date folders. The website uses the note's `date: YYYY-MM-DD` property, so set it when authoring a new article. Existing publication dates and URLs are preserved.

Write your article in Obsidian, paste images, then commit and push the note and its attachments. The GitHub Action generates the manifests and publishes the media automatically. Pull before your next batch of commits, because the Action commits generated metadata back to the repository.

Paste or drop an image into a note, then keep the reference local:

```md
![Diagram caption](assets/twist-socket.png "Optional caption")
![[twist-socket.png]]
![[assets/twist-socket.png|400]]
![[assets/twist-socket.png|400x800]]
```

Markdown references resolve beside the note first, then from the vault root. Explicit Obsidian paths resolve from the vault root first.

Bare Obsidian filenames must match exactly one attachment in the publishable vault. Duplicate names fail publication and require explicit paths.

Size suffixes set the maximum display width, not the image's original dimensions. Images remain fluid on narrow screens.

Files under `cards/` are public unless frontmatter sets `draft: true`. Excalidraw source notes are not articles.

Only referenced images are uploaded. Hidden directories, editor configuration, symlinks, scripts, scratch data and `banyan_config` are excluded.

Supported formats: PNG, JPEG, WebP, GIF, SVG, AVIF and BMP. Image bytes must match their file extension and have readable dimensions.

Fenced code and inline code do not publish their example references. Remote image URLs are never downloaded or uploaded automatically.

## Local commands

Run from the notes repository:

```bash
bun install --frozen-lockfile
bun run media:plan
bun run media:github
bun scripts/generate-manifest.js
```

`media:plan` prints uploads, shared assets, reusable URLs and affected articles. It never writes metadata or external state.

`media:github` explicitly writes source-only metadata without Blob credentials. It supports the portfolio's development-only local attachment route.

For Blob publishing:

```bash
bun run media:publish
```

That command requires `BLOB_READ_WRITE_TOKEN` and `NOTES_BLOB_HOST` in the process environment. Never place either credential value in Markdown or client code.

The GitHub Action refreshes the media manifest after changing references or replacing images. Refresh it locally only when testing changes before a push. A deployment never serves the development attachment route.

## Media manifest v1

`notes-media-manifest.json` is separate from the unchanged notes manifest v2 contract.

- `assets`: canonical vault path → SHA-256 hash, revision, MIME type, bytes, intrinsic dimensions, optional Blob URL and independent raw GitHub URL.
- `notes`: article slug → authored reference key → canonical asset path.
- `noteHashes`: article slug → source-note SHA-256 hash.
- `assetParents`: canonical asset path → parent article slugs.

Reference keys start with `markdown:` or `obsidian:`. Publisher and renderer use identical copies of the AST transform in `scripts/obsidian-images.mjs` and portfolio `plugins/obsidian-images.mjs`.

There are no timestamps or random keys. Unchanged runs preserve metadata and existing uploads.

Dirty local attachments have `sourceRevision: null`. CI pins their fallback to the source commit once the attachments are committed.

The publisher does not delete old Blob objects. Content-addressed keys preserve older published pages.

## Blob setup

1. Open the portfolio project in Vercel.
2. Choose **Storage → Create Storage → Blob → Public**.
3. Record the exact store hostname, such as `your-store.public.blob.vercel-storage.com`.
4. In the notes GitHub repository, open **Settings → Environments → env**.
5. Add secret `BLOB_READ_WRITE_TOKEN` using the token for that store. Never paste it into chat.
6. Add variable `NOTES_BLOB_HOST` with the exact hostname, without a scheme or path.
7. Add variable `NOTES_MEDIA_MODE` with value `blob`.
8. Add `NOTES_BLOB_HOST` to the portfolio's Vercel server environment and redeploy the consumer once.
9. Preserve existing `REVALIDATE_SECRET_TOKEN` and `PORTFOLIO_WEBHOOK_URL` secrets.

For a deliberate GitHub-only rollout, set `NOTES_MEDIA_MODE=github-only`. An unset mode fails rather than silently changing the storage plan.

The token stays exclusively in the publishing process. The portfolio needs only the non-secret store hostname.

## Rollout ordering

1. Review and authorize commits for both repositories. Existing unrelated changes require their own ownership review.
2. Deploy the portfolio consumer before pushing a notes publication that depends on it.
3. Commit the original attachment, authored reference, scripts, lockfile, workflow and generated manifests in notes.
4. Push notes only after external configuration is ready.
5. Observe the successful publishing Action and its real Blob response.
6. Verify the production VR article and full-resolution link.
7. Replace only an image's bytes, push, and confirm its parents refresh with a new content-addressed URL.
8. Run an unchanged publication and confirm no new upload occurs.

The Action captures the source diff before metadata commits. It uploads and verifies image bytes before writing URLs.

Both generated manifests commit together. Only then does the webhook expire both metadata cache tags and invalidate affected routes.

Concurrency serializes publishers. A newer source revision causes failure rather than rebasing stale generated JSON.

A rejected run must be rerun against the latest revision. Article source hashes recover changes from superseded Markdown runs.

The webhook checks main metadata against the published commit before invalidating routes. GitHub propagation failures receive bounded retries.

## Failure behavior

A missing or ambiguous attachment stops publication before generated metadata or the webhook changes. Restore the attachment or remove its reference.

A failed upload leaves the previous manifest untouched. A retry checks the exact content-addressed key and verifies its bytes before reusing it.

The browser tries the primary image, then one independent original. It never alternates sources indefinitely or mounts a Drive iframe as fallback.

Intrinsic dimensions reserve space during loading and failure. Full-resolution viewing remains available. Ordinary older Markdown images still resolve directly to GitHub.

An unavailable whole website cannot be rescued by image fallback. No quota or cold-cache speedup claim is made.

## Validation recorded locally

- Publisher dry-run on the real PNG.
- Unicode and encoded filenames, Obsidian sizes, note-relative parent paths, ignored code and drafts.
- Duplicate basename failure, shared-byte deduplication, same-name replacement and affected-parent detection.
- Missing attachment failure without manifest changes and unchanged source-only publication.
- Portfolio TypeScript, scoped ESLint, existing media tests and production build.
- Server HTML contains article text, image markup and original dimensions before hydration.
- Browser image loading and geometry at 390, 768 and 1440 pixels without page-wide horizontal overflow.
- Browser primary failure, original fallback, both-source failure, bounded requests and preserved canvas dimensions.

Screenshot capture failed because the Preview webview produced no frames. Visual text-legibility review remains necessary.

Actual Blob upload, authenticated webhook freshness, image-only Actions execution and production rendering require secure configuration and authorized rollout.

## Primary references

- [Vercel public Blob storage](https://vercel.com/docs/vercel-blob/public-storage)
- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
