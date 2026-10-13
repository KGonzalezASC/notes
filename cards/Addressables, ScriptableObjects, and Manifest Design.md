---
date: 2026-07-27
title: Addressables, ScriptableObjects, and Manifest Design
tags: [architecture, unity, multiplayer]
tagAliases: [addressables]
category: experiments
excerpt: How character selection led me from Unity ScriptableObjects and Addressables to signed manifests, match-pinned editions, and durable WebGL caching.
---

At Skillcade, I designed a character data pipeline for my game.

The site was a single-page application backed by PAM, which handled matchmaking and game deployments across the platform. Players first selected a game, then chose the number of players before entering it. My fighting game added a character selection page on the site, where each player chose a fighter before the game itself loaded.

Keeping character selection on the site also helped conserve server capacity. There was no reason to allocate a server through Edgegap, our game server hosting provider, while players were still choosing characters. If they cancelled at that point, we hadn’t used server resources for a match that never started.

On the platform side, PAM’s `games.json` listed the characters available for selection and their images, along with the paths to the game’s WebGL build files. Those build files were hosted in an S3 bucket, Amazon’s file storage service.

As I started thinking about how to publish and update the characters, there was more to account for than the setup I used during development.

Skillcade was a real-money gaming platform, so we wanted greater control over client-side content delivery and stronger protections against unauthorized modification that could affect a match. Part of that approach was keeping the entire character roster out of the initial WebGL build.

Delivering character content separately also gave us a way to avoid rebuilding the game for every character change. WebGL builds took time to produce, and publishing one meant redeploying the game through PAM. Since PAM served every game on the platform, updating it could affect all titles, not just mine. I wanted to be able to add or update a character without rebuilding the entire client or redeploying the match server.

I also didn’t want returning players to download the same character content every time they played. Keeping a local copy made sense, but after a character update, one player might still have the old version while their opponent had the new one. Since the game used deterministic simulation, that difference could put their games out of sync. I needed both players to load the same character data before the match started.

## Loading characters with Addressables

During early development, every character was packaged into the initial WebGL build. As the roster grew, so did the amount of content players had to download before the client could start. I wanted to keep creating and editing characters in Unity while reducing that initial wait time.

Based on [Unity’s Addressables documentation](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AssetDependencies.html), Addressables could package the character assets into remote bundles and download them when needed. We could keep authoring characters as ScriptableObjects while changing how their assets were referenced, packaged, and loaded by the game.

The game loaded each character using an Addressable key, such as `Crabbus`. Addressables used that key to find the character’s asset bundle and download it if needed, so the game didn’t have to manage the bundle’s location itself.

My `AddressableManager` kept track of assets loaded during the scene. Each load returned an `AsyncOperationHandle`, which tracked the loading operation and provided access to the asset once it was ready. I stored those handles so that if the game requested the same character again, the manager could return the asset it had already loaded:

```csharp {walkthrough}
// @step lookup: Reuse a loaded asset | Return it immediately if its stored handle is still valid.
if (loadedHandles.TryGetValue(label, out var existingHandle))
{
    if (existingHandle.IsValid())
        return existingHandle.Result as T;
}

// @step load: Load the requested asset | Addressables resolves the key and downloads dependencies if needed.
AsyncOperationHandle<T> loadHandle = Addressables.LoadAssetAsync<T>(label);
await loadHandle.Task;

// @step retain: Store the handle | Keep the asset available for another request during this scene.
loadedHandles[label] = loadHandle;
return loadHandle.Result;
```
 It also made it worth being more precise about which character changes actually required a new game build.

## Updating characters without rebuilding the game

Some changes affect the networked simulation itself. Combat code, serialization, netcode behavior, and protocol changes still require a new client build and a compatible server deployment.

The leaf node system was a large part of making character behavior editable as data. I could combine conditions, such as checking whether a character was falling, with actions, such as applying an impulse or changing state. Those pieces formed behavior trees stored in the character’s ScriptableObject data, with Odin editor tooling to configure them.

