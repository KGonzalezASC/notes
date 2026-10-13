---
date: 2026-07-27
title: How this website is made
tags: [architecture, tooling]
tagAliases: [obsidian, publishing]
category: deep-dives
excerpt: How an Obsidian-to-Git publishing workflow became a server-rendered developer notebook.
---
The goal for this site was to build a blog I could truly call my own. When working with teams or interviewing, I often find myself spending a lot of time frontloading context about my projects and thought process. I realized I needed to package my work better, not only to showcase what I've built, but to make it easier for others to understand how I think and collaborate. 

I have tried various notetaking and annotation tools over the years, from Evernote, OneNote to Google Drive and Notion, but none of them worked. As a kid, my folders always ripped at the pockets because I shoved papers (mostly my drawings) into the same spot. Thankfully, that habit does not affect how I code, but it still affects how I take notes. At the end of a course, job, or chunk of work, organizing information to use later was more effort than it was worth.

I also have always been critical of how to comment code; heavy inline comments in shared repositories are effectively visual litter. They have poor shelf-life, lack visual aids and I find often have as much "jargon" as the code itself. If I needed a verbose, breakdown for myself, I usually kept an annotated duplicate in a git-ignored scratch file. Prior to AI, I was big fan of the visual studio class diagram feature, as my mermaid skills aren't exactly as fast as I think. 

I am still on the fence about Obsidian, but I like how much control it gives me over how I want to organize and present my work. Markdown is a reliable format, and I like that AI tools can leverage my notes to help me get things done without locking me into one app's way of doing things. I'm less convinced by some of Obsidian's solutions for collaboration, and I'm still figuring out how I feel about the mobile experience.

In a way, I’m hoping that working in Obsidian gives me that same kick other people get from tinkering with their Linux setups, dotfiles, and Emacs. I've never been particularly good at learning that side of things or had the motivation to stick with it myself, so I'm comparing it more to how I imagine that experience feels. I can still relate to the appeal of having that much control over your tools. I want to explore creative writing a lot more in my life, first as a coder documenting my projects and thought process, and eventually as an author. I'm not sure yet how much Obsidian will become part of that, but I like having the freedom to figure it out myself.

Since a good chunk of my notes will now be publicly available, I have more incentive to keep them structured and useful, even when they are primarily for my own reference. The notes I do keep private can influence what I eventually write publicly, so keeping them organized makes it easier to develop those thoughts into content later.

For this approach to be worthwhile, I wanted a publishing workflow flexible enough to support the evolving ways I planned to use Obsidian. I wasn't particularly drawn to Obsidian's built-in publishing option, as it had some of the same limitations around customization, and its UI/UX didn't really fit the portfolio I was trying to build. I wanted to build my own content management workflow, with more control over how my posts were presented, support for custom embeds, and a direct path from my notes to the published site.

Building the system myself also gave me a reason to understand the entire publishing pipeline. Instead of relying on a blogging platform to abstract away fetching, caching, rendering, and cache invalidation, I wanted to know exactly what happened at each stage.

My background is primarily in game development, so this isn't necessarily the kind of system people expect me to build. It's nothing groundbreaking per se, but I've always been fascinated by the overlap in problem solving between game and web development and try to keep tabs with both domains whenever I can. Building this pipeline was an opportunity to apply that mindset and better understand the infrastructure behind the tools I use.

I needed to connect two events: changing a note and a visitor seeing that change on the site. Here’s the path between them:

```text
Obsidian vault
    ↓ write Markdown
Notes Git repository
    ↓ push triggers workflow
GitHub Actions
    ↓ update the manifest and request revalidation
Vercel
    ↓ regenerate the affected page on the next request
Visitor's browser
```

## Publishing from Obsidian

The final workflow uses two repositories to keep publishing notes separate from deploying the portfolio. A push to the notes repository doesn’t deploy the portfolio. Instead, GitHub Actions detects the changed Markdown files, regenerates `notes-manifest.json`, commits the updated manifest to the notes repository, and calls the portfolio’s revalidation endpoint with the changed paths.

That workflow wasn’t my first attempt.

I initially tried Vercel KV as a place to cache parsed notes and metadata. Its data structure was easy to understand, and it seemed like a reasonable place to start. But as I thought more about how I wanted the site to work for readers, I realized I hadn’t figured out what I needed the backend to handle.

Vercel KV wasn’t the problem. Redis sets, hashes, and reverse indexes could have represented the relationships between notes just fine. The problem was how I had modeled the content. In Obsidian, each drawing lives in its own `.excalidraw.md` file, and a note can reference one or more drawings. Because my data model didn’t record those links, a drawing change didn’t reliably refresh the notes that embedded it. When I triggered an update, I had to regenerate both pages that referenced the drawing.

*I’d missed an important relationship: which pages depended on each drawing.*

A managed key-value service could still have handled the problem, but it would have introduced a persistent external service, lifecycle management, and a cache invalidation layer for content already versioned in Git. Since this isn’t a high-traffic application, I couldn’t justify that extra infrastructure. 

At the time, I left the problem there, but later encountered a similar stale-cache issue at work. Solving it there was the lightbulb moment. It helped me put two and two together and realize the site didn’t need a live database for mostly static documents; it needed a generated manifest.

The publishing workflow now uses GitHub Actions to run `scripts/generate-manifest.js` whenever content changes. That manifest stores normalized note metadata, tags, slugs, and precomputed dependency information.

One of those structures is a reverse Excalidraw index. Instead of only recording which diagrams a note contains, the index records which notes depend on each diagram.

