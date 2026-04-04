# DiscriminatedUnion

A union of shapes sharing a common discriminator field. The discriminator key is detected automatically from the shapes' structure.

## Import

```ts
import { DiscriminatedUnion } from "@ddd-ts/shape";
```

## Usage

```ts
class Created extends Dict({ type: "created", name: String }) {}
class Deleted extends Dict({ type: "deleted", id: Number }) {}

class Event extends DiscriminatedUnion([Created, Deleted]) {}
```

The discriminator key (`type` here) is found automatically — it must be a field present in all variants with distinct literal values.

## Construct

```ts
// With a named class instance
const evt = new Event(new Created({ type: "created", name: "Alice" }));

// With a plain object matching one variant
const evt2 = new Event({ type: "deleted", id: 42 });
```

## Serialization

```ts
evt.serialize(); // { type: "created", name: "Alice" }
```

Unlike `Either`, there is no extra `_key` — the discriminator is part of the data itself.

## Deserialization

```ts
const restored = Event.deserialize({ type: "deleted", id: 42 });
restored instanceof Event; // true
```

## Pattern matching

```ts
evt.match({
  created: (e) => e.name,
  deleted: (e) => e.id,
});

// Fallthrough
evt.match({
  _: (e) => "any event",
});

// Partial with fallback
evt.match(
  { created: (e) => e.name },
  (e) => "other",
);
```

## Mixing classes and shorthands

You can combine named classes with anonymous dict shorthands:

```ts
class Created extends Dict({ type: "created", name: String }) {}

class Event extends DiscriminatedUnion([
  Created,
  { type: "deleted" as const, id: Number },
  { type: "updated" as const, fields: [String] },
]) {}
```

Note: when using inline objects, you must use `as const` on the discriminator literal.

## Inline in Dict

```ts
class Aggregate extends Dict({
  id: String,
  lastEvent: DiscriminatedUnion([Created, Updated, Deleted]),
}) {}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | union of variant types | The wrapped variant |
| `serialize()` | serialized variant | Serialize the variant |
| `match(matcher, fallback?)` | return type of handlers | Branch on discriminator |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from serialized variant |
| `$serialize(value)` | serialized variant | Transform without allocating |
| `$deserialize(value)` | inline variant | Transform without allocating |
| `$shape` | `"discriminated-union"` | Shape discriminator |
| `$of` | the config array | The original variant list |
