# Mapping

A key-value record (`Record<K, V>`). Keys can be strings or numbers.

## Import

```ts
import { Mapping } from "@ddd-ts/shape";
```

## Usage

```ts
// Record<string, number> — key type defaults to string
class Scores extends Mapping([Number]) {}

const scores = new Scores({ alice: 10, bob: 20 });
scores.value;       // { alice: 10, bob: 20 }
scores.serialize(); // { alice: 10, bob: 20 }

const restored = Scores.deserialize({ alice: 10, bob: 20 });
```

## Explicit key type

```ts
// Record<number, { label: string }>
class Labels extends Mapping([Number, { label: String }]) {}
```

The first element of the config tuple is the key constructor (`String` or `Number`), the second is the value shape. When only one element is provided, the key defaults to `String`.

## With named shapes

```ts
class UserScore extends Primitive(Number) {}
class ScoreBoard extends Mapping([String, UserScore]) {}

const board = ScoreBoard.deserialize({ alice: 10, bob: 20 });
board.value["alice"] instanceof UserScore; // true
```

## Inline in Dict

```ts
class Dashboard extends Dict({
  scores: Mapping([Number]),
  labels: Mapping([Number, { text: String }]),
}) {}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | `Record<K, V>` | The underlying record |
| `serialize()` | serialized record | Recursively serialize values |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from plain record |
| `$serialize(value)` | serialized record | Transform without allocating |
| `$deserialize(value)` | inline record | Transform without allocating |
| `$shape` | `"mapping"` | Shape discriminator |
