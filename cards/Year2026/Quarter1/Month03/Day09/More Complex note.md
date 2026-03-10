---
tags: []
C#:
---
## FishNet Networking Concepts

### 1. Intermediate Layers (Middleware)

Intermediate layers, or "middleware," provide a powerful hook to insert custom logic between the low-level transport layer (raw bytes) and FishNet’s high-level serialization layer. This allows you to intercept, modify, or analyze all incoming and outgoing network packets.

**Common Use Cases:**
- **Compression:** Compress outgoing data and decompress incoming data to save bandwidth.
- **Security:** Inject metadata or authentication tokens into packets.
- **Debugging & Analytics:** Log or filter packets for debugging, metrics, or replay systems.

**Data Flow:**  
The middleware intercepts data after it has been serialized into a message but before it is sent over the network, and vice-versa for incoming data.
User Data (NetworkMessages)
   ↓ Serialize
[ IntermediateLayer.HandleOutgoing ]  ← you can intercept here
   ↓ Transport.Send
---- network ----
   ↓ Transport.Receive
[ IntermediateLayer.HandleIncoming ]  ← you can intercept here
   ↓ Deserialize into messages


### 2. Networked Spatial Hashing (HashGrid)

In multiplayer games with many objects, it's highly inefficient to send updates about every object to every player. A player on one side of the map doesn't need data for an object on the opposite side. This is a problem of **interest management**.
The HashGrid system solves this by dividing the world into a grid and only sending updates for objects that are physically near the player, a technique often called "network culling."

#### Core Concepts

- **Grid Management (HashGrid.cs):**
    
    - This is the heart of the system. It projects the 3D world onto a 2D grid (configurable axes like XY, XZ, etc.).
    - It calculates which grid "cell" a NetworkObject is in based on its world position (GetHashGridPosition).
    - For any given object, it can instantly find all objects within the same or adjacent cells, avoiding costly distance checks against every object in the scene.
        
- **The Observer System Workflow:**
    
    1. A client connects, and their player character is spawned on the server.
    2. The server must decide which of the hundreds of other objects to send to this client.
    3. It uses the HashGrid to find the grid cell of the player's character.
    4. It gathers all objects located in that cell and its eight immediate neighbors.
    5. Only objects within this "nearby" area are considered visible. The server sends spawn/update messages for these objects and "culls" (ignores) all others, saving immense resources.
        

#### Design: A Modular, "Plug-and-Play" System

A key design feature is its modularity. Your gameplay scripts, like a character movement controller, have **no awareness** of the HashGrid system. They simply modify the transform.position.

- **Delegated Service:** FishNet's NetworkManager and its observer system handle all visibility logic. When you add the HashGrid component, you are telling the observer system: "Use this grid-based method to decide who sees what." You could swap it with another system (e.g., distance-based) without changing a single line of your gameplay code.
    
- **Service Locator Pattern:** The HashGrid automatically registers itself with the NetworkManager on Awake(), a clear example of the service locator pattern. This makes it available to other core FishNet systems without creating hard dependencies.
    
    ``` csharp
Hashgrid.cs
private void Awake()
{
    _networkManager = GetComponentInParent<NetworkManager>();
    
    // ... error checking ...

    // Make sure there is only one per networkmanager.
    if (!_networkManager.HasInstance<HashGrid>())
    {
        _halfAccuracy = Mathf.CeilToInt((float)_accuracy / 2f);
        // Indicates service locator pattern
        _networkManager.RegisterInstance(this); 
    }
    else
    {
        Destroy(this);
    }
}
```
#### Implementation Details

- **Setup:** Place the HashGrid.cs component on the same GameObject as your NetworkManager (recommended). The system is a singleton per NetworkManager and will destroy duplicates.
- **Service Location:** Other systems, like ManagedObjects (the Object Manager), get a reference to the active HashGrid instance during their initialization via manager.TryGetInstance(out _hashGrid). This is how the different parts of the engine connect.
    

#### Runtime and Data Flow

**NetworkObject (The Observed Object)**

- **State Tracking:** Every NetworkObject tracks its current grid cell (_hashGridPosition) and its associated GridEntry.
- **Throttled Updates:** To optimize performance, an object's grid position is **not** updated every frame. The UpdateForNetworkObject() method is throttled, by default to a **1-second interval**.
    
- **Update Process:**
    
    1. When the ObserverManager needs to check visibility (RebuildObservers()), it calls UpdateForNetworkObject().
    2. The method checks if the 1-second timer has elapsed.
    3. If so, it calculates the object's current grid cell.
    4. If the object has moved to a **new cell**, it updates its state and gets the new GridEntry from the HashGrid.
        
