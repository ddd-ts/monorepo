# Choice

One value from a fixed set of string options. Provides `.is()` for type narrowing, `.match()` for branching, and static factory methods for each option.

## Import

```ts
import { Choice } from "@ddd-ts/shape";
```

## Usage

```ts
class Status extends Choice(["active", "inactive", "banned"]) {}

const status = new Status("active");
status.value;       // "active"
status.serialize(); // "active"

const restored = Status.deserialize("active");
```

## Type narrowing with `.is()`

```ts
if (status.is("active")) {
  status.value; // narrowed to "active"
}
```

## Pattern matching

Exhaustive:

```ts
status.match({
  active: () => "green",
  inactive: () => "gray",
  banned: () => "red",
}); // "green"
```

With fallthrough:

```ts
status.match({
  active: () => "green",
  _: () => "other",
}); // "green"
```

## Static factory methods

Each choice value gets a static factory method on the class:

```ts
Status.active();   // new Status("active")
Status.inactive(); // new Status("inactive")
Status.banned();   // new Status("banned")
```

## Inline in Dict

```ts
class User extends Dict({
  name: String,
  role: Choice(["admin", "user", "guest"]),
}) {}
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | union of the options | The current value |
| `serialize()` | union of the options | Returns the value |
| `is(option)` | boolean (type guard) | Narrow the type |
| `match(matcher)` | return type of handlers | Branch on value |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from string |
| `[option]()` | returns instance | Factory for each option |
| `values` | the options array | The original list of choices |
| `$serialize(value)` | the value | Identity |
| `$deserialize(value)` | the value | Identity |
| `$shape` | `"choice"` | Shape discriminator |
| `$of` | the options array | The original list of choices |
