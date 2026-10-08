# Multiple

A typed array of elements. Exposes standard array methods directly on the instance.

## Import

```ts
import { Multiple } from "@ddd-ts/shape";
```

## Usage

```ts
class Tags extends Multiple(String) {}

const tags = new Tags(["typescript", "ddd"]);
tags.value;       // ["typescript", "ddd"]
tags.serialize();  // ["typescript", "ddd"]
tags.length;       // 2
```

## Array methods

Array methods are available directly on the instance (not just on `.value`):

```ts
tags.map((t) => t.toUpperCase());     // ["TYPESCRIPT", "DDD"]
tags.filter((t) => t.startsWith("t")); // ["typescript"]
tags.includes("ddd");                  // true
tags.find((t) => t === "ddd");         // "ddd"
tags.some((t) => t.length > 3);        // true
tags.every((t) => t.length > 0);       // true
tags.reduce((a, b) => a + ", " + b);   // "typescript, ddd"

for (const tag of tags) {
  console.log(tag); // iterable
}
```

Full list of delegated methods: `map`, `filter`, `reduce`, `forEach`, `some`, `every`, `find`, `findIndex`, `indexOf`, `lastIndexOf`, `includes`, `keys`, `values`, `entries`, `at`, `concat`, `flat`, `flatMap`, `splice`, `push`, `pop`, `sort`, `slice`, `fill`, `copyWithin`, `reverse`, `shift`, `unshift`, `length`, `[Symbol.iterator]`.

## Shorthand

Bracket syntax inside `Dict`:

```ts
class User extends Dict({
  tags: [String],                  // shorthand for Multiple(String)
  scores: [Number],                // shorthand for Multiple(Number)
  addresses: [{ city: String }],   // array of anonymous dicts
}) {}
```

## Nesting with named shapes

```ts
class Score extends Primitive(Number) {}
class Scores extends Multiple(Score) {}

const scores = new Scores([new Score(10), new Score(20)]);
scores.serialize(); // [10, 20]

const restored = Scores.deserialize([10, 20]);
restored.value[0] instanceof Score; // true
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | `T[]` | The underlying array |
| `serialize()` | serialized array | Recursively serialize elements |
| `length` | `number` | Array length |
| Array methods | delegated | See full list above |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from serialized array |
| `$serialize(value)` | returns serialized array | Transform without allocating |
| `$deserialize(value)` | returns inline array | Transform without allocating |
| `$shape` | `"multiple"` | Shape discriminator |
