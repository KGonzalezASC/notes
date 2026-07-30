---
title: How this website is made
tags: [architecture, obsidian, publishing]
excerpt: How an Obsidian-to-Git publishing workflow became a server-rendered developer notebook.
---
The goal for this section of the site was to build a blog I could truly call my own. When working with teams or interviewing, I often find myself spending a lot of time frontloading context about my projects and thought process. I realized I needed to package my work better, not only to showcase what I've built, but to make it easier for others to understand how I think and collaborate.

As someone who has become increasingly familiar with Markdown-based artifacts inside modern IDEs and had been toying with the idea of finally trying Obsidian, it felt like a natural fit. I wanted something that supported the way I already work while also encouraging new ways of organizing ideas and documenting projects.

For that workflow to be worthwhile, writing in Obsidian needed to be as frictionless as possible. Truth be told, I'm still experimenting with themes and plugins to get it exactly where I want it. The fundamentals, however, were already there. The remaining piece was building a publishing workflow that was just as simple, without introducing a separate content management process.

Existing platforms could have published the content, but I wanted something that fit the workflow I was building around Obsidian. More importantly, I wanted the flexibility to support custom embeds, and a reading experience that wasn't constrained by the assumptions of an existing platform.

Building the system myself also gave me a reason to understand the entire publishing pipeline. Instead of relying on a blogging platform to abstract away fetching, caching, rendering, and cache invalidation, I wanted to know exactly what happened at each stage.

My background is primarily in game development, so this isn't necessarily the kind of system people expect me to build. It's nothing groundbreaking, but I've always been fascinated by the overlap in problem solving between game and web development and try to keep tabs with both domains whenever I can. Building this pipeline was an opportunity to apply that mindset, learn a different stack from the ground up, and better understand the infrastructure behind the tools I use.

 _My workflow begins in Obsidian. Notes are written as Markdown and pushed to a dedicated Git repository. The challenge was turning those raw documents into presentation-ready pages without making every visitor's browser do the expensive work._

```text {walkthrough}
# @step obsidian : Author in Obsidian | Write Markdown notes and Excalidraw embeds locally
source: Obsidian vault
format: Markdown (.md); diagrams referenced as ![[name.excalidraw]]

# @step publish : Push to Notes Repo | GitHub Action updates the manifest and pings the portfolio
destination: github.com/KGonzalezASC/notes
on_push_main:
  - diff: collect added/changed/deleted .md paths
  - manifest: run scripts/generate-manifest.js → notes-manifest.json v2 (+ excalidrawIndex)
  - commit: auto-commit manifest back to the notes repo
  - webhook: POST /api/revalidate on the portfolio (changed paths + manifest)

# @step render : Revalidate on Vercel (ISR) | Server regenerates affected pages; clients receive the result
trigger: POST /api/revalidate → revalidatePath (1h TTL as backup)
on_next_request:
  - fetch: notes-manifest.json + raw .md from raw.githubusercontent.com
  - compile: remark/rehype in a React Server Component
  - highlight: Shiki tokenizes code fences before HTML is sent
  - ship: static HTML + small client islands (code cards, Excalidraw, headings); no client-side Markdown work
```

## Publishing from Obsidian

The walkthrough above shows final version, where two repositories with separate responsibilities coordinate the end result clients see. A push to the notes repository does not deploy the portfolio. Instead, GitHub Actions detects the changed Markdown files, regenerates `notes-manifest.json`, commits the generated manifest back to the notes repository, and notifies the portfolio through its revalidation endpoint.

That workflow wasn't my first attempt.

Initially, I experimented with Vercel KV because it seemed like a reasonable place to cache parsed notes and metadata; its an easy data structure to grasp and apply. As my goals for the client experience evolved, however, it became clear that I hadn't fully thought through what I actually needed from the backend.

The problem wasn't Redis or Vercel KV. Redis sets, hashes, and reverse indexes could have modeled the relationships just fine. The real issue was my data model. I had designed the system around individual notes as isolated key-value entries instead of thinking about how those notes related to one another.

That assumption stopped working once notes began embedding separate Excalidraw documents.

In Obsidian, an Excalidraw drawing is stored as its own `.excalidraw.md` file and referenced by one or more parent notes. Once those relationships mattered, I needed to know not only what content had changed, I needed to answer a different question: not just _what changed_, but _which pages depend on what changed_.

>[!TIP]
>A data model should reflect the relationships you need to query, not just the easiest way to store the current data.

A managed key-value service could still have handled the problem, but it would have introduced a persistent external service, lifecycle management, and a cache invalidation layer for content that was already permanently versioned in Git. Given that this isn't a high-traffic application, maintaining that extra infrastructure simply wasn't justified. As I shifted my focus to other projects, I occasionally found myself dealing with stale cached data, reinforcing that the added complexity wasn't buying me enough to warrant further upkeep.

I realized I did not need a live database for mostly static documents. I needed a generated manifest.

The publishing workflow now uses GitHub Actions to run `scripts/generate-manifest.js` whenever content changes. The manifest stores normalized note metadata, tags, slugs, and precomputed dependency information.

One of those structures is a reverse Excalidraw index. Instead of only recording which diagrams a note contains, the index records which notes depend on each diagram.

That makes updates selective. When I push a normal note change, the workflow sends the changed paths to the site's revalidation endpoint. When I update an Excalidraw file, the webhook checks the reverse index, finds only the parent notes that reference that drawing, and invalidates those pages.

