---
title: Addressables, ScriptableObjects, and Manifest Design
tags: [unity, addressables, scriptable-objects, manifests, webgl, caching, aws]
excerpt: How character selection led me from Unity ScriptableObjects and Addressables to signed manifests, match-pinned editions, and durable WebGL caching.
---

During my time at Skillcade, one of my deliverables was designing a character data pipeline for my game.

Skillcade operated as a single-page application. Players moved through a series of routes, starting with game selection, continuing to player count, and ending at the game itself. My fighting game added a character-selection step where each player chose a fighter before the match began.

We separated that step partly to conserve server capacity. There was no reason to allocate an Edgegap server while both players were still choosing characters. This reduced the server bandwidth consumed by matches that were cancelled early.

At first, I thought I was designing a character database.

During early development, that was mostly true. I tested with only two characters at a time and replaced one whenever I needed to validate a new addition. The game needed a database that described the available characters and gave the rest of the project a stable way to find them. ScriptableObjects handled that part well.

The rest of the pipeline did not stay that simple.

Skillcade was a real-money gaming platform, so we wanted to harden the delivery path and make it more difficult for clients to inspect or modify content. One part of that approach was preventing the initial WebGL build from containing the entire character roster.

There were also practical deployment concerns. WebGL builds took time to produce, and publishing one meant redeploying the game through PAM (Skillcade's platform backend for the SPA, matchmaking, and game deploys). Because of that release cycle, adding or updating a character should not require rebuilding the entire client or redeploying the match server.

Returning players should not repeatedly download content they already had. Most importantly, both peers in a deterministic match had to simulate the exact same character data.

What began as a character database became a contract between publishing, matchmaking, caching, and the game client. Each new requirement introduced a responsibility that ScriptableObjects alone were never meant to own.

That separation eventually became the architecture.

## ScriptableObjects and authored data

The first responsibility was authoring.

Each character needed a durable, editor-friendly record containing its gameplay data and references. A `CharacterDatabase` ScriptableObject stored the roster, and `GameSessionManager` exposed that database to the rest of the project.

Gameplay systems could work with a stable character key and resolve the associated data without scattering configuration across scenes or individual MonoBehaviours. The roster also remained visible and editable inside the Unity editor, which made ScriptableObjects a natural source of truth for authored game data.

On paper, careful use of those primitives meant a new character should not strictly increase binary size. In practice we still shipped every character inside the initial WebGL build, so the download remained larger than it needed to be.

The authoring model did not need to become the delivery model.

## Addressables and asset delivery

Unity Addressables introduced the next separation.

A character could retain a stable identity while its built asset bundle lived outside the initial player download. The game could request a character by key and let Addressables resolve where its content lived.

The game layer used an `AddressableManager` to load assets and retain their `AsyncOperationHandle` instances for the lifetime of the scene:

```csharp {walkthrough}
// @step lookup : Reuse an asset already resolved during this scene | Avoid loading the same character twice
if (loadedHandles.TryGetValue(label, out var existingHandle))
{
    if (existingHandle.IsValid())
        return existingHandle.Result as T;
}

// @step load : Resolve the asset through its stable Addressable key | Download its bundle when necessary
AsyncOperationHandle<T> loadHandle = Addressables.LoadAssetAsync<T>(label);
await loadHandle.Task;

// @step retain : Keep the resolved asset alive for this scene | Release the handle with the scene-local manager
loadedHandles[label] = loadHandle;
return loadHandle.Result;
```

That solved asset lookup and on-demand delivery, but it exposed another distinction.

An Addressables handle represents an in-memory Unity reference. Releasing that handle does not necessarily mean the browser must delete the downloaded bundle bytes. Those bytes may still exist in Unity's cache, the browser cache, or a service-worker-managed cache.

The resolved object and its downloaded bytes belonged to different lifecycles.

That led to a boundary between the SDK and the game layer. The SDK prepared the required content without owning game-specific objects. Once the bytes were available, the game could resolve and use the actual character assets.

```csharp {walkthrough}
// @step select : Read the character keys selected for this match | Ignore content the players do not need
string[] keys = payload.GetCharacterKeys();

// @step warm : Download the required dependencies before connection | Do not resolve gameplay objects yet
await AddressablePayloadLoader.LoadAssetsAsync(keys, cancellationToken);

// @step play : Resolve the character through the game layer | Addressables can reuse the warmed bytes
CharacterData character =
    await addressableManager.LoadAddressable<CharacterData>(key);
```

## Deterministic multiplayer

Knowing where an asset lived did not tell two clients which edition of that asset they were expected to load.

In a typical application, loading the newest available content may be acceptable. In a live-service fighting game, it can break the match.

Both peers must simulate the same moves, frame data, collision values, and character configuration. If one client loads a recently updated character while the other uses an older cached edition, the simulations can diverge even though both players selected the same character key. From an authoring perspective, suppose one character was problematic and had to be reverted: the same problem in reverse. If everyone used only the newest version, supporting content reversions would require authoring redundant data and a confusing internal tracking system.

The difficult part of character selection was therefore not identifying that both players had selected `Crabbus`.

It was guaranteeing that `Crabbus` represented the exact same bytes on both machines.

The browser and the platform's PAM service already knew which characters the players had selected. The Unity client needed those selections to arrive alongside an explicit content edition.

The WebBridge payload therefore carries a `contentVersion` with the ordered player selections. `GetCharacterKeys()` reduces those selections into the distinct Addressable keys required by the match.

Each peer receives the same match payload.

At match creation, PAM resolves the live content edition from `content_latest.json`, briefly caches that pointer, and pins the resulting version to the match. A new edition can become live without changing matches that already exist.

The system became:

```text
publish Addressables bundles to Amazon S3 (AWS)
        ↓
write manifest_N.json and manifest_N.sig
        ↓
update content_latest.json
        ↓
PAM resolves and pins contentVersion at match creation
        ↓
WebBridge sends contentVersion and character selections
        ↓
each WebGL client verifies and warms the same edition
```

The latest version is useful at match creation.

Once the match exists, “latest” is no longer a safe identity.

## Engine versions and content versions are different contracts

The architecture became easier to reason about once we stopped treating every update as the same kind of release.

Some changes affect the networked simulation itself. Combat code, serialization, netcode behavior, and protocol changes legitimately require a new client build and a compatible server deployment.

A roster or balance update should not necessarily carry that same cost.

Adding a character should be a content publish, not automatically an engine release.

That required two independent versions:

| Version                  | What it describes                                         | Bumped when                       | Cost of change                      |
| ------------------------ | --------------------------------------------------------- | --------------------------------- | ----------------------------------- |
| Client or engine version | Combat code, netcode, serialization, and runtime behavior | Networked simulation changes      | Client build and server redeploy    |
| Content version          | The available characters and their exact published bytes  | Roster or balance content changes | Bundle publish and manifest signing |

Each character entry also contains its own content hash. That hash identifies the exact bundle bytes within a content edition and serves as both a cache identity and an integrity check.

This split became the spine of the system.

Without it, every roster update looked like an engine release. With it, the code and content could evolve on separate schedules while still declaring their compatibility.

## The manifest and content editions

An Addressable key identifies something the client can load.

It does not describe the complete edition a match should trust.

That became the manifest's responsibility.

The manifest sits between content publishing, PAM, caching, and Unity. It lives on S3 rather than being compiled into PAM or the game client. Each versioned document describes one immutable content edition and contains entries keyed by character:

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

The client build embeds an Ed25519 public key.

When joining a match, it downloads `manifest_<N>.json` and `manifest_<N>.sig`, verifies the signature over the exact raw JSON bytes, validates the document against the supported schema, and then trusts the hashes and bundle locations declared inside it.

Those checks cover separate concerns.

The signature establishes that the manifest came from the expected publisher and was not modified in transit.

Schema validation establishes that the client understands the document it received.

Version checks establish whether the client is compatible with that content edition.

A correctly signed manifest may still use a schema an older client cannot interpret. A structurally valid manifest may still require a newer engine version. Authenticity, shape, and compatibility are related, but they are not interchangeable.

The manifest gave the match an immutable content edition:

> Both clients use the same exact content edition.

That could not be expressed safely through a mutable list of the newest characters.

## Roster presentation

The signed content manifest defines:

> The exact character bytes this match may load.

The lobby needs separate presentation data:

- What name should appear on the character tile?
- Which image should be shown?
- Where should the character appear in the roster?
- Is the character currently selectable?

Originally, that presentation data lived in PAM's `games.json` and the client application's public assets. This meant that publishing a new character could still require a PAM redeploy even after its gameplay bundles were independently available.

The later design moved lobby data into an unsigned, versioned `roster_<N>.json` document with a `roster_latest.json` pointer. Character art moved to content-addressed objects on S3.

The signed manifest remained the integrity gate for match content.

The roster became the presentation contract.

That separation allowed the lobby to change without rewriting the meaning of an existing match. A tile image or sort order could change independently. A character could stop appearing as selectable while remaining resolvable for matches pinned to an earlier content version.

Both documents describe characters, but each serves a different consumer and carries different trust requirements.

Combining them would have made both harder to evolve.

## Removal became another versioning problem

Once matches could be pinned to older editions, deleting a character could no longer mean erasing every record of it.

A match created against an older edition might still reference that character. A returning client might already have its bundle cached. A replay or validation process might also need to resolve it later.

Manifest entries therefore remain representable and use an explicit lifecycle status:

- `active`
- `deprecated`
- `removed`

A removed character may no longer be offered to new players, but older editions can still describe it.

The roster follows the same principle. Presentation can mark a character as non-selectable without erasing the content identity required by a previously pinned match.

“Removed from the current roster” and “never existed” are not the same state.

Soft deletion preserves that distinction.

## Cache correctness

Content-addressing made cache invalidation mostly automatic.

A bundle's URL or cache key is derived from its content hash. When the character bytes remain unchanged, their identity remains unchanged and the cached object is still valid. When the bytes change, the hash changes and the new bundle becomes a guaranteed cache miss.

The cache does not need to reason about characters, balance patches, or match versions. It only needs to check whether the bytes identified by a hash already exist locally.

The browser-side cache service fetches the match-pinned manifest and its signature from the S3 content prefix. It resolves the bundle URLs for the selected characters and sends the service worker both the selected URLs and the set of objects reachable from the manifest.

That allows the host page to begin warming the current match's content while Unity boots. Rematches can reuse durable browser-cached bytes rather than depending on scene-local Addressables handles remaining alive.

Unity still performs its own enforcement step.

After verifying the signed manifest, the client can compare the downloaded bundle bytes against the `contentHash` declared for that character before allowing the asset into the match. A mismatch aborts the connection path instead of silently loading unexpected data.

This is not an anti-cheat boundary because a WebGL or IL2CPP client can be modified or hooked. The check protects delivery integrity and cache correctness along the normal client path. Authoritative match verification still belongs to the deterministic simulation and server-side tape validation.

The complete publish lifecycle became explicit:

1. Build the Addressables bundles using content-hashed names.
2. Compute the bundle hashes.
3. Write a versioned content manifest.
4. Sign the exact manifest bytes with Ed25519.
5. Publish the bundles, manifest, and signature to S3.
6. Move the `content_latest.json` pointer.
7. Let PAM pin that version when creating new matches.

Each step produces or updates an artifact with a clearly bounded responsibility.

## The reusable lesson

Looking back, the most useful part of the design was not any individual Unity feature.

It was realizing that every layer needed a distinct responsibility.

| Artifact          | Responsibility                                      |
| ----------------- | --------------------------------------------------- |
| ScriptableObjects | Store authored game data                            |
| Addressable keys  | Identify and resolve loadable assets                |
| Content manifest  | Define the exact edition a match may load           |
| Roster document   | Describe how available content appears in the lobby |
| Cache             | Reuse exact bytes already present locally           |
| Match payload     | Carry the agreed edition and character selections   |

None of these systems replaced the others.

Each exists because the previous abstraction intentionally stops short of solving the next problem.

Trying to make one artifact own all of those responsibilities would have produced a larger and more tightly coupled system.

The design improved as those responsibilities separated.

This was my first practical encounter with manifest design as more than a generated list of files. The manifest became a contract between a system that published content and several systems that consumed it for different reasons.

Later, while building the publishing pipeline for this website, I recognized the same shape.

The technologies were different, but the problem was familiar. One system authored and published content. Another rendered it. The rest of the application needed metadata, dependency relationships, cache identities, and selective invalidation. A generated manifest became the boundary that allowed those systems to coordinate without requiring each one to rediscover the entire content set.

That is the broader lesson I carried forward:

When one system publishes content independently from the client that consumes it, the two need an explicit contract.

A useful manifest records more than what exists. It establishes which edition is active, where its exact bytes can be found, which consumers can use it, and which assumptions remain stable after newer content is published.

I thought I was building a character database.

What I ended up building was the agreement that allowed several independent systems to talk about the same content without all becoming the same system.

---

<!-- letter-outro -->
There's more to build.

_Ciao,_

**KG**
<!-- /letter-outro -->
