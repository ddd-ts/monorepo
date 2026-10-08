# Literal

A constant string or number value.

## Import

```ts
import { Literal } from "@ddd-ts/shape";
```

## Usage

```ts
class Version extends Literal("v1") {}

const v = new Version("v1");
v.value;       // "v1"
v.serialize(); // "v1"

const restored = Version.deserialize("v1");
```

## Shorthand

String and number literals can be used directly inside `Dict`:

```ts
class Event extends Dict({
  type: "user_created",  // shorthand for Literal("user_created")
  version: 1,            // shorthand for Literal(1)
  userId: String,
}) {}
```

This is particularly useful for discriminated unions where each variant has a literal type tag.

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | the literal type | The constant value |
| `serialize()` | returns the literal | Always returns the constant |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from value |
| `$serialize(value)` | returns the literal | Identity |
| `$deserialize(value)` | returns the literal | Identity |
| `$shape` | `"literal"` | Shape discriminator |
| `value` | the literal type | Static access to the constant |
