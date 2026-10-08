# @ddd-ts/shape

This package provides type-safe, serializable data shapes for TypeScript.

## Documentation

When working with shapes, consult the skill files in `.skills/`:

- `.skills/shape.md` — overview of what shapes are, why they exist, and an index of all shape types
- `.skills/primitive.md` — `Primitive(String)`, `Primitive(Number)`, `Primitive(Boolean)`, `Primitive(Date)`
- `.skills/dict.md` — `Dict({ field: Type })` structured objects
- `.skills/literal.md` — `Literal("value")` constant values
- `.skills/nothing.md` — `Nothing()` empty/marker shapes
- `.skills/multiple.md` — `Multiple(Type)` typed arrays
- `.skills/optional.md` — `Optional(Type)` nullable values with `.match()`
- `.skills/choice.md` — `Choice(["a", "b"])` enum-like string sets
- `.skills/either.md` — `Either({ A, B })` tagged unions with `_key`
- `.skills/discriminated-union.md` — `DiscriminatedUnion([A, B])` auto-discriminated unions
- `.skills/mapping.md` — `Mapping([KeyType, ValueType])` records
- `.skills/class.md` — `Class(ExistingClass)` adapter for pre-existing classes

Read the relevant skill file before modifying or extending a shape type.
