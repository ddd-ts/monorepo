# Dict

A structured object with named, typed fields. Fields are accessed directly on the instance (not under `.value`).

## Import

```ts
import { Dict } from "@ddd-ts/shape";
```

## Usage

```ts
class Address extends Dict({
  street: String,
  city: String,
  zip: Number,
}) {}

const addr = new Address({ street: "123 Main", city: "Paris", zip: 75001 });
addr.street; // "123 Main"
addr.city;   // "Paris"
addr.serialize(); // { street: "123 Main", city: "Paris", zip: 75001 }

const restored = Address.deserialize({ street: "123 Main", city: "Paris", zip: 75001 });
restored instanceof Address; // true
```

## Nesting

Dicts can reference other shape classes:

```ts
class User extends Dict({
  name: String,
  address: Address,
}) {}

// Constructor expects an instance for named shapes
const user = new User({ name: "Alice", address: new Address({ street: "123 Main", city: "Paris", zip: 75001 }) });

// Deserialize accepts plain objects and reconstructs instances
const restored = User.deserialize({ name: "Alice", address: { street: "123 Main", city: "Paris", zip: 75001 } });
restored.address instanceof Address; // true
```

Inline anonymous dicts are also supported:

```ts
class User extends Dict({
  name: String,
  address: { street: String, city: String },
}) {}
```

## Shorthand resolution

Inside a `Dict`, fields accept any shape shorthand:

| Shorthand | Resolves to |
|-----------|-------------|
| `String`, `Number`, `Boolean`, `Date` | `Primitive(...)` |
| `"literal"`, `42` | `Literal(...)` |
| `undefined` | `Nothing()` |
| `[String]` | `Multiple(String)` |
| `{ key: String }` | `Dict({ key: String })` |
| `SomeClass` (with serialize/deserialize) | `Class(SomeClass)` |

## Adding behavior

```ts
class Range extends Dict({ min: Number, max: Number }) {
  get span() {
    return this.max - this.min;
  }

  contains(value: number) {
    return value >= this.min && value <= this.max;
  }
}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `[field]` | per-field type | Direct field access |
| `serialize()` | returns plain object | Recursively serialize all fields |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from plain object |
| `$serialize(value)` | returns plain object | Transform without allocating |
| `$deserialize(value)` | returns inline object | Transform without allocating |
| `$shape` | `"dict"` | Shape discriminator |
| `$of` | the shape definition | The original field configuration |
