# Optional

A value that can be `T | undefined`. Provides `.match()` for safe access without null checks.

## Import

```ts
import { Optional } from "@ddd-ts/shape";
```

## Usage

```ts
class Nickname extends Optional(String) {}

const some = new Nickname("Bob");
const none = new Nickname(undefined);

some.value; // "Bob"
none.value; // undefined

some.serialize(); // "Bob"
none.serialize(); // undefined
```

## Pattern matching

```ts
some.match({
  some: (value) => `Hello, ${value}`,
  none: () => "Anonymous",
}); // "Hello, Bob"

none.match({
  some: (value) => `Hello, ${value}`,
  none: () => "Anonymous",
}); // "Anonymous"
```

## Inline in Dict

```ts
class User extends Dict({
  name: String,
  nickname: Optional(String),
  bio: Optional({ text: String, link: String }),
}) {}

const user = User.deserialize({ name: "Alice", nickname: undefined, bio: undefined });
user.nickname; // undefined
```

## With named shapes

```ts
class Email extends Primitive(String) {}
class OptionalEmail extends Optional(Email) {}

const email = OptionalEmail.deserialize("alice@example.com");
// email.value is an Email instance when present, undefined otherwise
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | `T \| undefined` | The wrapped value or undefined |
| `serialize()` | serialized or undefined | Serialize if present |
| `match({ some, none })` | return type of handlers | Pattern match on presence |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct from value or undefined |
| `$serialize(value)` | serialized or undefined | Transform without allocating |
| `$deserialize(value)` | inline or undefined | Transform without allocating |
| `$shape` | `"optional"` | Shape discriminator |