That makes updates selective. When I push a normal note change, the workflow sends the changed paths to the site’s revalidation endpoint. When an image changes, the media manifest identifies the notes that use it, and the webhook invalidates those pages. This updates the affected pages without rebuilding the site or deploying the portfolio.

On the next request, Vercel regenerates the invalidated page on the server using Incremental Static Regeneration. The browser receives the rendered HTML and React Server Component payload; it doesn’t parse the Markdown or run the syntax highlighter.

In my usual checks, the full path from pushing a note change to seeing it on the live site takes roughly three to five seconds. GitHub Actions rebuilds and commits the manifests, then calls the portfolio’s revalidation webhook. The webhook invalidates the affected page, and Vercel regenerates it on the next request. If GitHub’s raw manifests haven’t caught up with the published commit, the webhook returns a retriable response and the workflow waits 20 seconds before trying again [up to 16 attempts].

The manifest was also a 'two birds-one-stone' solution to handle search features. Metadata and dependency relationships are precomputed, so the application does not need to scan every document at runtime to resolve links or embedded assets.

## Turning Markdown into an interface

The first version focused on function rather than delivery performance. I found that the Markdown pipeline could parse a document into an Abstract Syntax Tree (AST). That gave me a structured representation of the document instead of one undifferentiated string.

The AST became the boundary where I could decide how each part of a note should behave. A heading could receive custom navigation behavior, a table could receive a responsive layout, and a code fence could become an interactive explanation. This let me shape the reading experience for different kinds of content and different screen sizes.

Once the AST pipeline was working, I used it to preserve Obsidian's syntax rather than flattening it into a generic blog format.

Obsidian uses double brackets for internal links and embedded content. The custom `remarkWikiLinks` transformation converts a standard `[[Note]]` link into a route to another note, while preserving display labels and heading links.

Code fences use the same extension point. `remarkCodeAnnotations` reads the annotation mode and directive comments, then encodes the parsed model for the custom `CodeCard` components.

These cards support multiple presentation modes, including interactive walkthroughs, scrubber-based diffs, heatmaps, memory-layout views, and inline probe annotations. 
## Moving work off the client

The first version worked, but it asked the browser to do more than it needed to.
Whenever someone opened a note, the browser downloaded `react-markdown` and 
`react-syntax-highlighter`, then parsed, transformed, highlighted, and rendered the Markdown. If I’m honest, making someone wait for a note to load was a terrible first impression.

The first production build sent about **376 KB** of gzipped JavaScript to note routes, including both packages.

I moved the Markdown pipeline to the server and left only the interactive parts in the browser. That cut the note-route client bundle from about **376 KB** to **40 KB** gzipped, an **89% reduction**.

The browser no longer downloads a Markdown parser or syntax highlighter. Instead, it receives pre-rendered HTML and hydrates only the components that actually require interactivity, such as animated headings, Excalidraw embeds, and custom CodeCards.

The result is a significantly smaller client bundle while preserving the interactive reading experience.

## Preserving interactive features

After the refactor, syntax tokenization happens on the server. The interactive client component only receives compact token data and the information needed for its selected annotation mode.

Moving the Markdown pipeline to the server was only useful if the annotated code blocks still worked. During the refactor, I found that their annotation data wasn’t making it through the pipeline: the raw HTML step changed the custom attribute to camelCase, then the sanitizer removed it because it wasn’t on its allow list. The code still appeared, but the renderer had lost the information it needed to show the right interactive card.

I updated the sanitizer to keep the camelCase attribute and the renderer to read it. That let me move the parsing off the browser without losing the code block interactions.

I added tests around token-key generation, scrubber diff behavior, and code-pane rendering to lock down the contract between server-generated data and client-side interaction.

## Building the library

Getting the notes published was only part of the work. I didn't want the homepage to be a dumping ground of everything I intend to write so I made a route for people to find more if they happing to like my babbling.

An earlier version combined a timeline with an interactive graph; I added the graph because I thought it looked cool, but the tags and article titles were difficult to untangle once they became connected nodes. The result was a confusing diagram that felt clunky, didn’t look how I wanted, and wasn’t something I used myself. It also left desktop and mobile visitors with two very different browsing experiences.

I removed the graph and timeline and reworked the page around a featured article and a searchable list. I organized the notes into clearer category buckets [deep dives, experiments, tradeoffs], while keeping tags as topic metadata to help people find relevant notes through search.

The formatting needed attention, too. I wouldn't call myself the best UI designer, but it's easy to recognize when certain colors and fonts make your eyes gloss over. It took some experimenting to find the right typography, spacing, and handling of wider content to make those pages more comfortable to read.

The new library layout also left me with extra space, and it felt a little too simple. With the category buckets in place, I wanted each one to have a distinct visual identity. Small animated scenes gave me a way to keep the page visually consistent while making those categories recognizable [at least, that’s the idea].

Adding those scenes brought me back to the loading problem I'd already worked through with the notes. As much as I like Three.js, I hate waiting for things to load. I'm trying to get people interested in my work, and I worry that making them wait will lose their interest or leave them with a worse impression of what I'm showing. I wanted the animations to feel like part of the page as someone browsed it, so I had to think about what they would see before the interactive scene was ready.

The approach I settled on was to record the same animation and use that as a preview. The page starts with a still image, then plays the video while the live scene loads in the background. Once the scene has drawn its first frame, I match it to the video's current point in the animation and crossfade between them. Matching the timing was important: I wanted the animation to carry on as the scene became interactive, rather than visibly restart when it finished loading.

If the live scene can't load, the video can keep playing. Someone still gets to see the animation, and the interactive version becomes an extra part of the experience when it's available.

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


