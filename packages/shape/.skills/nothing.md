# Nothing

A shape with no data. Useful for marker types, events with no payload, or unit-like constructs.

## Import

```ts
import { Nothing } from "@ddd-ts/shape";
```

## Usage

```ts
class Ping extends Nothing() {}

const ping = new Ping();
ping.serialize(); // undefined

const restored = Ping.deserialize();
restored instanceof Ping; // true
```

## Shorthand

`undefined` can be used directly inside `Dict`:

```ts
class Event extends Dict({
  type: "ping",
  payload: undefined, // shorthand for Nothing()
}) {}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `serialize()` | `void` | Returns undefined |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize()` | returns instance | Reconstruct (no argument needed) |
| `$serialize()` | `void` | No-op |
| `$deserialize()` | `void` | No-op |
| `$shape` | `"nothing"` | Shape discriminator |
