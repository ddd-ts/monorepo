# Either

A tagged union of named class variants. The value is an instance of one of the variant classes. Serializes with a `_key` field to identify the variant.

## Import

```ts
import { Either } from "@ddd-ts/shape";
```

## Usage

```ts
class Success extends Dict({ message: String }) {}
class Failure extends Dict({ code: Number, reason: String }) {}

class Result extends Either({ Success, Failure }) {}

// Construct with an instance of one variant
const ok = new Result(new Success({ message: "done" }));
const err = new Result(new Failure({ code: 404, reason: "Not found" }));

ok.value;  // Success instance
err.value; // Failure instance
```

## Serialization

The serialized form includes a `_key` field with the variant name:

```ts
ok.serialize();  // { _key: "Success", message: "done" }
err.serialize(); // { _key: "Failure", code: 404, reason: "Not found" }
```

## Deserialization

```ts
const restored = Result.deserialize({ _key: "Success", message: "done" });
restored.value instanceof Success; // true
```

## Pattern matching

Exhaustive:

```ts
ok.match({
  Success: (s) => s.message,
  Failure: (f) => f.reason,
}); // "done"
```

Partial with fallback:

```ts
ok.match(
  { Failure: (f) => f.reason },
  () => "ok",
); // "ok"
```

Fallthrough:

```ts
ok.match({
  _: (value) => "something",
}); // "something"
```

## Inline in Dict

```ts
class Order extends Dict({
  id: String,
  payment: Either({ Card, Cash, Transfer }),
}) {}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | union of variant instances | The wrapped variant |
| `serialize()` | `{ _key, ...serialized }` | Serialize with discriminator |
| `match(matcher, fallback?)` | return type of handlers | Branch on variant |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from `{ _key, ... }` |
| `$serialize(value)` | serialized with `_key` | Transform without allocating |
| `$deserialize(value)` | variant instance | Transform without allocating |
| `$shape` | `"either"` | Shape discriminator |
