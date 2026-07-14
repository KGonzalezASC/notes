---
aliases:
  - Design Patterns Reference
  - Pattern Glossary
tags:
  - design-patterns
  - architecture
  - reference
  - unity
unity: 6.3 LTS (6000.3)
csharp: "9.0"
status: reference
updated: 2026-06-28
---

# Design Patterns - General and Unity Examples

A working glossary of the patterns I use to reason about architecture. Each entry has the same shape:

- **Intent** — one or two lines: what problem it solves.
- **Use when / avoid when** — the decision, not the theory.
- **General example** — C#, TypeScript, or C++, whichever communicates the idea fastest.
- **Unity example** — how it actually shows up in a game (Athens Core Omega / Fake Fighter / Skillcade backend).

> [!tip] How the links work
> Every pattern is an `H2` heading whose text is exactly the pattern name. Other notes link straight to a definition with `[[Design Patterns - General and Unity Examples#Repository pattern|Repository]]`. The [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern vocabulary map|ScriptableObjects note]]'s vocabulary map links here. Clicking a pattern name there jumps to its section below.

> [!note] Code-version target
> Unity examples target **Unity 6.3 LTS (6000.3) / C# 9.0**. General examples may use later C# features where they read better; those are labeled.

## Code card annotation modes

Live verification suite for candidate-style code cards. Each fence below exercises one annotation mode on this site — if every card renders and interacts, the port is good.

### Plain

```csharp
public interface IRepository<T> {
    T Get(string id);
}
```

### Walkthrough

```csharp {walkthrough}
// @step 1: Contract | Define the repository surface callers depend on.
public interface IEnemyRepository {
    Enemy Get(string id);
}

// @step 2: Concrete store | Scene-aware lookup behind the abstraction.
public class SceneEnemyRepository : IEnemyRepository {
    public Enemy Get(string id) => FindInScene(id);
}

// @step 3: Consumer | Gameplay code depends on the interface, not the scene.
public class SpawnDirector {
    readonly IEnemyRepository enemies;
    public SpawnDirector(IEnemyRepository enemies) => this.enemies = enemies;
}
```

### Density

```csharp {density}
// @zoom signature
public class ObjectPool<T> where T : class, new() {

// @zoom standard
  readonly Stack<T> free = new();
  public T Rent() => free.Count > 0 ? free.Pop() : new T();
  public void Return(T item) => free.Push(item);

// @zoom verbose
  // Prefer Rent/Return over Instantiate/Destroy in hot loops.
  // Keep pooled instances reset before re-issue.

// @zoom signature
}
```

### Scrubber

```csharp {scrubber}
// @v 1 (Direct lookup) | Naive singleton access from gameplay code.
public class ScoreService {
    public static ScoreService Instance { get; private set; }
    public int Score { get; private set; }
    public void Add(int delta) => Score += delta;
}

// @v 2 (Injected service) | Constructor injection replaces static Instance.
public class ScoreService {
    public int Score { get; private set; }
    public void Add(int delta) => Score += delta;
}
public class HudPresenter {
    readonly ScoreService scores;
    public HudPresenter(ScoreService scores) => this.scores = scores;
}

// @v 3 (Event-driven) | Score changes publish; UI observes without holding the service.
public class ScoreService {
    public event Action<int> Changed;
    int score;
    public void Add(int delta) {
        score += delta;
        Changed?.Invoke(score);
    }
}
```

### Heatmap

```csharp {heatmap}
// @heat cold | UpdateProjectiles() | 0.01ms | 0 B | System Entry Point | Runs once per frame.
void UpdateProjectiles() {
// @heat cold | CheckBoundaryExits() | 0.04ms | 0 B | Bounds Filter | Checks viewport overflow exits.
  CheckBoundaryExits();
// @heat warm | for loop | 0.45ms | 0 B | Iteration Overhead | Scales linearly with projectile counts.
  for (int i = 0; i < projectiles.Count; i++) {
// @heat warm | indexed read | 0.12ms | 0 B | Indexed Memory Read | Retrieves item from list index.
    var projectile = projectiles[i];
// @heat hot | UpdateMovement | 1.22ms | 0 B | Floating Point Update | Updates physics transforms.
    projectile.UpdateMovement(Time.deltaTime);
// @heat hot | CheckCollisions | 3.42ms | 184 B | GC Hotspot | Triggers allocations per query.
    projectile.CheckCollisions();
  }
}
```

### Branches

```csharp {branches}
// @path reject -> Order empty or unpaid — bail early.
public string ProcessOrder(Order order) {
  if (order.ItemCount == 0) return "reject";
// @path approve -> Premium customer over threshold needs review.
  if (order.Total > 1000 && !order.IsPremium) return "approve";
// @path commit -> Happy path commits the unit of work.
  unitOfWork.Commit(order);
  return "commit";
}
```

### Memory

```plaintext {memory}
// @byte 0..31 Transform | position, velocity, and facing
// @byte 32..54 State | current mode and gameplay flags
// @byte 55..248 Input | rollback command history
// @byte 249..284 Tail | checksums and variable metadata
```

### Glossary

```csharp {glossary}
// @typedef ICommand - Encapsulates a request as an object.
// @typedef CommandBus - Routes commands to handlers.
public void Issue(ICommand command) {
  commandBus.Dispatch(command);
}
```

### Linked map

```csharp {linked-map}
// @context sdk | GameInstaller.cs
// @register IEnemyRepository Singleton | Scene-backed enemy lookup
// @register IEventBus Singleton | Cross-system pub/sub
// @register CombatDirector Singleton | Composition root for combat flow
// @resolve SpawnSystem -> CombatDirector
// @resolve HudPresenter -> CombatDirector
bind.Singleton<IEnemyRepository>();
bind.Singleton<IEventBus>();
bind.Singleton<CombatDirector>();
```

---

## Contents

