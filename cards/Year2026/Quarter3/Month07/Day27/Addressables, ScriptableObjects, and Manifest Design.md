---
title: Addressables, ScriptableObjects, and Manifest Design
tags: [unity, addressables, scriptable-objects, manifests, webgl, caching, aws]
excerpt: How character selection led me from Unity ScriptableObjects and Addressables to signed manifests and versioned WebGL caching.
---
The first place I encountered manifest design was not while building this website. It was while working on character selection and downloadable content for a Unity game.

The project was a fighting game with a roster of characters. At first, the problem looked like an ordinary Unity data problem. I needed a database that could describe the characters available to the game and give the rest of the project a stable way to find them.

The solution began with ScriptableObjects.

A ScriptableObject gave each character a durable asset-backed record. The database could reference the roster in the editor, while gameplay systems could resolve a character's data without scattering configuration across scenes and MonoBehaviours.

That worked well for authored game data. It did not answer a different question:

How should a WebGL client obtain the exact character content it needs, cache it, and know whether that content belongs to the same edition as the other player?

## ScriptableObjects for authored data

The local character database is an editor-facing source of truth for the roster. `CharacterDatabase.asset` stores references to the character data assets, and `GameSessionManager` exposes that database to the gameplay systems.

This made character selection straightforward inside the Unity project. A selector could work with a character key and the database could resolve the corresponding data. The asset references also remained visible and editable in the Unity editor.

That is the role ScriptableObjects played in this system: they organized authored data and editor configuration.

They were not the right artifact for distributing every character bundle to every WebGL client.

## Addressables separate identity from delivery

Unity Addressables introduced a useful separation. A character could have a stable key while its built asset bundle lived outside the initial application download.

The game layer uses `AddressableManager` to load assets by key and retain resolved `AsyncOperationHandle` instances for the lifetime of the scene. Releasing a handle removes the in-memory reference, but it does not represent the same thing as deleting the downloaded bundle bytes from the browser cache.

That distinction became important on WebGL.

```csharp {walkthrough}
// @step lookup : Resolve a character by its stable Addressable key | Avoid loading the full roster into memory
if (loadedHandles.TryGetValue(label, out var existingHandle))
{
    if (existingHandle.IsValid())
        return existingHandle.Result as T;
}

// @step load : Resolve the asset through Addressables | Unity loads the bundle when needed
AsyncOperationHandle<T> loadHandle = Addressables.LoadAssetAsync<T>(label);
await loadHandle.Task;

// @step retain : Keep the resolved handle for this scene | Release it when the scene-local manager is destroyed
loadedHandles[label] = loadHandle;
return loadHandle.Result;
```

The resolved asset handle is an in-memory Unity concern. The bundle bytes are a delivery and caching concern. On WebGL, those bytes can be reused by the browser, a service worker, or Unity's cache layer even after a scene-local handle is released.

The SDK therefore warms dependencies separately from the game layer's asset lookup:

```csharp {walkthrough}
// @step select : Read the character keys from the match payload | Only download content the match needs
string[] keys = payload.GetCharacterKeys();

// @step warm : Download dependencies without resolving gameplay assets | Prepare bundles before connection
await AddressablePayloadLoader.LoadAssetsAsync(keys, cancellationToken);

// @step play : Let the game layer resolve assets by key | Addressables reuses the warmed bundle bytes
CharacterData character = await addressableManager.LoadAddressable<CharacterData>(key);
```

This division kept the SDK from owning game-specific character objects. The SDK prepared the content. The game resolved and used it.

## The character-select problem

Character selection added a second system boundary. The browser and PAM knew which players selected which characters, but the Unity client still needed a reliable mapping from those selections to downloadable bundles.

The WebBridge payload carries a `contentVersion` and an ordered set of player selections. `GetCharacterKeys()` flattens those selections into distinct character keys before the client warms dependencies.

The same payload reaches each peer. That matters because a networked match should not let one client load a different character edition from the other client.

PAM resolves the live content edition from `content_latest.json`. It briefly caches that pointer, then pins the resolved version on the match. A content update can therefore go live without a PAM redeploy while an individual match continues using one known edition.

The server-side flow became:

```text
publish Addressables bundles to S3
        ↓
write manifest_N.json and manifest_N.sig
        ↓
update content_latest.json
        ↓
PAM resolves and pins contentVersion at match creation
        ↓
WebBridge sends contentVersion and character selections
        ↓
each WebGL client verifies and warms the same content edition
```

## Why a manifest was necessary

An Addressables key tells the client what to request. It does not, by itself, describe the complete content edition that a match should use.

The manifest became the decoupling artifact between publishing, PAM, caching, and Unity. Each manifest describes one content version and contains entries keyed by character:

```json
{
  "manifestSchema": 1,
  "contentVersion": 7,
  "minClientVersion": "1.4",
  "entries": {
    "Crabbus": {
      "bundleUrl": "https://.../crabbus-a91f.bundle",
      "contentHash": "sha256:...",
      "addedInContentVersion": 7,
      "minClientVersion": "1.4",
      "status": "active"
    }
  }
}
```

The version is not only a cache-busting number. It identifies a complete content edition. The bundle URL and content hash identify the exact bytes for an entry. The client version fields describe which clients may consume that edition or entry.

This solved a problem that a mutable “latest characters” list could not solve. A client joining a match receives the version selected for that match, not whichever content happens to be newest when the request finishes.

## Cache correctness and integrity

The manifest also gave the cache a safe identity.

The browser-side cache service fetches `manifest_<N>.json` and its signature from the S3 content prefix. It resolves bundle URLs for the selected characters and sends the service worker both the selected URLs and the manifest's reachable URLs.

That lets the client prewarm the content needed for the current selection while retaining a known set of URLs that belong to the edition.

The SDK verifies the manifest signature over the raw JSON bytes before parsing the document. It then validates the schema and checks the minimum client version. These are separate checks because authentic bytes can still have an unsupported shape, and a valid edition can still require a newer client.

This is not an anti-cheat boundary. A WebGL client can be modified. It is a delivery-integrity and cache-correctness boundary that prevents the normal client path from silently accepting the wrong or tampered content edition.

The manifest lifecycle is explicit:

1. Build the Addressables bundles.
2. Compute their content hashes.
3. Write a versioned manifest.
4. Sign the exact manifest bytes.
5. Publish the manifest, signature, and bundles to S3.
6. Move the `content_latest.json` pointer.
7. Let PAM pin the version for new matches.

Older entries remain representable as `deprecated` or `removed` instead of disappearing without explanation. That supports clients and matches that still refer to an older edition.

## What I learned from the split

The most useful distinction was between four different artifacts:

- ScriptableObjects describe authored game data.
- Addressable keys identify loadable content.
- Manifests describe a versioned content edition.
- Cache layers store the bytes needed by a client.

Treating those as one system made the early design harder to reason about. Separating them made each responsibility clearer.

The character database could stay convenient for Unity authoring. Addressables could keep the initial WebGL payload small. The manifest could make a content edition explicit. PAM could pin that edition at match creation. The service worker and Unity cache could reuse downloaded bytes without requiring the game to keep every asset handle alive.

That was my first practical encounter with manifest design as a relationship between systems rather than a generated list of files.

Later, when I built this website, I recognized the same shape. The notes repository generates a manifest so the portfolio can resolve metadata, dependencies, and selective invalidation without scanning every document on every request.

The implementation details are different, but the design lesson carried over:

When content is published independently from the client that consumes it, a manifest becomes the contract between the two.

It records not only what exists, but which version exists, which clients can use it, and how the system should find the exact bytes.
