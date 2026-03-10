---
tags: [networking, fishnet, csharp]
---

## FishNet Networking Concepts

---

### 1. Intermediate Layers (Middleware)

Middleware provides hooks to insert custom logic **between** the raw transport layer and FishNet's serialization layer. This lets you intercept, modify, or analyze all network packets.

**Common Use Cases:**

- **Compression:** Compress outgoing data and decompress incoming data to save bandwidth.
- **Security:** Inject metadata or authentication tokens into packets.
- **Debugging & Analytics:** Log or filter packets for debugging, metrics, or replay systems.

**Data Flow:**

```
User Data (NetworkMessages)
   ↓ Serialize
[ IntermediateLayer.HandleOutgoing ]  ← intercept here
   ↓ Transport.Send
---- network ----
   ↓ Transport.Receive
[ IntermediateLayer.HandleIncoming ]  ← intercept here
   ↓ Deserialize into messages
```

---

### 2. Networked Spatial Hashing (HashGrid)

Sending updates about every object to every player is highly inefficient. A player on one side of the map doesn't need data for objects on the other side. This is the problem of **interest management**.

The `HashGrid` system solves this by dividing the world into a grid and only sending updates for objects physically near each player — a technique called **network culling**.

---

#### Core Concepts

**Grid Management (`HashGrid.cs`)**

- Projects the 3D world onto a 2D grid (configurable axes: XY, XZ, etc.).
- Calculates which grid "cell" a `NetworkObject` occupies based on its world position (`GetHashGridPosition`).
- Finds all objects within the same or adjacent cells instantly, avoiding costly per-object distance checks.

**The Observer System Workflow**

1. A client connects and their player character is spawned on the server.
2. The server decides which of the hundreds of other objects to send to this client.
3. It uses the `HashGrid` to find the player's grid cell.
4. It gathers all objects in that cell and its **8 adjacent neighbors**.
5. Only those "nearby" objects are considered visible — all others are **culled**.

---

#### Design: A Modular, "Plug-and-Play" System

Your gameplay scripts have **no awareness** of the `HashGrid` — they simply modify `transform.position`. FishNet's `NetworkManager` and observer system handle all visibility logic.

- **Delegated Service:** When you add `HashGrid`, you're telling the observer system which visibility strategy to use. You can swap it with a distance-based system without touching gameplay code.
- **Service Locator Pattern:** `HashGrid` registers itself with the `NetworkManager` on `Awake()`, making it available to other core systems without hard dependencies.

```csharp
// HashGrid.cs — Service Locator registration on Awake
private void Awake()
{
    _networkManager = GetComponentInParent<NetworkManager>();

    if (!_networkManager.HasInstance<HashGrid>())
    {
        _halfAccuracy = Mathf.CeilToInt((float)_accuracy / 2f);
        _networkManager.RegisterInstance(this); // register as service
    }
    else
    {
        Destroy(this); // enforce singleton per NetworkManager
    }
}
```

---

#### Implementation Details

- **Setup:** Place `HashGrid.cs` on the same GameObject as your `NetworkManager`.
- **Singleton Enforcement:** The system is a singleton per `NetworkManager` and destroys duplicates automatically.
- **Service Consumption:** Other systems (e.g., `ManagedObjects`) obtain a reference via `manager.TryGetInstance(out _hashGrid)` during initialization.

---

#### Runtime Data Flow

**NetworkObject (The Observed Object)**

- Tracks its current grid cell (`_hashGridPosition`) and associated `GridEntry`.
- Grid position updates are **throttled to a 1-second interval** for performance.
- Update process:
  1. `ObserverManager.RebuildObservers()` calls `UpdateForNetworkObject()`.
  2. The 1-second timer is checked.
  3. If elapsed, the object's current grid cell is calculated.
  4. If the cell has **changed**, the state and `GridEntry` are updated.
- **Static Optimization:** Objects marked `static` in the Unity Editor skip all grid updates after initial placement.

---

**NetworkConnection (The Observer / Client)**

- Each client's `NetworkConnection` also tracks its position on the grid.
- The connection's grid position is derived from its `FirstObject` (typically the player character).
- Without a `FirstObject`, the connection has no spatial presence on the grid.
- When the `FirstObject` moves to a new cell, the system fetches the `GridEntry` for that cell — which pre-caches the cell plus all 8 neighbors in a `HashSet` (`NearbyEntries`) for fast visibility checks.

> **Note:** `NetworkConnection` is not a component — it represents the server-client communication channel, not a physical object.

---

**ManagedObjects (The Central Manager)**

- An abstract base class running on **both server and client**, with different responsibilities:
  - **`ServerObjects`** (server): Authority over object lifecycles.
  - **`ClientObjects`** (client): Reacts to server commands.
- Holds the reference to the active `HashGrid` instance, which is used by `ObserverManager` and its `HashGridCondition`.
- The `HashGridCondition` performs the actual visibility check: it compares a `NetworkObject`'s cell against a connection's pre-cached `NearbyEntries` set.

---

### 3. NetworkBehaviour Ownership Properties

These properties are defined on every `NetworkBehaviour` and control which context code runs in.

| Property | Who it refers to | Meaning / Use case |
|---|---|---|
| `IsOwner` | Local client | This client owns the object |
| `Owner` | Server / client | The `NetworkConnection` that owns the object |
| `IsServerInitialized` | Server | Server is fully initialized and authoritative |
| `IsClient` | Client | True for any client instance |
| `IsOwnerClient` | Local client | True if this client is the owner |
| `IsHost` | Server + client | True if running as host |

---

#### `IsOwner`

- **Type:** `bool`
- **True if:** This instance belongs to the local client.

```csharp
if (IsOwner)
{
    // Only the player controlling this object runs this code
}
```

---

#### `Owner`

- **Type:** `NetworkConnection`
- **Represents:** The client connection that "owns" this object.
- The server uses this to track which client is responsible and to validate `ServerRpc` calls with `RequireOwnership = true`.

```csharp
Debug.Log($"Owner ClientId: {Owner.ClientId}");
```

---

#### `IsServer` / `IsServerInitialized`

- `IsServer` is **obsolete**. Use:
  - `IsServerStarted` — server has started listening, but objects may not be initialized yet.
  - `IsServerInitialized` — server is fully ready.

```csharp
if (IsServerInitialized)
{
    // This code runs only on the server
}
```

> **Important:** Only the server can authoritatively modify `SyncVar` values.

---

#### `IsClient` / `IsOwnerClient`

- `IsClient` — True if this instance is running on a client.
- `IsOwnerClient` — True if this client is the owner.

```csharp
if (IsOwnerClient)
{
    // Run client-side owner logic (e.g., input handling)
}
```

---

#### `IsHost`

- **True if:** This instance is both server and client (host mode).
- Useful for handling host-specific logic differently from pure clients.

---

### Key Principles

- **Server authority:** Only the server can authoritatively change `SyncVar` values or object state.
- **Ownership:** Determines which client can request changes via `ServerRpc` with `RequireOwnership = true`.
- **Client visibility:** All clients see an object if they are observers. Scene objects are automatically observed.

---

### Other Notes

FishNet maintains a **monotonic counter** for client IDs, even in host mode.
When a new connection is accepted (including the host client), `ServerManager` assigns a **new `ClientId`** sequentially — IDs are never recycled until the entire transport layer is reset.