A diagram can therefore be updated without rebuilding the entire site or invalidating unrelated notes. The next request causes Vercel's Incremental Static Regeneration runtime to regenerate the invalidated page on the server. The browser receives the resulting HTML and React Server Component payload; it does not parse the Markdown or run the syntax highlighter.

In practice, the full path from pushing an Obsidian change to seeing it reflected on the live site takes roughly three to five seconds. The GitHub Action regenerates the manifest, calls the revalidation webhook, and the affected page updates without requiring a full portfolio deployment.

The manifest was also a 'two birds-one-stone' solution to handle search features. Metadata and dependency relationships are precomputed, so the application does not need to scan every document at runtime to resolve links or embedded assets.

## Turning Markdown into an interface

The first version focused on function rather than delivery performance. I found that the Markdown pipeline could parse a document into an Abstract Syntax Tree, or AST. That gave me a structured representation of the document instead of one undifferentiated string.

The AST became the boundary where I could decide how each part of a note should behave. A heading could receive custom navigation behavior, a table could receive a responsive layout, and a code fence could become an interactive explanation. This let me shape the reading experience for different kinds of content and different screen sizes.

Tables were the first concrete example. The default table output did not handle wide tables or smaller screens the way I wanted. In `MarkdownRenderer.tsx`, I mapped table nodes to the components in `TableComponents.tsx`. Those components add horizontal scrolling, derive mobile labels from the header row, and let readers pin a column while comparing values.

Once the AST pipeline was working, I used it to preserve Obsidian's syntax rather than flattening it into a generic blog format.

Obsidian uses double brackets for internal links and embedded content. The custom `remarkWikiLinks` transformation converts a standard `[[Note]]` link into a route to another note, while preserving display labels and heading links.

The Excalidraw transformation handles the related `![[diagram.excalidraw]]` form separately. It replaces the embed with a dedicated renderer that receives the corresponding drawing data.

Code fences use the same extension point. `remarkCodeAnnotations` reads the annotation mode and directive comments, then encodes the parsed model for the custom `CodeCard` components.

These cards support multiple presentation modes, including interactive walkthroughs, scrubber-based diffs, heatmaps, memory-layout views, and inline probe annotations.   (You also saw one above earlier!)

## Moving work off the client

The first implementation proved that the approach worked. It also revealed that the browser was doing far more work than it needed to.

Every time someone opened a note, the browser downloaded the Markdown parser and ran the entire parsing pipeline before transforming, highlighting, and finally rendering the document. Which, if I'm being honest, is a horrible first impression to say oh wait let it load to my site...

The initial production build shipped approximately **376 KB** of gzipped client-side JavaScript on note routes, including both `react-markdown` and `react-syntax-highlighter`.

I moved that entire pipeline into server-side rendering.

That reduced the note-route client bundle from approximately **376 KB** to **40 KB** gzipped, an **89% reduction**.

The browser no longer downloads a Markdown parser or syntax highlighter. Instead, it receives pre-rendered HTML and hydrates only the components that actually require interactivity, such as animated headings, Excalidraw embeds, and custom CodeCards.

The result is a significantly smaller client bundle while preserving the interactive reading experience.

## Preserving interactive features

After the refactor, syntax tokenization happens on the server. The interactive client component only receives compact token data and the information needed for its selected annotation mode.

Moving the existing AST pipeline from the client to the server required more than moving libraries between files.

For example, the sanitization stage initially removed the custom metadata used to identify annotated code blocks. The attributes had also been converted from kebab-case HTML names into camelCase React properties after the raw HTML transformation.

I updated the sanitization schema and component mapping so the metadata survived the full AST pipeline.

Those fixes were important because performance work is not successful if it silently removes functionality or changes the meaning of the interface.

I added tests around token-key generation, scrubber diff behavior, and code-pane rendering to lock down the contract between server-generated data and client-side interaction.

## Designing for different screens

Lastly, the manifest also powers an interactive graph of the notebook using `@xyflow/react`. Notes are displayed as connected nodes, allowing visitors to explore how different topics relate to one another instead of navigating them one page at a time.

That interface works well on desktop, where a mouse and larger viewport make exploring the graph feel natural. On mobile, however, I quickly found the same interaction created a worse experience. The graph competes with the page itself for both screen space and touch gestures. Someone trying to scroll can easily end up panning the canvas instead, and the smaller viewport makes the relationships between notes much harder to follow.

Rather than forcing the same interface onto every screen size, I intentionally limited the graph to desktop layouts.

Mobile visitors receive a searchable, touch-friendly timeline instead. Desktop visitors can use both the structured list and the spatial graph.

The difference is not simply responsive styling. Each version is designed around the input method and available screen space.

---
## Final architecture

The final architecture is a Git-based publishing pipeline:

```text
Obsidian
    ↓
Git push
    ↓
GitHub Actions
    ↓
notes-manifest.json
    ↓
Revalidation webhook
    ↓
Incremental Static Regeneration
    ↓
Pre-rendered page and small client islands
```


The result is my own living developer notebook that documents the architecture, experiments, and decisions behind my projects. Visitors can see not only what I built, but how the systems changed as I encountered new constraints, corrected earlier assumptions, and refined the design.

---

<!-- letter-outro -->


_Ciao,_

**KG**
<!-- /letter-outro -->