- **Static Optimization:** If a NetworkObject's GameObject is marked as static in the Unity Editor, the _isStatic check causes these updates to be skipped entirely after the initial placement, offering a significant performance boost.
    

**NetworkConnection (The Observer /Client)**

- **Player-Centric Tracking:** Each client's NetworkConnection also tracks its position on the grid.
- **Position Source:** The connection's grid position is determined by its FirstObject (typically the player's main character). Without a FirstObject, the connection has no spatial presence.
- **Throttled Updates:** The player's grid position is also updated on a 1-second throttle.
- **Update Process:** When the FirstObject moves to a new cell, the system fetches the corresponding GridEntry. This entry is special because it contains a pre-cached HashSet of its own cell plus all 8 neighboring cells (NearbyEntries), which makes visibility checks extremely fast.
- Not a component but what network object represents the client communication channel between server and client
    

**ManagedObjects (The Central Manager)**

- **Dual Role:** This is an abstract base class that runs on **both the server and the client**, but with different responsibilities.
    - **ServerObjects** (on the server) has authority over object lifecycles.
    - **ClientObjects** (on the client) reacts to server commands.
        
- **Core Responsibility:** Its primary role regarding the HashGrid is to get and hold the reference to the active instance.
- **Implicit Usage:** This reference is used by the ObserverManager and its underlying HashGridCondition. The condition performs the actual check: it takes the pre-cached "nearby" cells from a NetworkConnection and sees if a given NetworkObject's cell is within that set.


### **1. `IsOwner`**

- **Type:** `bool`
- **True if:** This instance of the object belongs to the local client.
- **Example usage:**
```csharp
if (IsOwner)
{
    // Only the player controlling this object runs this code
}
```
- **Server perspective:** The server can see which client is the owner using `Owner`.
    

### **2. `Owner`**

- **Type:** `NetworkConnection`
- **Represents:** The client connection that currently “owns” this object.
- **Server uses this to:**
    - Track which client is responsible for the object.
    - Determine who can send valid ServerRpc calls with `RequireOwnership = true`.
- **Example:**
```csharp
Debug.Log($"Owner ClientId: {Owner.ClientId}");
```

---

### **3. `IsServer` / `IsServerInitialized`**

- **`IsServer`** → obsolete, replaced by:
    - **`IsServerStarted`**: True if the server has started listening but objects may not be initialized yet.
    - **`IsServerInitialized`**: True if the server is fully initialized and objects are ready.
- **Use case:**

```csharp
if (IsServerInitialized)
{
    // This code runs **only on the server**
}
```
- **Important:** Only the server can authoritatively modify SyncVars directly.
    

---

### **4. `IsClient` / `IsOwnerClient`**

- **`IsClient`** → True if this instance is running on a client.
- **`IsOwnerClient`** → True if this client is the owner of this object.
- **Use case:**
```csharp
if (IsOwnerClient)
{
    // Run client-side owner logic (e.g., input handling)
}
```

---

### **5. `IsHost`**

- **True if:** This instance is both a server and a client (host mode).
- **Use case:** You might want to handle host-specific logic differently from pure clients.
    

---

### **6. Summary Table**

|Property|Who it refers to|Meaning / Use case|
|---|---|---|
|`IsOwner`|Local client|This client owns the object|
|`Owner`|Server/client|The NetworkConnection that owns the object|
|`IsServerInitialized`|Server|Server is fully initialized and authoritative|
|`IsClient`|Client|True for any client|
|`IsOwnerClient`|Local client|True for client if they are the owner|
|`IsHost`|Server + client|True if running as host|

---

✅ **Key principle:**

- **Server authority:** Only the server can authoritatively change SyncVars or object state.
- **Ownership:** Determines which client can request changes via ServerRpc with `RequireOwnership = true`.
- **Client visibility:** All clients see the object if they are observers (scene objects are automatically observed).
    


**Tentative**
Network Observer Interacts with Fishnet's spatial hashing to determine who see's a given client optimizing network culling.

is also needed for athens core to prevent sprite from being invisible


ask how to build and what is server versus what is client
heres a question how do i setup my network maanger to only creat what i need?

for example why did it atach a rollback maanger i am not using yet


Other server notes:

FishNet maintains a **monotonic counter** for client IDs, **even in host mode**.  
When a new connection is accepted by the server (including your own host client), the `ServerManager` assigns a **new `ClientId`** sequentially — it never recycles IDs until the entire transport layer is reset.