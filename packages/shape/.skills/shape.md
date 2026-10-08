# @ddd-ts/shape

Shapes are type-safe, serializable data definitions for TypeScript. They let you define a model once and get automatic `serialize()`, `deserialize()`, and full type inference. Every shape is a class you extend, so you can add behavior directly.

Shapes exist to solve the impedance mismatch between rich domain objects and their serialized representations (JSON, database rows, messages). Instead of writing manual mapping code, you declare the structure and shape handles the rest — with full TypeScript types at every boundary.

## Core contract

Every shape class provides:
- **Constructor** — create an instance from typed runtime values
- **`instance.serialize()`** — convert to a plain, JSON-safe representation
- **`Class.deserialize(data)`** — reconstruct a typed instance from serialized data
- **`Class.$serialize(value)`** / **`Class.$deserialize(value)`** — static transforms without instance allocation

## Shape types

- **[Primitive](primitive.md)** — a single `String`, `Number`, `Boolean`, or `Date` value
- **[Dict](dict.md)** — a structured object with named, typed fields
- **[Literal](literal.md)** — a constant string or number
- **[Nothing](nothing.md)** — no data (marker type / empty payload)
- **[Multiple](multiple.md)** — a typed array of elements
- **[Optional](optional.md)** — a value that can be `T | undefined`, with `.match()` for safe access
- **[Choice](choice.md)** — one value from a fixed set of strings, with `.is()` and `.match()`
- **[Either](either.md)** — a tagged union of named class variants, discriminated by `_key`
- **[DiscriminatedUnion](discriminated-union.md)** — a union of shapes sharing a common field, auto-detected discriminator
- **[Mapping](mapping.md)** — a key-value record (`Record<K, V>`)
- **[Class](class.md)** — wraps an existing class that already has `serialize()`/`deserialize()`

## Composition

Any shape can be used inside another. Named classes used as fields in a `Dict` are automatically serialized/deserialized recursively. Shorthand syntax (`String`, `[String]`, `undefined`, `"literal"`) is resolved by the `Shape()` function into full definitions.

## Adding behavior

Since shapes are classes, add methods and properties directly:

```ts
class Email extends Primitive(String) {
  get domain() {
    return this.value.split("@")[1];
  }
}
```