**Principles**
- [[#SOLID principles]] · [[#Single Responsibility Principle|SRP]] · [[#Open Closed Principle|OCP]] · [[#Liskov Substitution Principle|LSP]] · [[#Interface Segregation Principle|ISP]] · [[#Dependency Inversion Principle|DIP]]

**Creational**
- [[#Singleton pattern|Singleton]] · [[#Factory Method pattern|Factory Method]] · [[#Abstract Factory pattern|Abstract Factory]] · [[#Builder pattern|Builder]] · [[#Fluent Builder pattern|Fluent Builder]] · [[#Prototype pattern|Prototype]] · [[#Prototype Registry pattern|Prototype Registry]] · [[#Object Pool pattern|Object Pool]] · [[#Lazy Initialization pattern|Lazy Initialization]]

**Structural**
- [[#Adapter pattern|Adapter]] · [[#Facade pattern|Facade]] · [[#Composite pattern|Composite]] · [[#Bridge pattern|Bridge]] · [[#Flyweight pattern|Flyweight]] · [[#Decorator pattern|Decorator]]

**Behavioral**
- [[#Command pattern|Command]] · [[#Observer pattern|Observer]] · [[#Mediator pattern|Mediator]] · [[#Visitor pattern|Visitor]] · [[#Strategy pattern|Strategy]] · [[#State pattern|State]] · [[#Template Method pattern|Template Method]] · [[#Chain of Responsibility pattern|Chain of Responsibility]] · [[#Interpreter pattern|Interpreter]] · [[#Iterator pattern|Iterator]] · [[#Memento pattern|Memento]] · [[#Null Object pattern|Null Object]] · [[#Double Dispatch pattern|Double Dispatch]] · [[#Specification pattern|Specification]]

**Dependency & cross-cutting**
- [[#Service Locator pattern|Service Locator]] · [[#Dependency Injection]] · [[#Aspect Oriented Programming]]

**Data & persistence**
- [[#Property Bag pattern|Property Bag]] · [[#Repository pattern|Repository]] · [[#Unit of Work pattern|Unit of Work]] · [[#Active Record pattern|Active Record]] · [[#CQRS]] · [[#Event Sourcing]] · [[#Materialized View pattern|Materialized View]]

**Messaging & data layout**
- [[#Event Bus pattern|Event Bus]] · [[#Entity Component System]] · [[#Data Oriented Design]]

**Application architecture**
- [[#Model View Controller]] · [[#Hexagonal Architecture]] · [[#Clean Architecture]] · [[#Microservices Architecture]] · [[#Anti Corruption Layer pattern|Anti-Corruption Layer]] · [[#Backend for Frontend pattern|Backend for Frontend]] · [[#Strangler Fig pattern|Strangler Fig]] · [[#Gateway pattern|Gateway]] · [[#API Composition pattern|API Composition]]

**Distributed systems & resilience**
- [[#Saga pattern|Saga]] · [[#Circuit Breaker pattern|Circuit Breaker]] · [[#Bulkhead pattern|Bulkhead]] · [[#Retry pattern|Retry]] · [[#Timeout pattern|Timeout]] · [[#Throttling pattern|Throttling]] · [[#Sidecar pattern|Sidecar]] · [[#Ambassador pattern|Ambassador]] · [[#Scatter Gather pattern|Scatter-Gather]] · [[#Leader Election pattern|Leader Election]] · [[#Lease pattern|Lease]] · [[#Two Phase Commit pattern|2PC]] · [[#Three Phase Commit pattern|3PC]] · [[#Sharding pattern|Sharding]]

---

# Principles

## SOLID principles

**Intent:** Five class-design principles (SRP, OCP, LSP, ISP, DIP) that together keep object-oriented code changeable. They are not patterns; they are the constraints most patterns exist to satisfy.

**Use when:** always, as a review lens. **Avoid:** treating them as laws that justify over-abstraction — a one-off script does not need five interfaces.

The five are defined individually below. The shorthand: *one reason to change ([[#Single Responsibility Principle|SRP]]), extend without editing ([[#Open Closed Principle|OCP]]), subtypes honor the base contract ([[#Liskov Substitution Principle|LSP]]), small focused interfaces ([[#Interface Segregation Principle|ISP]]), depend on abstractions ([[#Dependency Inversion Principle|DIP]]).*

## Single Responsibility Principle

**Intent:** A class should have one reason to change — one cohesive responsibility.

**Use when:** a type starts mixing concerns (parsing + I/O + formatting). **Avoid when:** splitting produces anemic classes that always change together anyway.

**General example (C#)** — split the reasons to change:

```csharp
// Bad: persistence + formatting + business rule in one type.
class Invoice { decimal Total() {/*...*/} string ToHtml() {/*...*/} void Save() {/*...*/} }

// Good: each has one reason to change.
class Invoice          { public decimal Total() {/*...*/} }
class InvoiceRenderer  { public string ToHtml(Invoice i) {/*...*/} }
class InvoiceRepository{ public void Save(Invoice i) {/*...*/} }
```

**Unity example:** `CharacterDataSO` owns authored stats; `PlayerController` owns runtime velocity/health; `CharacterRepository`/`CharacterDatabase` owns lookup. A "GlobalSessionObject" that holds input, selection, textures, and debug flags is the canonical SRP violation (see [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Anti-pattern - one global session object (god object)|the god-object note]]).

## Open Closed Principle

**Intent:** Open for extension, closed for modification — add behavior by adding code, not editing tested code.

**Use when:** a `switch`/`if-else` grows a new branch every time a feature is added. **Avoid when:** variation is genuinely fixed; premature plug-in points are dead weight.

**General example (C#)** — new shapes without touching the calculator:

```csharp
interface IShape { double Area(); }
sealed class Circle : IShape { public double R; public double Area() => Math.PI * R * R; }
sealed class Square : IShape { public double S; public double Area() => S * S; }

double TotalArea(IEnumerable<IShape> shapes) => shapes.Sum(s => s.Area());
// Adding a Triangle: new class, zero edits to TotalArea.
```

**Unity example:** [[#Strategy pattern|Strategy]] `ScriptableObject` assets — a new `TargetingRule` asset adds AI behavior with no edits to the consumer that calls `PickTarget`. Authoring a new asset *is* the extension.

## Liskov Substitution Principle

**Intent:** A subtype must be usable anywhere its base type is, without surprising the caller (no strengthened preconditions, no weakened postconditions, no throwing where the base didn't).

**Use when:** designing inheritance hierarchies. **Avoid violating:** the classic `Square : Rectangle` where setting width also mutates height breaks code that sets them independently.

**General example (C#)** — the violation:

```csharp
class Rectangle { public virtual int Width {get;set;} public virtual int Height {get;set;} }
class Square : Rectangle {            // breaks LSP
    public override int Width  { set { base.Width = base.Height = value; } }
    public override int Height { set { base.Width = base.Height = value; } }
}
void Stretch(Rectangle r) { r.Width = 5; r.Height = 4; Assert(r.Width == 5); } // fails for Square
```

**Unity example:** if `RuntimeSet<T>.Add` promises "stores the item," a subclass that silently drops duplicates without saying so breaks callers that count on every `Add` succeeding. Keep overridden `ScriptableObject`/`MonoBehaviour` virtuals faithful to the base contract.

## Interface Segregation Principle

**Intent:** Many small, role-specific interfaces beat one fat interface; clients shouldn't depend on methods they don't use.

**Use when:** implementers are forced to stub out `NotImplementedException` methods. **Avoid when:** interfaces fragment so far that cohesive roles get scattered.

**General example (C#)**:

```csharp
// Fat: every device must implement everything.
interface IMultiFunctionDevice { void Print(); void Scan(); void Fax(); }

// Segregated: implement only the roles you fill.
interface IPrinter { void Print(); }
interface IScanner { void Scan(); }
class SimplePrinter : IPrinter { public void Print() {/*...*/} }
```

**Unity example:** `ISkillcadeConfig` exposes only the config values a consumer needs (`StartGameCountdownSeconds`), not the whole `SkillcadeGameConfig` asset. A system that only reads countdown timing depends on a narrow interface, not the full SO.

## Dependency Inversion Principle

**Intent:** High-level policy and low-level detail should both depend on abstractions; the abstraction shouldn't depend on the detail. (The *why* behind [[#Dependency Injection]].)

**Use when:** business logic is welded to a concrete database/HTTP client/engine API. **Avoid when:** there is exactly one implementation forever and the interface adds only indirection.

**General example (C#)**:

```csharp
// High-level OrderService depends on an abstraction it owns...
interface IPaymentGateway { void Charge(decimal amount); }
class OrderService(IPaymentGateway gateway) {            // C# 12 primary ctor (general example)
    public void Checkout(decimal amount) => gateway.Charge(amount);
}
// ...low-level StripeGateway implements it. Policy doesn't know Stripe exists.
class StripeGateway : IPaymentGateway { public void Charge(decimal a) {/*...*/} }
```

**Unity example:** a `MatchRunner` depends on an injected `GameEventBus` abstraction rather than `new`-ing a concrete logger/network client. Constructor injection via a DI container (VContainer) hands the dependency in; the runner never reaches for a global. Contrast [[#Service Locator pattern|Service Locator]], which inverts ownership the other way.

# Creational

## Singleton pattern

**Intent:** Guarantee one instance with a global access point.

**Use when:** genuinely one-of-a-kind, stateless-ish coordinators. **Avoid when:** it's really just global mutable state — it hides dependencies and wrecks testing. Prefer [[#Dependency Injection]]; reach for [[#Service Locator pattern|Service Locator]] only when no container exists.

**General example (C#)** — thread-safe lazy:

```csharp
public sealed class Logger
{
    private static readonly Lazy<Logger> _instance = new(() => new Logger());
    public static Logger Instance => _instance.Value;
    private Logger() { }
    public void Log(string msg) => Console.WriteLine(msg);
}
```

**Unity example:** the *only* Unity-blessed runtime singleton is editor-side `UnityEditor.ScriptableSingleton<T>` for tool state. For gameplay, a `MonoBehaviour` "singleton" with `DontDestroyOnLoad` is common but leaks global state — see [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#When a true SO singleton is acceptable|the SO note's singleton checklist]] (uniqueness, readiness, reset, scope) before using one.

## Factory Method pattern

**Intent:** Defer which concrete type to instantiate to a subclass/method, so creation logic lives in one place.

**Use when:** construction is non-trivial or varies by subtype. **Avoid when:** a plain `new` is clear.

**General example (C#)**:

```csharp
abstract class Dialog {
    public abstract IButton CreateButton();          // factory method
    public void Render() => CreateButton().Paint();
}
class WindowsDialog : Dialog { public override IButton CreateButton() => new WinButton(); }
class WebDialog     : Dialog { public override IButton CreateButton() => new HtmlButton(); }
```

**Unity example:** `ProjectileLibrary.Initialize()` is a factory method turning a `ProjectileDefinitionSurrogate` into a validated `ProjectileDefinition` (throwing on bad data). Callers ask the library for definitions; they never construct them.

## Abstract Factory pattern

**Intent:** Create *families* of related objects through one interface, keeping the family consistent.

**Use when:** you swap a whole coherent set (UI theme, platform backend) at once. **Avoid when:** there is only one family — it's needless layering.

**General example (C#)**:

```csharp
interface IUiFactory { IButton Button(); ICheckbox Checkbox(); }
class DarkUiFactory  : IUiFactory { public IButton Button()=>new DarkButton();  public ICheckbox Checkbox()=>new DarkCheck(); }
class LightUiFactory : IUiFactory { public IButton Button()=>new LightButton(); public ICheckbox Checkbox()=>new LightCheck(); }
// Client uses IUiFactory; the whole theme stays internally consistent.
```

**Unity example:** a `ICharacterVfxFactory` that produces a matched set (hit spark + trail + sound) per art style, selected by a `ScriptableObject`. Swap the factory asset → the entire presentation family changes together, no mixed styles.

## Builder pattern

**Intent:** Construct a complex object step by step, separating assembly from representation.

**Use when:** many optional parameters or staged construction. **Avoid when:** a constructor or object initializer suffices.

**General example (C#)**:

```csharp
class HttpRequestBuilder {
    private readonly HttpRequest _r = new();
    public HttpRequestBuilder Url(string u){ _r.Url = u; return this; }
    public HttpRequestBuilder Header(string k,string v){ _r.Headers[k]=v; return this; }
    public HttpRequest Build() => _r;
}
```

**Unity example:** assembling a `Match` config — stage, rules, player slots, rounds — in a `MatchBuilder` before handing an immutable match descriptor to the runner. Keeps half-built match state from leaking into gameplay.

## Fluent Builder pattern

**Intent:** A Builder whose step methods return `this` (or a stage interface), giving a readable chained DSL.

**Use when:** readability of the call site matters; optionally enforce order with "stage" interfaces. **Avoid when:** the chain hides required-vs-optional and lets you `Build()` an invalid object.

**General example (C#)** — staged fluency forces a URL before build:

```csharp
new RequestBuilder()
    .Get("https://api.example.com/scores")   // returns IConfigured
    .Header("Authorization", token)
    .Timeout(TimeSpan.FromSeconds(5))
    .Build();
```

**Unity example:** a test-fixture DSL: `Fighter.Builder().WithHealth(100).At(Vector3.zero).Facing(Right).Spawn()` to set up deterministic combat scenarios in play-mode tests without giant constructors.

## Prototype pattern

**Intent:** Create new objects by cloning an existing instance instead of constructing from scratch.

**Use when:** instances are expensive to build or configured at runtime and you want copies. **Avoid when:** deep-copy semantics are error-prone (shared references).

**General example (C#)**:

```csharp
public sealed class EnemyStats : ICloneable {
    public int Hp; public float Speed;
    public object Clone() => MemberwiseClone(); // shallow; deep-copy refs if needed
}
var elite = (EnemyStats)baseGoblin.Clone(); elite.Hp *= 2;
```

**Unity example:** Unity's whole prefab system is Prototype — `Instantiate(prefab)` clones a configured template. `ScriptableObject` authoring assets are prototypes you copy values *from* into runtime state, rather than mutating the asset.

## Prototype Registry pattern

**Intent:** A named catalog of prototypes you look up and clone by key. (Prototype + [[#Repository pattern|Repository]].)

**Use when:** spawning by id/name from data. **Avoid when:** the set is tiny and static — direct references are simpler.

**General example (C#)**:

```csharp
class EnemyRegistry {
    private readonly Dictionary<string, EnemyStats> _protos = new();
    public void Register(string id, EnemyStats proto) => _protos[id] = proto;
    public EnemyStats Spawn(string id) => (EnemyStats)_protos[id].Clone();
}
```

**Unity example:** `CharacterDatabase.GetCharacterByName(name)` returns the authored `CharacterDataSO` prototype, which the spawner copies into a live `PlayerController`. The database is the registry; the SO is the prototype.

## Object Pool pattern

**Intent:** Reuse a fixed set of pre-allocated objects instead of constantly allocating/freeing, to avoid GC spikes.

**Use when:** high-churn short-lived objects (bullets, particles, enemies). **Avoid when:** objects are rare or cheap — pooling adds lifecycle bugs (stale state on reuse).

**General example (C#)**:

```csharp
class Pool<T> where T : new() {
    private readonly Stack<T> _free = new();
    public T Rent() => _free.Count > 0 ? _free.Pop() : new T();
    public void Return(T item) => _free.Push(item);
}
```

**Unity example:** projectiles in a fighting game. Unity ships `UnityEngine.Pool.ObjectPool<T>`; `ProjectileManager` rents a `Projectile`, resets its runtime state on `Get`, and returns it on despawn — keeping per-frame allocations (and rollback churn) flat.

## Lazy Initialization pattern

**Intent:** Defer creating/loading something until first use.

**Use when:** the resource is expensive and maybe never needed. **Avoid when:** it hides async work behind a synchronous-looking getter — a classic Unity foot-gun.

**General example (C#)**:

```csharp
private Lazy<HeavyService> _svc = new(() => new HeavyService());
public HeavyService Service => _svc.Value;   // built on first access, once
```

**Unity example — done right vs wrong:** *wrong* is a lazy `Instance` getter that kicks off `Addressables.LoadAssetAsync` and returns a maybe-null asset. *Right* is `AppRuntime.InitializeAsync()` with explicit readiness/cancel/release (`loadTask ??= LoadAsync(...)`). See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Step 4 - The global provider|the SO note's provider]].

# Structural

## Adapter pattern

**Intent:** Wrap an incompatible interface so a client can use it through the interface it expects.

**Use when:** integrating a third-party/legacy API. **Avoid when:** you can change the source directly — adapt only what you don't own.

**General example (C#)**:

```csharp
interface ILogger { void Log(string msg); }                 // what our code wants
class SerilogAdapter : ILogger {                             // third-party shape underneath
    private readonly Serilog.ILogger _inner;
    public SerilogAdapter(Serilog.ILogger inner) => _inner = inner;
    public void Log(string msg) => _inner.Information(msg);
}
```

**Unity example:** wrapping the Skillcade SDK's networking call behind your own `IMatchService` so gameplay code depends on your interface, not the vendor's. When the SDK changes, only the adapter changes. (A whole layer of adapters at a boundary is an [[#Anti Corruption Layer pattern|Anti-Corruption Layer]].)

## Facade pattern

**Intent:** One simplified entry point over a complex subsystem.

**Use when:** callers only need the common 20% of a sprawling API. **Avoid when:** the facade becomes a god object that grows without bound.

**General example (C#)**:

```csharp
class MediaFacade {                       // hides codecs, buffers, audio device setup
    public void Play(string file) { /* decode + buffer + open device + stream */ }
}
```

**Unity example:** an `AudioDirector` facade with `PlayConfirm()` / `PlayMatchStart()` over the messy mixer, addressable clip loading, and pooled `AudioSource` plumbing. UI calls one method; the subsystem stays hidden. (Compare [[#Mediator pattern|Mediator]], which coordinates peers rather than just simplifying access.)

## Composite pattern

**Intent:** Treat individual objects and groups of objects uniformly through a shared interface (tree structure).

**Use when:** part-whole hierarchies (UI trees, scene graphs, behavior trees). **Avoid when:** the structure is flat.

**General example (C#)**:

```csharp
interface IComponentUi { void Draw(); }
class Leaf  : IComponentUi { public void Draw() {/*...*/} }
class Panel : IComponentUi {                       // a composite of children
    private readonly List<IComponentUi> _kids = new();
    public void Add(IComponentUi c) => _kids.Add(c);
    public void Draw() { foreach (var k in _kids) k.Draw(); }
}
```

**Unity example:** the `Transform` hierarchy itself is Composite — a parent `GameObject` and a single child respond to the same transform operations. Behaviour-tree / GameplayAbility nodes (composite vs leaf) use it explicitly.

## Bridge pattern

**Intent:** Split an abstraction from its implementation so the two vary independently (avoids a class explosion of `AxB` subclasses).

**Use when:** two dimensions of variation multiply (shape × renderer, weapon × element). **Avoid when:** only one dimension varies — that's just [[#Strategy pattern|Strategy]].

**General example (C#)**:

```csharp
interface IRenderer { void DrawCircle(float r); }          // implementation axis
abstract class Shape { protected IRenderer R; protected Shape(IRenderer r){R=r;} public abstract void Draw(); }
class Circle : Shape { float _r; public Circle(IRenderer r,float radius):base(r){_r=radius;} public override void Draw()=>R.DrawCircle(_r); }
// Add VectorRenderer/RasterRenderer without touching Circle, and vice-versa.
```

**Unity example:** an `Attack` abstraction (light/heavy/special) bridged to a `IHitEffect` implementation (fire/ice/electric). 3 attacks × 3 elements = 6 classes instead of 9, and each axis grows independently.

## Flyweight pattern

**Intent:** Share one immutable instance of intrinsic (context-free) data across many objects; keep only extrinsic (per-instance) state separate.

**Use when:** huge counts of objects share heavy static data (glyphs, tiles, projectile defs). **Avoid when:** counts are small — the indirection isn't worth it.

**General example (C#)**:

```csharp
sealed record GlyphStyle(string Font, float Size, int Color);   // shared, immutable
class GlyphRun {
    private readonly GlyphStyle _style;     // flyweight, shared by thousands of chars
    private readonly Vector2 _position;     // extrinsic, per-instance
}
```

**Unity example:** `ProjectileLibrary.RuntimeLibrary` maps `ProjectileID → ProjectileDefinition`; every spawned bullet references the *one* shared definition (prefab, settings family) and carries only its own position/velocity. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 3 - Editor-friendly data, runtime-friendly compiled data|SO Pattern 3]].

## Decorator pattern

**Intent:** Add responsibilities to an object dynamically by wrapping it in another object with the same interface.

**Use when:** stackable, composable behavior (buffs, I/O filters). **Avoid when:** combinations are fixed — inheritance or [[#Strategy pattern|Strategy]] is simpler.

**General example (C#)** — composable streams:

```csharp
interface IDataSource { byte[] Read(); }
class FileSource : IDataSource { public byte[] Read() {/*...*/} }
class GzipDecorator : IDataSource {
    private readonly IDataSource _inner;
    public GzipDecorator(IDataSource inner) => _inner = inner;
    public byte[] Read() => Decompress(_inner.Read());
}
// new EncryptDecorator(new GzipDecorator(new FileSource()))
```

**Unity example:** stat modifiers as decorators — `new CritModifier(new BuffModifier(baseDamage))` each wrapping `IDamageSource.Compute()`. Buffs stack and unstack at runtime without editing the base damage calculation.

# Behavioral

## Command pattern

**Intent:** Encapsulate a request as an object — so you can queue, log, undo, or replay it.

**Use when:** you need undo/redo, input remapping, replays, or deferred execution. **Avoid when:** a direct method call is enough.

**General example (C#)**:

```csharp
interface ICommand { void Execute(); void Undo(); }
class MoveCommand : ICommand {
    private readonly Unit _u; private readonly Vector2 _delta;
    public MoveCommand(Unit u, Vector2 d){ _u=u; _delta=d; }
    public void Execute() => _u.Pos += _delta;
    public void Undo()    => _u.Pos -= _delta;
}
```

**Unity example:** input as commands is the backbone of rollback netcode — each frame's input becomes a command applied to the sim, so the engine can re-execute a queue of commands from a known frame. Also editor undo and remappable controls.

## Observer pattern

**Intent:** Subjects notify a list of subscribers when they change, without knowing who they are.

**Use when:** one-to-many change notification (UI reacting to model). **Avoid when:** it becomes a tangle of who-fires-what; consider a [[#Mediator pattern|Mediator]]/[[#Event Bus pattern|Event Bus]].

**General example (C#)** — C# events *are* Observer:

```csharp
class Health {
    public event Action<int> Changed;
    private int _hp;
    public int Hp { get => _hp; set { _hp = value; Changed?.Invoke(_hp); } }
}
```

**Unity example:** `ScriptableObject` event channels — `VoidEventChannel.Subscribe/Raise`. UI subscribes in `OnEnable`, unsubscribes in `OnDisable`. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 6 - Event channel asset|SO Pattern 6]].

## Mediator pattern

**Intent:** Centralize communication between components so they talk to a mediator instead of each other (reduces N×N coupling to N).

**Use when:** many peers interact in complex ways (UI form fields, chat room). **Avoid when:** the mediator swells into a god object.

**General example (C#)**:

```csharp
interface IChatRoom { void Send(string from, string msg); void Join(User u); }
class ChatRoom : IChatRoom {                 // users never reference each other
    private readonly List<User> _users = new();
    public void Join(User u){ _users.Add(u); u.Room = this; }
    public void Send(string from,string msg){ foreach(var u in _users) u.Receive(from,msg); }
}
```

**Unity example:** an event aggregator like `GameEventBus` is Mediator + [[#Observer pattern|Observer]]: systems publish/subscribe to it instead of holding references to each other. The bus mediates match-started, player-joined, result-reported.

## Visitor pattern

**Intent:** Add new operations to a fixed object hierarchy without modifying the classes, by moving the operation into a visitor (uses [[#Double Dispatch pattern|Double Dispatch]]).

**Use when:** the type hierarchy is stable but operations change often (AST walks, exporters). **Avoid when:** you add new node types frequently — every visitor must then change.

**General example (C#)**:

```csharp
interface IExprVisitor { void Visit(NumberExpr n); void Visit(AddExpr a); }
abstract class Expr { public abstract void Accept(IExprVisitor v); }
class NumberExpr : Expr { public double Value; public override void Accept(IExprVisitor v)=>v.Visit(this); }
class AddExpr    : Expr { public Expr L,R;     public override void Accept(IExprVisitor v)=>v.Visit(this); }
// new PrintVisitor / EvalVisitor add operations without touching Expr classes.
```

**Unity example:** walking a skill/combo tree to produce different outputs — an `EvaluateVisitor` for the sim, a `DocsVisitor` to export move lists, a `GizmoVisitor` to draw debug overlays — all over the same node types.

## Strategy pattern

**Intent:** Define a family of interchangeable algorithms behind one interface, selectable at runtime.

**Use when:** behavior varies and should be swappable (sorting, AI, pricing). **Avoid when:** there is only one algorithm ever.

**General example (C#)**:

```csharp
interface ISortStrategy { void Sort(int[] data); }
class QuickSort : ISortStrategy { public void Sort(int[] d) {/*...*/} }
class Sorter { private ISortStrategy _s; public Sorter(ISortStrategy s)=>_s=s; public void Run(int[] d)=>_s.Sort(d); }
```

**Unity example:** `TargetingRule` `ScriptableObject` assets — `ClosestTargetingRule`, `LowestHpTargetingRule` — assigned in the Inspector. The asset *is* the strategy; this is how SOs deliver [[#Open Closed Principle|OCP]]. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 5 - Strategy asset|SO Pattern 5]].

## State pattern

**Intent:** Let an object change behavior by switching its current state object — each state encapsulates its own transitions.

**Use when:** complex, transition-heavy behavior (character controllers, UI flow). **Avoid when:** a simple `enum` + `switch` is clearer for a couple of states.

**General example (C#)**:

```csharp
interface IState { IState Update(Player p); }
class Idle    : IState { public IState Update(Player p) => p.Input.x != 0 ? new Walking() : this; }
class Walking : IState { public IState Update(Player p) => p.Input.x == 0 ? new Idle() : this; }
// player._state = player._state.Update(player);
```

**Unity example:** a fighter's state machine — `Idle / Walk / Jump / Attack / Hitstun / Block` — each state owning its allowed transitions and frame logic. In rollback code, states must be plain serializable data so they roll back cleanly.

## Template Method pattern

**Intent:** A base method defines the skeleton of an algorithm and defers specific steps to subclasses.

**Use when:** several variants share a fixed sequence with a few differing steps. **Avoid when:** composition ([[#Strategy pattern|Strategy]]) gives more flexibility without inheritance.

**General example (C#)**:

```csharp
abstract class DataImporter {
    public void Import() { Open(); Parse(); Validate(); Save(); }  // fixed skeleton
    protected abstract void Parse();                               // varying step
    protected virtual void Validate() { }                         // optional hook
    protected void Open() {/*...*/}  protected void Save() {/*...*/}
}
```

**Unity example:** abstract `RuntimeSet<T>` fixes `Add/Remove/Clear`; concrete `PlayerRuntimeSet : RuntimeSet<PlayerController>` only specializes the type. The skeleton lives in the base. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 7 - Runtime set asset|SO Pattern 7]].

## Chain of Responsibility pattern

**Intent:** Pass a request along a chain of handlers until one handles it.

**Use when:** input pipelines, middleware, escalation. **Avoid when:** exactly one handler always applies — just call it.

**General example (C#)**:

```csharp
abstract class Handler {
    protected Handler Next;
    public Handler SetNext(Handler n){ Next = n; return n; }
    public virtual void Handle(Request r) => Next?.Handle(r);
}
class AuthHandler : Handler { public override void Handle(Request r){ if(!r.Authed) return; base.Handle(r); } }
```

**Unity example:** an input-handling stack where a modal popup gets first crack at a button press, then the pause menu, then gameplay — each handler consumes the event or passes it down. Also damage pipelines (shield → armor → health).

## Interpreter pattern

**Intent:** Define a grammar and an evaluator for a small language.

**Use when:** you have a recurring mini-language (formulas, query filters, dialogue conditions). **Avoid when:** the language grows real — use a parser generator, not hand-rolled interpreters.

**General example (C#)** — boolean condition tree:

```csharp
interface IExpr { bool Eval(Ctx c); }
class HasFlag : IExpr { string _f; public HasFlag(string f)=>_f=f; public bool Eval(Ctx c)=>c.Flags.Contains(_f); }
class And : IExpr { IExpr _a,_b; public And(IExpr a,IExpr b){_a=a;_b=b;} public bool Eval(Ctx c)=>_a.Eval(c)&&_b.Eval(c); }
```

**Unity example:** dialogue/quest conditions authored as data (`hasItem("key") && level >= 3`) and evaluated against game state. Pairs well with [[#Specification pattern|Specification]] for reusable predicates.

## Iterator pattern

**Intent:** Traverse a collection's elements without exposing its internal structure.

**Use when:** custom traversal (tree order, paged feeds). **Avoid when:** the built-in `foreach`/`IEnumerable` already covers it.

**General example (C#)** — `yield` builds an iterator for you:

```csharp
IEnumerable<int> Fibonacci() {
    int a = 0, b = 1;
    while (true) { yield return a; (a, b) = (b, a + b); }
}
```

**Unity example:** coroutines (`IEnumerator` + `yield return`) are the Iterator pattern repurposed as a time-sliced scheduler — `yield return new WaitForSeconds(1f)` walks a sequence of resume points across frames.

## Memento pattern

**Intent:** Capture an object's internal state so it can be restored later, without exposing its internals.

**Use when:** undo, checkpoints, snapshots, rollback. **Avoid when:** state is huge and snapshots are too expensive (consider [[#Event Sourcing]]).

**General example (C#)**:

```csharp
record EditorMemento(string Text, int Caret);              // opaque snapshot
class Editor {
    public string Text; public int Caret;
    public EditorMemento Save() => new(Text, Caret);
    public void Restore(EditorMemento m){ Text = m.Text; Caret = m.Caret; }
}
```

**Unity example:** rollback netcode is industrial-strength Memento — each frame the sim's full deterministic state is saved so GGPO can restore frame N and re-simulate when a remote input arrives late. State must be plain serializable data (not `ScriptableObject` mutations) for this to work.

## Null Object pattern

**Intent:** Provide a do-nothing implementation of an interface instead of returning `null`, removing null checks.

**Use when:** "absence" has a sensible neutral behavior. **Avoid when:** absence is a real error you should surface.

**General example (C#)**:

```csharp
interface ILogger { void Log(string m); }
sealed class NullLogger : ILogger { public static readonly NullLogger Instance = new(); public void Log(string m){} }
// service ??= NullLogger.Instance;  — no more `if (logger != null)`
```

**Unity example:** a `NullTargetingRule` that returns no target, or a `NullVfxPlayer` for headless/server builds, so gameplay code never branches on `null` and dedicated-server runs skip presentation cleanly.

## Double Dispatch pattern

**Intent:** Select behavior based on the runtime types of *two* objects, not one — what single virtual dispatch can't do alone.

**Use when:** collision/interaction matrices, [[#Visitor pattern|Visitor]] internals. **Avoid when:** a type/tag check is clearer for a small matrix.

**General example (C#)**:

```csharp
abstract class Shape { public abstract bool Intersect(Shape other);
                       public abstract bool IntersectWith(Circle c); public abstract bool IntersectWith(Box b); }
class Circle : Shape {
    public override bool Intersect(Shape other) => other.IntersectWith(this);  // 1st dispatch
    public override bool IntersectWith(Circle c) {/*circle-circle*/ return true;}
    public override bool IntersectWith(Box b)    {/*circle-box*/    return true;}
}
```

**Unity example:** resolving what happens when projectile-type A hits hurtbox-type B without a giant `switch` — each `OnHit(other)` re-dispatches to a type-specific handler. (In ECS/DOD this is usually flattened into a lookup table for performance.)

## Specification pattern

**Intent:** Encapsulate a business rule as a reusable, combinable object (`IsSatisfiedBy`) that can be `And`/`Or`/`Not`-composed.

**Use when:** rules are reused across query + validation + UI, and recombined. **Avoid when:** a one-off `Where` lambda is enough.

**General example (C#)**:

```csharp
interface ISpec<T> { bool IsSatisfiedBy(T item); }
class CheapSpec : ISpec<Item> { public bool IsSatisfiedBy(Item i) => i.Price < 10; }
class AndSpec<T> : ISpec<T> { ISpec<T> _a,_b; public AndSpec(ISpec<T> a,ISpec<T> b){_a=a;_b=b;}
    public bool IsSatisfiedBy(T x) => _a.IsSatisfiedBy(x) && _b.IsSatisfiedBy(x); }
```

**Unity example:** matchmaking eligibility — `new SkillInRange(elo).And(new RegionMatches(region)).And(new NotBlocked(player))` reused both to filter the candidate pool and to validate a proposed match on the Skillcade backend.

# Dependency & cross-cutting

## Service Locator pattern

**Intent:** A central registry that hands out service instances on request (`Locator.Get<T>()`).

**Use when:** no DI container is available, or for pre-scene/global bootstrap access. **Avoid when:** you can inject instead — it hides dependencies (callers *pull* rather than *receive*) and complicates tests.

**General example (C#)**:

```csharp
static class ServiceLocator {
    private static readonly Dictionary<Type, object> _services = new();
    public static void Register<T>(T svc) => _services[typeof(T)] = svc;
    public static T Get<T>() => (T)_services[typeof(T)];
}
```

**Unity example:** `AppRuntime.Service` is a Service Locator with explicit readiness/override/release. It's the right tool *before* a DI container exists (bootstrapping); once a scene installer runs, prefer [[#Dependency Injection]]. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Step 4 - The global provider|the SO provider]].

## Dependency Injection

**Intent:** Supply a component's dependencies from outside (constructor/method/field) instead of having it construct or locate them — the mechanism that realizes the [[#Dependency Inversion Principle|DIP]].

**Use when:** you want testable, loosely-coupled components with visible dependencies. **Avoid when:** trivial scripts — wiring overhead outweighs benefit.

**General example (C#)** — constructor injection:

```csharp
class OrderService {
    private readonly IPaymentGateway _gateway;
    public OrderService(IPaymentGateway gateway) => _gateway = gateway;  // injected, not new'd
}
// container.Register<IPaymentGateway, StripeGateway>();
```

**Unity example:** VContainer/Zenject installers register `GameEventBus`, services, and config, then inject them into `MonoBehaviour`s and plain C# runners. Dependencies appear in constructors/`[Inject]` fields, not via static lookup. Contrast [[#Service Locator pattern|Service Locator]].

## Aspect Oriented Programming

**Intent:** Factor out cross-cutting concerns (logging, timing, retry, transactions) that would otherwise be scattered across every method, into reusable "aspects."

**Use when:** the same boilerplate wraps many methods. **Avoid when:** the indirection (proxies/weaving) makes control flow hard to follow.

**General example (C#)** — interception via a decorator/proxy:

```csharp
class LoggingProxy<T> : DispatchProxy {                 // wraps any interface T
    public T Target;
    protected override object Invoke(MethodInfo m, object[] args) {
        Console.WriteLine($"-> {m.Name}");
        var result = m.Invoke(Target, args);
        Console.WriteLine($"<- {m.Name}");
        return result;
    }
}
```

**Unity example:** AOP is rare in hot Unity code (reflection cost, IL2CPP limits), but shows up as method-timing/profiler-scope wrappers or source-generated logging around service calls. Closest everyday Unity tool: `using (new ProfilerMarker(...).Auto())` as a manual cross-cutting "aspect."

# Data & persistence

## Property Bag pattern

**Intent:** Store data as a dynamic, open-ended set of key/value pairs instead of typed fields.

**Use when:** schema is genuinely unknown/extensible (plugin metadata, blackboards). **Avoid when:** the fields are known — it throws away type safety and becomes the god-object smell.

**General example (C#)**:

```csharp
class Blackboard {
    private readonly Dictionary<string, object> _data = new();
    public void Set<T>(string k, T v) => _data[k] = v;
    public T Get<T>(string k) => (T)_data[k];
}
```

**Unity example:** an AI behavior-tree blackboard is a legitimate property bag. The *anti-pattern* version is a `ScriptableObject` that accretes `playerOneDevice`, `selectedSong`, `developerMode`… as loose fields — see [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Anti-pattern - one global session object (god object)|the god-object note]].

## Repository pattern

**Intent:** Mediate between domain and data source via a collection-like interface (`Get`, `Add`, `Find`), hiding the storage details.

**Use when:** you want domain code free of query/persistence specifics and swappable storage. **Avoid when:** it's a thin pass-through over an ORM that's already a repository.

**General example (C#)**:

```csharp
interface IUserRepository { User? GetById(Guid id); void Add(User u); }
class SqlUserRepository : IUserRepository {
    public User? GetById(Guid id) {/* SQL */ return null; }
    public void Add(User u) {/* SQL */}
}
```

**Unity example:** `CharacterDatabase.GetCharacterByName(name)` is a repository over authored `CharacterDataSO` assets; the runtime list can be sourced from Addressables without consumers knowing. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 2 - Database or registry asset|SO Pattern 2]].

## Unit of Work pattern

**Intent:** Track a set of changes and commit (or roll back) them as one atomic transaction.

**Use when:** multiple writes must succeed or fail together. **Avoid when:** single-write operations — it's overhead.

**General example (C#)**:

```csharp
interface IUnitOfWork : IDisposable {
    IUserRepository Users { get; }
    void Commit();          // flush all tracked changes in one transaction
}
// using var uow = factory.Create(); uow.Users.Add(u); uow.Commit();
```

**Unity example:** on the Skillcade backend, recording a finished match (write result + update both players' ELO + append to history) as one unit of work so a partial failure can't leave ratings updated but the match unrecorded. Client-side, a save system batching multiple changed slots before one disk write.

## Active Record pattern

**Intent:** A domain object that also carries its own persistence methods (`user.Save()`, `User.Find(id)`) — data and DB access in one class.

**Use when:** simple CRUD apps where the table maps 1:1 to the object. **Avoid when:** rich domain logic — it couples business rules to the DB and fights testing (contrast [[#Repository pattern|Repository]]).

**General example (C#)**:

```csharp
class User {                          // row + persistence together
    public Guid Id; public string Name;
    public void Save() {/* INSERT/UPDATE this row */}
    public static User Find(Guid id) {/* SELECT */ return new User(); }
}
```

**Unity example:** mostly an anti-fit for games, but conceptually similar to a save-slot object that knows how to `Save()`/`Load()` itself via `PlayerPrefs`/JSON. Fine for a tiny prototype; for Athens, keep persistence in a separate save service instead.

## CQRS

**Intent:** Command Query Responsibility Segregation — separate the write model (commands that change state) from the read model (queries optimized for display).

**Use when:** read and write needs diverge sharply (high-read dashboards, complex write rules). **Avoid when:** simple CRUD — it doubles the model for no gain.

**General example (C#)**:

```csharp
// Writes: commands with handlers
record PlaceOrder(Guid Cart) ;            class PlaceOrderHandler { public void Handle(PlaceOrder c){/*...*/} }
// Reads: a separate, denormalized query model
record OrderSummaryDto(Guid Id, decimal Total);
interface IOrderQueries { OrderSummaryDto Get(Guid id); }
```

**Unity example:** Skillcade backend — *commands* (`SubmitMatchResult`) run authoritative validation/ELO math; *queries* (leaderboard, profile) hit a denormalized read store ([[#Materialized View pattern|materialized view]]) so the client's frequent reads never touch the write path. Often paired with [[#Event Sourcing]].

## Event Sourcing

**Intent:** Persist state as an append-only log of events; current state is a fold over the events. The log is the source of truth.

**Use when:** you need full audit/replay/temporal queries (finance, anti-cheat). **Avoid when:** you only need current state — it's heavy and schema-evolution is hard.

**General example (C#)**:

```csharp
abstract record AccountEvent;
record Deposited(decimal Amount) : AccountEvent;
record Withdrawn(decimal Amount) : AccountEvent;
decimal Balance(IEnumerable<AccountEvent> log) =>
    log.Aggregate(0m, (bal, e) => e switch { Deposited d => bal + d.Amount,
                                             Withdrawn w => bal - w.Amount, _ => bal });
```

**Unity example:** a deterministic fighting-game replay *is* event sourcing — store only the input stream per frame; "current state" is the result of replaying inputs through the deterministic sim. This is also how server-side verification re-derives the match (overlaps with [[#Memento pattern|Memento]] for periodic snapshots to speed replay).

## Materialized View pattern

**Intent:** Precompute and store the result of an expensive query/join so reads are cheap, refreshing it as the source changes.

**Use when:** the same costly read happens far more often than the data changes. **Avoid when:** data changes constantly and staleness is unacceptable.

**General example (SQL/pseudocode)**:

```sql
CREATE MATERIALIZED VIEW top_players AS
SELECT player_id, SUM(score) AS total FROM matches GROUP BY player_id ORDER BY total DESC;
-- read hits the view; REFRESH on a schedule or on write.
```

**Unity example:** the Skillcade leaderboard — instead of aggregating every match on each request, maintain a precomputed `top_players` table updated when a match result lands ([[#CQRS]] read side). The client reads a cheap, ready-made ranking.

# Messaging & data layout

## Event Bus pattern

**Intent:** A shared publish/subscribe channel where producers emit typed events and any subscriber reacts — decoupling senders from receivers ([[#Observer pattern|Observer]] + [[#Mediator pattern|Mediator]] at app scale).

**Use when:** many systems react to the same domain events. **Avoid when:** it becomes an untraceable global firehose; scope buses per session/match.

**General example (C#)**:

```csharp
class EventBus {
    private readonly Dictionary<Type, List<Delegate>> _subs = new();
    public void Subscribe<T>(Action<T> h) => (_subs[typeof(T)] = _subs.GetValueOrDefault(typeof(T)) ?? new()).Add(h);
    public void Publish<T>(T evt) { if (_subs.TryGetValue(typeof(T), out var l)) foreach (Action<T> h in l) h(evt); }
}
```

**Unity example:** `GameEventBus` registered DI-scoped per match (`Lifetime.Scoped`) so subscribers reset between matches — better for authoritative/network flow than a global `ScriptableObject` event. For presentation-only signals, SO event channels are fine. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#DI event bus vs ScriptableObject event assets|the DI-bus-vs-SO comparison]].

## Entity Component System

**Intent:** Compose entities from plain-data components, with systems running logic over all entities that have a given component set — data and behavior fully separated.

**Use when:** large entity counts needing cache-friendly, parallelizable updates. **Avoid when:** small object counts where OOP is simpler to author. Built on [[#Data Oriented Design]].

**General example (pseudocode)**:

```text
Components: Position{x,y}, Velocity{dx,dy}     // pure data, no methods
System MovementSystem:
    for each entity with (Position, Velocity):  // iterates packed arrays
        position += velocity * dt
```

**Unity example:** Unity DOTS (Entities package) — `IComponentData` structs in chunked arrays, `ISystem`/`SystemBase` with Burst-compiled jobs. Used for massive crowds/bullets where `MonoBehaviour` overhead is too high; deterministic layout also helps rollback.

## Data Oriented Design

**Intent:** Organize code around how data is laid out and accessed in memory (contiguous, struct-of-arrays) to maximize cache hits and SIMD — the mindset under [[#Entity Component System|ECS]].

**Use when:** performance-critical, high-volume processing. **Avoid when:** clarity matters more than throughput.

**General example (C++)** — struct-of-arrays beats array-of-structs for a hot loop:

```cpp
// AoS: cache-unfriendly when you only touch x.   struct P{float x,y,z;}; P ps[N];
// SoA: x's are contiguous -> cache + SIMD friendly.
struct Particles { float x[N], y[N], z[N]; };
for (int i=0;i<N;++i) p.x[i] += vx[i]*dt;       // streams through memory
```

**Unity example:** the editor-list → compiled-runtime split — `ProjectileLibrary` authors a friendly list, then `Initialize()` builds tight runtime structures/dictionaries (and [[#Flyweight pattern|Flyweight]] shared defs) for the hot path. Full DOD is Burst/DOTS jobs over packed arrays. See [[Unity ScriptableObjects - Modern Usage and Singleton-Like Managers#Pattern 3 - Editor-friendly data, runtime-friendly compiled data|SO Pattern 3]].

# Application architecture

## Model View Controller

**Intent:** Split a UI app into Model (state/rules), View (presentation), and Controller (input → model updates), so each varies independently.

**Use when:** interactive apps with distinct data, display, and input concerns. **Avoid when:** trivial UIs — the ceremony outweighs the benefit. (MVVM/MVP are close cousins.)

**General example (TypeScript)**:

```ts
class CounterModel { count = 0; inc() { this.count++; } }            // state + rules
class CounterView { render(n: number) { document.title = `${n}`; } } // presentation
class CounterController {                                            // wires input -> model -> view
  constructor(private m: CounterModel, private v: CounterView) {}
  onClick() { this.m.inc(); this.v.render(this.m.count); }
}
```

**Unity example:** UI Toolkit screens often use MVP/MVVM — a `MatchModel` (scores, timer), a `UIDocument` view bound via data binding, and a presenter that listens to the [[#Event Bus pattern|event bus]] and pushes updates. Keeps `MonoBehaviour` view code free of game rules.

## Hexagonal Architecture

**Intent:** "Ports & Adapters" — domain logic sits in the center behind interfaces (ports); external concerns (DB, UI, engine) are adapters plugged into those ports. The domain depends on nothing outward.

**Use when:** you want engine/framework-agnostic, testable core logic. **Avoid when:** a small app where the indirection is pure overhead.

**General example (C#)**:

```csharp
// Port (owned by the domain)
interface IMatchRepository { void Save(MatchResult r); }
// Domain depends only on the port
class ScoringService { public ScoringService(IMatchRepository repo) {/*...*/} }
// Adapter (outside) implements the port: SqlMatchRepository, InMemoryMatchRepository (tests)
```

**Unity example:** keep the deterministic fight sim as plain C# depending on ports (`IInputSource`, `IClock`), with Unity-specific adapters (`UnityInputAdapter`, `UnityTimeAdapter`) on the outside. The sim then runs headless on the server and under unit tests without Unity.

## Clean Architecture

**Intent:** Concentric layers (Entities → Use Cases → Interface Adapters → Frameworks) with the **dependency rule**: source dependencies point only inward. A specific arrangement of [[#Hexagonal Architecture|Hexagonal]] + [[#Dependency Inversion Principle|DIP]].

**Use when:** long-lived apps where business rules must outlive frameworks. **Avoid when:** prototypes/jam games — the layering slows iteration.

**General example (C#)** — a use case depends on abstractions, not Unity/DB:

```csharp
class StartMatchUseCase {                  // application layer
    private readonly IMatchRepository _repo;     // boundary interface (points inward)
    public StartMatchUseCase(IMatchRepository repo) => _repo = repo;
    public MatchResult Execute(MatchRequest req) {/* pure rules */ return new(); }
}
```

**Unity example:** Athens' authoritative logic as inner use cases (no `UnityEngine` reference), with Unity scenes/`MonoBehaviour`s as the outer "frameworks" ring calling in. The dependency rule is what lets the same rules run on a dedicated server build.

## Microservices Architecture

**Intent:** Build a system as small, independently deployable services owning their own data, communicating over the network.

**Use when:** large teams/domains needing independent scaling & deploy. **Avoid when:** a startup/solo project — a modular monolith is usually right; microservices add huge ops cost.

**General example (pseudocode)**:


```text 
auth-service     (owns users db)      ─┐
matchmaking-svc  (owns queue)          ├─ talk via HTTP/gRPC/queues, no shared DB
leaderboard-svc  (owns rankings db)   ─┘
```

**Unity example:** the Skillcade *backend* (not the client) — separate auth, matchmaking, leaderboard, and replay-verification services. The Unity client talks to them through a single [[#Gateway pattern|gateway]]/[[#Backend for Frontend pattern|BFF]]. Distributed patterns below (Saga, Circuit Breaker, etc.) exist to make this survivable.

## Anti Corruption Layer pattern

**Intent:** A translation layer between your model and an external/legacy system, so their concepts don't leak into and corrupt yours.

**Use when:** integrating a messy third-party or legacy API. **Avoid when:** the external model is already clean and stable.

**General example (C#)** — translate vendor types at the boundary:

```csharp
class PaymentAcl {                       // our domain never sees Stripe types
    private readonly StripeClient _stripe;
    public PaymentResult Charge(Money m) {
        var resp = _stripe.Charges.Create(/* vendor shape */);
        return new PaymentResult(resp.Id, resp.Status == "succeeded");   // mapped to our model
    }
}
```

**Unity example:** a layer wrapping the Skillcade SDK (or a platform's matchmaking API) so its DTOs, error codes, and quirks are mapped into Athens' own `MatchResult`/`PlayerId` types. A whole boundary of [[#Adapter pattern|Adapters]] working together.

## Backend for Frontend pattern

**Intent:** A dedicated backend per frontend/client type, shaping responses to exactly that client's needs instead of one generic API for all.

**Use when:** clients differ a lot (mobile vs desktop vs console). **Avoid when:** one API shape serves everyone — a BFF is then redundant.

**General example (TypeScript)**:

```ts
// mobile-bff: trims payloads + bundles calls for a bandwidth-limited client
app.get('/home', async (req, res) => {
  const [user, matches] = await Promise.all([userSvc.get(req.uid), matchSvc.recent(req.uid, 5)]);
  res.json({ name: user.name, recent: matches.map(m => m.id) });   // minimal, client-shaped
});
```

**Unity example:** a Unity-client BFF that bundles "home screen" data (profile + recent matches + featured event) into one call and strips fields the game doesn't render — saving round-trips on console/mobile. Sits in front of the [[#Microservices Architecture|microservices]].

## Strangler Fig pattern

**Intent:** Incrementally replace a legacy system by routing slices of functionality to the new one until the old is "strangled" and removed — no big-bang rewrite.

**Use when:** migrating a risky monolith/legacy module gradually. **Avoid when:** the system is small enough to replace outright.

**General example (pseudocode)** — a facade routes old vs new:

```text
client -> router/facade
            ├── /profile   -> NEW service
            └── /matches   -> OLD monolith   (migrate, then flip the route)
```

**Unity example:** migrating Athens' old `GlobalSessionObject` god-asset to the split design — introduce `GameSessionManager`/`CharacterDatabase` and move responsibilities one at a time, leaving the old asset in place until each feature is rerouted, then delete it. (Architectural sibling of [[#Adapter pattern|Adapter]] at the seam.)

## Gateway pattern

**Intent:** A single entry point that fronts many backend services, handling routing, auth, rate-limiting, and aggregation (API Gateway).

**Use when:** clients shouldn't know the service topology. **Avoid when:** one service — direct calls suffice.

**General example (pseudocode)**:

```text
client -> API Gateway  ─ auth + rate-limit + route ─┬─> matchmaking-svc
                                                    ├─> leaderboard-svc
                                                    └─> auth-svc
```

**Unity example:** the Unity client hits one Skillcade gateway URL with its token; the gateway authenticates, throttles ([[#Throttling pattern|Throttling]]), and routes to the right [[#Microservices Architecture|microservice]]. The client never holds per-service addresses. Compare [[#Backend for Frontend pattern|BFF]] (client-shaped) vs Gateway (generic edge).

## API Composition pattern

**Intent:** Fulfill a query that spans multiple services by calling each and joining the results in one place (an in-process join across services).

**Use when:** a read needs data owned by several services and you have no shared DB. **Avoid when:** the join is huge/hot — precompute a [[#Materialized View pattern|materialized view]] via [[#CQRS]] instead.

**General example (TypeScript)**:

```ts
async function matchDetails(id: string) {
  const [match, p1, p2] = await Promise.all([        // fan-out
    matchSvc.get(id), playerSvc.get(...), playerSvc.get(...),
  ]);
  return { ...match, players: [p1, p2] };            // compose
}
```

**Unity example:** a post-match screen needing the match record (match-svc) + both players' profiles (profile-svc) + new rankings (leaderboard-svc), composed by the [[#Backend for Frontend pattern|BFF]] into one response. Mechanically a [[#Scatter Gather pattern|Scatter-Gather]].

# Distributed systems & resilience

> [!note] Where these live in a game
> These are mostly **backend/netcode** patterns (Skillcade services, dedicated servers, matchmaking), not Unity client scripts. The Unity examples show the realistic place each shows up in a live-service game.

## Saga pattern

**Intent:** Coordinate a multi-step transaction across services *without* a distributed lock, by chaining local transactions and issuing compensating actions if a later step fails.

**Use when:** a workflow spans services that each own their data ([[#Microservices Architecture|microservices]]). **Avoid when:** one DB transaction can cover it (use that), or for [[#Two Phase Commit pattern|2PC]] when you truly need atomicity.

**General example (pseudocode)** — orchestrated saga with compensation:

```text
reserveSeat()      ─ok→ chargeCard()  ─FAIL→ compensate: releaseSeat()
chargeCard()       ─ok→ confirmTicket()
each step has an undo; failure triggers undos in reverse
```

**Unity example:** ranked-match settlement — debit entry fee, update both ELOs, grant rewards. If reward-granting fails, compensating steps refund the fee and revert ELO, so no player is half-charged. Runs on the Skillcade backend, not the client.

## Circuit Breaker pattern

**Intent:** Stop calling a failing dependency after a threshold (open the circuit), fail fast for a cooldown, then probe (half-open) before resuming — preventing cascading failures and pile-ups.

**Use when:** network calls to a flaky service. **Avoid when:** purely local in-process calls.

**General example (C#)** — sketch:

```csharp
class CircuitBreaker {
    int _fails; DateTime _openUntil;
    public T Call<T>(Func<T> op) {
        if (DateTime.UtcNow < _openUntil) throw new CircuitOpenException();   // fail fast
        try { var r = op(); _fails = 0; return r; }
        catch { if (++_fails >= 5) _openUntil = DateTime.UtcNow.AddSeconds(30); throw; }
    }
}
```

**Unity example:** wrap the leaderboard/telemetry HTTP client (`UnityWebRequest`) in a breaker so that when the backend is down, the game shows cached scores instantly instead of every request stalling for the full [[#Timeout pattern|timeout]]. Pairs with [[#Retry pattern|Retry]] and a [[#Null Object pattern|null]] fallback.

## Bulkhead pattern

**Intent:** Isolate resources into pools so a failure/overload in one area can't sink the whole system (named after a ship's watertight compartments).

**Use when:** one slow dependency can exhaust a shared thread/connection pool. **Avoid when:** a single workload — partitioning just wastes capacity.

**General example (C#)** — separate concurrency budgets:

```csharp
var leaderboardPool = new SemaphoreSlim(4);   // at most 4 concurrent leaderboard calls
var chatPool        = new SemaphoreSlim(8);   // chat slowness can't starve leaderboard
```

**Unity example:** on a dedicated server hosting many matches, give each match (or each external dependency) its own worker/connection budget so one wedged match or a slow analytics endpoint can't freeze the others.

## Retry pattern

**Intent:** Re-attempt a transient failure, ideally with exponential backoff + jitter.

**Use when:** failures are transient (blips, throttling). **Avoid when:** the error is permanent (400/validation) — retrying just amplifies load. Always cap attempts and pair with [[#Timeout pattern|Timeout]].

**General example (C#)**:

```csharp
async Task<T> Retry<T>(Func<Task<T>> op, int max = 3) {
    for (int i = 0; ; i++) {
        try { return await op(); }
        catch when (i < max) { await Task.Delay((int)(Math.Pow(2, i) * 100 + Random.Shared.Next(100))); }
    }
}
```

**Unity example:** retrying a match-result submission a few times with backoff before surfacing an error, so a one-off packet drop doesn't cost the player their ranked result. Wrap inside a [[#Circuit Breaker pattern|Circuit Breaker]] so retries stop when the service is truly down.

## Timeout pattern

**Intent:** Bound how long you wait for an operation, then abandon it — so a hung dependency doesn't hang the caller forever.

**Use when:** any I/O / network call. **Avoid when:** never, really — unbounded waits are a reliability bug.

**General example (C#)** — cancel after a deadline:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
var result = await httpClient.GetAsync(url, cts.Token);   // throws if it exceeds 5s
```

**Unity example:** every `UnityWebRequest` should set `.timeout`, and Addressables loads should be raced against a `CancellationToken` (as `AppRuntime.InitializeAsync` does) so a stalled CDN doesn't freeze the loading screen indefinitely.

## Throttling pattern

**Intent:** Cap the rate of operations to protect a resource (rate limiting / debounce).

**Use when:** bursty callers could overwhelm a service or you must respect quotas. **Avoid when:** load is naturally low.

**General example (C#)** — simple debounce of rapid calls:

```csharp
DateTime _last;
bool Allow(TimeSpan minGap) {
    if (DateTime.UtcNow - _last < minGap) return false;
    _last = DateTime.UtcNow; return true;
}
```

**Unity example:** client-side, debounce a "search match" button so mashing it doesn't spam matchmaking; server-side, rate-limit per-account API calls at the [[#Gateway pattern|gateway]] to blunt abuse. Distinct from [[#Bulkhead pattern|Bulkhead]] (isolation) — throttling limits *rate*.

## Sidecar pattern

**Intent:** Deploy a helper process alongside a service (same host/pod) to handle cross-cutting concerns (logging, proxying, metrics) out-of-process.

**Use when:** you want language-agnostic platform features without baking them into each service. **Avoid when:** a library in-process is simpler and the ops overhead isn't justified.

**General example (pseudocode)**:

```text
[ game-server container ] ── localhost ──> [ sidecar container ]
                                            (metrics, TLS, service-mesh proxy)
```

**Unity example:** a dedicated `GameServer` pod with an Envoy/Agones sidecar handling health checks, mTLS, and metrics, so the C# server build stays focused on simulating matches. (The [[#Ambassador pattern|Ambassador]] is a sidecar specialized for outbound network calls.)

## Ambassador pattern

**Intent:** A sidecar that proxies and manages *outbound* network calls for a service (adds retries, TLS, circuit breaking, routing) so the service makes a simple local call.

**Use when:** you want consistent client-side networking policy across many services/languages. **Avoid when:** a resilience library in-process already covers it.

**General example (pseudocode)**:

```text
service ── localhost:9000 ──> [ ambassador ] ── retries+TLS+breaker ──> remote API
```

**Unity example:** the dedicated server calls `localhost` for "submit telemetry," and an ambassador process applies [[#Retry pattern|Retry]] + [[#Circuit Breaker pattern|Circuit Breaker]] + auth to the real analytics endpoint — keeping that policy out of the game server code and uniform across services.

## Scatter Gather pattern

**Intent:** Fan a request out to many workers in parallel, then aggregate their responses into one result.

**Use when:** a task parallelizes across nodes/shards (search, price comparison). **Avoid when:** a single source has the answer.

**General example (C#)**:

```csharp
var tasks = providers.Select(p => p.GetQuoteAsync(req));   // scatter
var quotes = await Task.WhenAll(tasks);                    // gather
var best = quotes.Min(q => q.Price);
```

**Unity example:** querying several regional matchmaking [[#Sharding pattern|shards]] at once for the lowest-latency available opponent, then picking the best — or the [[#API Composition pattern|API-composition]] post-match screen fanning out to several services. 

## Leader Election pattern

**Intent:** Have a cluster of equal nodes agree on one "leader" to coordinate work, with automatic failover if the leader dies.

**Use when:** exactly one node must own a task (scheduler, authority) but you need HA. **Avoid when:** a single managed instance is acceptable.

**General example (pseudocode)** — lease-based election:

```text
each node tries to acquire a shared lock/lease key (etcd/Redis/ZK)
winner = leader; renews the lease as a heartbeat
if lease expires (leader died) -> remaining nodes re-elect
```

**Unity example:** among redundant authoritative game-server instances for one tournament bracket, elect a single coordinator that owns advancing rounds and writing results; if it crashes, another takes over. Built on the [[#Lease pattern|Lease]].

## Lease pattern

**Intent:** Grant time-bounded ownership of a resource; the holder must renew (heartbeat) or the lease expires and others may claim it — avoids permanent locks held by dead clients.

**Use when:** distributed locks, leader election, session ownership. **Avoid when:** in-process locking suffices.

**General example (pseudocode)**:

```text
acquire(key, ttl=10s) -> token
every 5s: renew(key, token)        // heartbeat
on crash: no renew -> lease expires -> resource freed
```

**Unity example:** a player's matchmaking "ticket" or an authoritative match's ownership held as a lease, so if the owning server dies mid-renewal the match is reclaimed/cleaned up instead of hanging forever. Underpins [[#Leader Election pattern|Leader Election]].

## Two Phase Commit pattern

**Intent:** Atomic commit across multiple resources via a coordinator: phase 1 *prepare* (everyone votes), phase 2 *commit/abort* (only if all voted yes). Strong consistency, but blocking.

**Use when:** you truly need all-or-nothing across resources and can tolerate blocking. **Avoid when:** availability matters more — prefer a [[#Saga pattern|Saga]] (eventual consistency). 2PC blocks if the coordinator fails mid-phase.

**General example (pseudocode)**:

```text
coordinator -> all: PREPARE
  if every participant replies YES -> coordinator -> all: COMMIT
  if any NO / timeout            -> coordinator -> all: ABORT
```

**Unity example:** rarely used in games (too blocking for real-time), but conceptually: committing a cross-region account transfer of premium currency where partial application is unacceptable. In practice a [[#Saga pattern|Saga]] with compensation is preferred for game backends.

## Three Phase Commit pattern

**Intent:** 2PC plus an extra *pre-commit* phase and timeouts, so participants can reach a decision even if the coordinator crashes — non-blocking under most failures (at the cost of more messages, and it still fails under network partitions).

**Use when:** you need 2PC-style atomicity but can't tolerate its blocking. **Avoid when:** the extra round-trips/complexity aren't justified — most systems pick a [[#Saga pattern|Saga]] or consensus (Raft/Paxos) instead.

**General example (pseudocode)**:

```text
phase 1: CAN-COMMIT?  (votes)
phase 2: PRE-COMMIT   (everyone acks readiness; can recover if coordinator dies)
phase 3: DO-COMMIT
```

**Unity example:** essentially never appears in client/game code; included for completeness. If a game backend needs strong distributed agreement, it reaches for a consensus library (Raft) rather than hand-rolled 3PC.

## Sharding pattern

**Intent:** Partition data/load across multiple stores ("shards") by a key, so each holds a subset — horizontal scaling beyond one node's capacity.

**Use when:** data/throughput exceeds a single DB/server. **Avoid when:** one node fits — sharding adds cross-shard query and rebalancing pain.

**General example (pseudocode)**:

```text
shard = hash(playerId) % SHARD_COUNT
write/read player record -> shards[shard]
cross-shard queries need scatter-gather + merge
```

**Unity example:** regional game-server/matchmaking shards (NA / EU / Asia) partitioning players by region for latency and scale; leaderboards sharded by season. Cross-shard "global top 100" needs [[#Scatter Gather pattern|Scatter-Gather]] + merge.

---

> [!quote] One-line recall
> Patterns are vocabulary, not law. Reach for one when it names a problem you already have — not to justify abstraction you don't yet need. When in doubt, the simplest thing that satisfies [[#SOLID principles|SOLID]] wins.


```csharp {refactor}
	// @before
	public void foo(int i){
		Debug.Log(i+2);
	}
	// @after
		public void foo2(int i){
		Debug.Log(i+3);
	}
	
	
	
```