As long as a new character used mechanics the client already understood, It was possible to define entire characters as only a new Addressables bundle. The client wasn’t tied to a fixed list of characters; it could load compatible data and run the behavior described by those trees.

That gave me room to create new characters by combining existing mechanics. If a character needed a new leaf node or system mechanic, I would still have to implement it in game code and update the client.

To track those two kinds of change separately here was the underlying rationale I came up with:

| Version | What it describes | Bumped when | Cost of change |
| --- | --- | --- | --- |
| Client or engine version | Combat code, netcode, serialization, and runtime behavior | Networked simulation changes | Client build and server redeploy |
| Content version | The available characters and their exact published bytes | Roster or balance content changes | Bundle publish and manifest signing |

Separating those versions gave character updates their own release process. But once content could change independently, the character key alone wasn’t enough to tell a match what to load.

## Giving each match a content edition

Two players could both select `Crabbus` and still load different versions of its moves, frame data, collision values, or other configuration. One might have the latest update while the other had an older copy cached. Both had selected the right character, but their simulations could disagree about what that character did.

Reverting a problematic character raised the same question. I needed a way to select an earlier edition without overwriting the meaning of the data used by matches that already existed. Loading whatever was newest wouldn’t give me that control.

The manifest gave us a record of each published content edition. It lived on S3 rather than being compiled into PAM or the game client, and described the character bundles belonging to that edition. A simplified example looked like this:

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

I also needed the client to check that it had received the expected manifest before trusting the contents. Publishing produced a separate Ed25519 signature file, and the client build contained the public key needed to verify it. When joining a match, the client downloaded `manifest_<N>.json` and `manifest_<N>.sig` and checked the signature against the exact raw JSON bytes.

The client also validated the document format and version compatibility. Those checks answered different questions: whether the manifest came from the expected publisher without being modified, whether the client understood its structure, and whether it could use the content. A correctly signed document could still require a newer client or use a format an older client didn’t understand.

When PAM created a match, it checked `content_latest.json` to find the current content version and saved that version with the match. It briefly cached the lookup so it didn’t need to request the file from S3 for every new match. I wanted an update to become available without changing the character data underneath people who were already playing.

PAM and the browser already had the players’ character selections, so I included the content version with those selections in the WebBridge payload sent to Unity. Both players received the same match information. The client then used `GetCharacterKeys()` to work out which characters it needed to load, using the manifest for the version assigned to that match.

## Reusing downloaded content

Once the match had an explicit edition, I could decide whether the content a player already had was still useful. Each bundle’s URL or cache key was based on its content hash. If the bytes hadn’t changed, the same cached object could be reused. If they had changed, the new hash identified a different object, so an old cached copy wouldn’t be mistaken for the update.

That meant the cache could work with exact bytes. It didn’t have to understand why a character had changed or which balance patch introduced the change. It needed to know whether the object identified by the requested hash was already available locally.

There was another detail here that I had to keep separate from the loading code. An Addressables handle represents an asset loaded into Unity’s memory. Releasing that handle doesn’t necessarily remove the downloaded bundle from Unity’s cache, the browser cache, or a service worker’s cache. A service worker is a browser script that can handle requests and keep downloaded files available for later use.

I wanted downloaded content to remain useful after the scene that loaded it had ended. That shaped the division between the SDK and the game layer: the SDK prepared the content required by the match, then the game resolved the actual character assets when it needed them.

```csharp {walkthrough}
// @step select : Read the character keys selected for this match | Ignore content the players do not need
string[] keys = payload.GetCharacterKeys();

// @step warm : Download the required dependencies before connection | Do not resolve gameplay objects yet
await AddressablePayloadLoader.LoadAssetsAsync(keys, cancellationToken);

// @step play : Resolve the character through the game layer | Addressables can reuse the warmed bytes
CharacterData character =
    await addressableManager.LoadAddressable<CharacterData>(key);
```

