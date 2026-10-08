# Primitive

Wraps a single primitive value: `String`, `Number`, `Boolean`, or `Date`.

## Import

```ts
import { Primitive } from "@ddd-ts/shape";
```

## Usage

```ts
class UserId extends Primitive(String) {}

const id = new UserId("usr_123");
id.value;        // "usr_123"
id.serialize();  // "usr_123"

const restored = UserId.deserialize("usr_123");
restored.value;  // "usr_123"
```

## Date coercion

Date primitives are automatically coerced from strings during deserialization:

```ts
class CreatedAt extends Primitive(Date) {}

const date = CreatedAt.deserialize("2024-01-01T00:00:00Z");
date.value; // Date instance
```

## Shorthand

Inside a `Dict`, primitive constructors can be used directly:

```ts
class User extends Dict({
  name: String,    // shorthand for Primitive(String)
  age: Number,     // shorthand for Primitive(Number)
  active: Boolean, // shorthand for Primitive(Boolean)
  born: Date,      // shorthand for Primitive(Date)
}) {}
```

## Adding behavior

```ts
class Temperature extends Primitive(Number) {
  toFahrenheit() {
    return this.value * 9 / 5 + 32;
  }
}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | `string \| number \| boolean \| Date` | The wrapped value |
| `serialize()` | returns the raw value | Serialize to plain form |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from serialized |
| `$serialize(value)` | returns raw value | Transform without allocating |
| `$deserialize(value)` | returns raw value | Transform without allocating |
| `$shape` | `"primitive"` | Shape discriminator |