The browser-side cache service fetched the match’s manifest and signature from S3, resolved the selected characters’ bundle URLs, and passed the service worker both those URLs and the set of objects reachable from the manifest. The host page could start downloading the match’s content while Unity booted. Rematches could then reuse the downloaded bytes without relying on the previous scene’s Addressables handles staying alive.

Unity still performed its own check. After verifying the signed manifest, the client could compare the downloaded bundle bytes against the character’s declared `contentHash` before allowing the asset into the match. If the hash didn’t match, the connection path stopped rather than loading unexpected data.

That protected delivery integrity and cache correctness along the normal client path. It wasn’t a complete anti-cheat boundary: a WebGL or IL2CPP client could still be modified or hooked. Authoritative match verification belonged to the deterministic simulation and server-side tape validation.

## Updating the lobby roster

Getting character content out of the game build didn’t completely remove the need for a PAM deployment. The lobby still got its character names and selection images from `games.json` and the client application’s public assets. A new character’s gameplay bundle could be available independently while its selection tile still required a platform update.

The lobby also needed information that didn’t belong to the exact gameplay data chosen for a match. It needed the display name, tile image, sort order, and whether the character was currently selectable. I wanted to be able to change those details without changing the data an existing match would load.

The later design moved that presentation data into an unsigned, versioned `roster_<N>.json` document with a `roster_latest.json` pointer. Character art moved to content-addressed objects on S3. The signed content manifest continued to define the exact bytes used by a match, while the roster document described what the lobby showed.

Both documents described characters, but they had different jobs and trust requirements. Keeping them separate meant an image or sort order could change independently of gameplay content. It also let the lobby stop offering a character while that character remained available to matches using an earlier edition.

### Removing a character

That last case needed some care. Once matches could use older editions, removing a character couldn’t mean erasing every record of it. An existing match might still reference it, a returning player might have its bundle cached, and a replay or validation process might need to resolve it later.

Manifest entries used explicit lifecycle states: `active`, `deprecated`, and `removed`. A character could leave the current roster while older editions still described it. The roster could also mark it as non-selectable without deleting the content identity needed by a previously created match.

This was another reason to keep each published edition intact. I could change what was available to new players while preserving the information needed to understand a match created before that change.

## From a character update to a match

By this point, a character update had a publishing process separate from releasing the game:

1. Build the Addressables bundles using content-hashed names.
2. Compute the bundle hashes.
3. Write a versioned content manifest.
4. Sign the exact manifest bytes with Ed25519.
5. Publish the bundles, manifest, and signature to S3.
6. Move the `content_latest.json` pointer.
7. Let PAM pin that version when creating new matches.

The path from publishing to playing looked like this:

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

Each part of the pipeline now had enough information to do its job without having to own the entire character system:

| Artifact | Responsibility |
| --- | --- |
| ScriptableObjects | Store authored character data and behavior |
| Addressable keys | Identify and resolve loadable assets |
| Content manifest | Describe the exact content edition and its compatibility requirements |
| Roster document | Describe how available content appears in the lobby |
| Cache | Reuse exact bytes already present locally |
| Match payload | Carry the agreed edition and character selections |

## What I carried into other projects

This was my first practical encounter with manifest design as more than a generated list of files. I had started with a small character setup inside Unity, but publishing those characters separately meant I needed to describe them in a way the platform, browser, and game could all use.

The manifest became that shared record. It identified an edition, where its bytes could be found, and which clients could use it. ScriptableObjects remained useful for authoring, Addressables handled asset loading, and the lobby had its own presentation data. I could keep improving those parts without asking one of them to handle everything else.

Later, while building the publishing pipeline for this website, I recognized a similar problem. One system authored and published content, another rendered it, and the application needed metadata, dependency relationships, cache identities, and a way to refresh only the affected pages.

The technologies were different, but I could use the same idea: generate the information the consuming systems needed when publishing the content. That gave them a shared description to work from without requiring each one to rediscover how all the content fit together.
