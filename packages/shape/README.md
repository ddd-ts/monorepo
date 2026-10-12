# @ddd-ts/shape

Type-safe, serializable data shapes for TypeScript. Define your models once, get automatic serialization, deserialization, and full type inference.

## Install

```bash
npm install @ddd-ts/shape
```

## Quick start

```ts
import { Dict, Primitive, Optional, Choice, Multiple } from "@ddd-ts/shape";

class User extends Dict({
  name: String,
  age: Number,
  email: Optional(String),
  role: Choice(["admin", "user", "guest"]),
  tags: [String],
}) {}

// Instantiate
const user = new User({
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  role: "admin",
  tags: ["staff"],
});

// Serialize (to plain JSON-safe object)
user.serialize();
// { name: "Alice", age: 30, email: "alice@example.com", role: "admin", tags: ["staff"] }

// Deserialize (from plain object back to typed instance)
const restored = User.deserialize({
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  role: "admin",
  tags: ["staff"],
});
restored instanceof User; // true
```

All types are fully inferred. The constructor, `serialize()`, and `deserialize()` are all type-checked.

## Shapes

### Primitive

Wraps a single primitive value: `String`, `Number`, `Boolean`, or `Date`.

```ts
import { Primitive } from "@ddd-ts/shape";

class UserId extends Primitive(String) {}

const id = new UserId("usr_123");
id.value;       // "usr_123"
id.serialize();  // "usr_123"

const restored = UserId.deserialize("usr_123");
restored.value; // "usr_123"
```

Date primitives are automatically coerced from strings during deserialization:

```ts
class CreatedAt extends Primitive(Date) {}

const date = CreatedAt.deserialize("2024-01-01T00:00:00Z");
date.value; // Date instance
```

#### Shorthand

Primitives can be used directly as shorthand inside `Dict`:

```ts
class User extends Dict({
  name: String,    // shorthand for Primitive(String)
  age: Number,     // shorthand for Primitive(Number)
  active: Boolean, // shorthand for Primitive(Boolean)
  born: Date,      // shorthand for Primitive(Date)
}) {}
```

### Dict

A structured object with named, typed fields. Fields are accessed directly on the instance (not under `.value`).

```ts
import { Dict } from "@ddd-ts/shape";

class Address extends Dict({
  street: String,
  city: String,
  zip: Number,
}) {}

const addr = new Address({ street: "123 Main", city: "Paris", zip: 75001 });
addr.street; // "123 Main"
addr.city;   // "Paris"
addr.serialize(); // { street: "123 Main", city: "Paris", zip: 75001 }
```

Dicts can be nested:

```ts
class User extends Dict({
  name: String,
  address: Address,
}) {}

// Construct with instances
const user = new User({ name: "Alice", address: new Address({ street: "123 Main", city: "Paris", zip: 75001 }) });

// Deserialize from plain objects
const restored = User.deserialize({ name: "Alice", address: { street: "123 Main", city: "Paris", zip: 75001 } });
restored.address instanceof Address; // true
```

Inline nested objects are also supported (anonymous dicts):

```ts
class User extends Dict({
  name: String,
  address: { street: String, city: String },
}) {}
```

### Literal

A constant string or number value.

```ts
import { Literal } from "@ddd-ts/shape";

class Version extends Literal("v1") {}

const v = new Version("v1");
v.value;       // "v1"
v.serialize(); // "v1"
```

Literals can also be used as shorthand inside `Dict`:

```ts
class Event extends Dict({
  type: "user_created",  // shorthand for Literal("user_created")
  userId: String,
}) {}
```

### Nothing

A shape with no data. Useful for marker types or events with no payload.

```ts
import { Nothing } from "@ddd-ts/shape";

class Ping extends Nothing() {}

const ping = new Ping();
ping.serialize(); // undefined

const restored = Ping.deserialize();
```

`undefined` can be used as shorthand inside `Dict`:

```ts
class Event extends Dict({
  type: "ping",
  payload: undefined, // shorthand for Nothing()
}) {}
```

### Multiple

A typed array of elements.

```ts
import { Multiple } from "@ddd-ts/shape";

class Tags extends Multiple(String) {}

const tags = new Tags(["typescript", "ddd"]);
tags.value;      // ["typescript", "ddd"]
tags.serialize(); // ["typescript", "ddd"]
tags.length;      // 2

// Array methods are available directly
tags.map((t) => t.toUpperCase()); // ["TYPESCRIPT", "DDD"]
tags.filter((t) => t.startsWith("t")); // ["typescript"]
tags.includes("ddd"); // true

for (const tag of tags) {
  console.log(tag);
}
```

Array shorthand uses bracket syntax inside `Dict`:

```ts
class User extends Dict({
  tags: [String],                   // shorthand for Multiple(String)
  scores: [Number],                 // shorthand for Multiple(Number)
  addresses: [{ city: String }],    // array of anonymous dicts
}) {}
```

### Optional

A value that can be `T | undefined`. Provides a `.match()` method for safe access.

```ts
import { Optional } from "@ddd-ts/shape";

class Nickname extends Optional(String) {}

const some = new Nickname("Bob");
const none = new Nickname(undefined);

some.value; // "Bob"
none.value; // undefined

some.match({
  some: (value) => `Hello, ${value}`,
  none: () => "Anonymous",
}); // "Hello, Bob"

none.match({
  some: (value) => `Hello, ${value}`,
  none: () => "Anonymous",
}); // "Anonymous"
```

### Choice

One value from a fixed set of string options. Provides `.is()` for narrowing and `.match()` for branching.

```ts
import { Choice } from "@ddd-ts/shape";

class Status extends Choice(["active", "inactive", "banned"]) {}

const status = new Status("active");
status.value;       // "active"
status.serialize(); // "active"

// Type narrowing
if (status.is("active")) {
  status.value; // narrowed to "active"
}

// Pattern matching
status.match({
  active: () => "green",
  inactive: () => "gray",
  banned: () => "red",
}); // "green"

// Fallback matching
status.match({
  active: () => "green",
  _: () => "other",
}); // "green"

// Static factory methods
Status.active();   // new Status("active")
Status.inactive(); // new Status("inactive")
Status.banned();   // new Status("banned")
```

### Either

A tagged union where the value is one of several named class variants. Serializes with a `_key` discriminator.

```ts
import { Either, Dict } from "@ddd-ts/shape";

class Success extends Dict({ message: String }) {}
class Failure extends Dict({ code: Number, reason: String }) {}

class Result extends Either({ Success, Failure }) {}

// Construct
const ok = new Result(new Success({ message: "done" }));
const err = new Result(new Failure({ code: 404, reason: "Not found" }));

// Serialize
ok.serialize();  // { _key: "Success", message: "done" }
err.serialize(); // { _key: "Failure", code: 404, reason: "Not found" }

// Deserialize
const restored = Result.deserialize({ _key: "Success", message: "done" });
restored.value instanceof Success; // true

// Pattern matching
ok.match({
  Success: (s) => s.message,
  Failure: (f) => f.reason,
}); // "done"

// Partial match with fallback
ok.match(
  { Failure: (f) => f.reason },
  () => "ok",
); // "ok"

// Fallthrough match
ok.match({
  _: (value) => "something",
}); // "something"
```

### DiscriminatedUnion

A union of shapes that share a common discriminator field. The discriminator key is detected automatically.

```ts
import { DiscriminatedUnion, Dict } from "@ddd-ts/shape";

class Created extends Dict({ type: "created", name: String }) {}
class Deleted extends Dict({ type: "deleted", id: Number }) {}

class Event extends DiscriminatedUnion([Created, Deleted]) {}

// Construct
const evt = new Event(new Created({ type: "created", name: "Alice" }));

// Serialize
evt.serialize(); // { type: "created", name: "Alice" }

// Deserialize
const restored = Event.deserialize({ type: "deleted", id: 42 });

// Pattern matching
evt.match({
  created: (e) => e.name,
  deleted: (e) => e.id,
});
```

You can also mix named classes with anonymous dict shorthands:

```ts
class Created extends Dict({ type: "created", name: String }) {}

class Event extends DiscriminatedUnion([
  Created,
  { type: "deleted" as const, id: Number },
]) {}
```

### Mapping

A key-value record (like `Record<K, V>`).

```ts
import { Mapping, Primitive } from "@ddd-ts/shape";

// Record<string, number>
class Scores extends Mapping([Primitive(Number)]) {}

const scores = new Scores({ alice: 10, bob: 20 });
scores.value;       // { alice: 10, bob: 20 }
scores.serialize(); // { alice: 10, bob: 20 }

// With explicit key type: Record<number, string>
class Labels extends Mapping([Number, { label: String }]) {}
```

### Class

Wraps an existing class that already has `serialize()` and `static deserialize()` methods.

```ts
import { Class, Dict } from "@ddd-ts/shape";

class Money {
  constructor(public amount: number, public currency: string) {}

  serialize() {
    return { amount: this.amount, currency: this.currency };
  }

  static deserialize(data: { amount: number; currency: string }) {
    return new Money(data.amount, data.currency);
  }
}

class Product extends Dict({
  name: String,
  price: Class(Money),
}) {}

const product = Product.deserialize({ name: "Book", price: { amount: 10, currency: "EUR" } });
product.price instanceof Money; // true
```

## Composition

Shapes compose naturally. Any shape can be used inside another:

```ts
class Email extends Primitive(String) {
  get domain() {
    return this.value.split("@")[1];
  }
}

class Role extends Choice(["admin", "user"]) {}

class User extends Dict({
  email: Email,
  role: Role,
  scores: Mapping([Number]),
  tags: [String],
  nickname: Optional(String),
}) {}
```

When a named class is used as a field in a `Dict`:
- **Constructor** expects an instance of that class
- **`deserialize()`** accepts the serialized form and reconstructs the instance
- **`serialize()`** recursively serializes nested shapes

## Adding behavior

Since shapes are classes, you can add methods and properties:

```ts
class Temperature extends Primitive(Number) {
  toFahrenheit() {
    return this.value * 9 / 5 + 32;
  }

  static fromFahrenheit(f: number) {
    return new this((f - 32) * 5 / 9);
  }
}

class Range extends Dict({ min: Number, max: Number }) {
  get span() {
    return this.max - this.min;
  }

  contains(value: number) {
    return value >= this.min && value <= this.max;
  }
}
```

## Static serialization

Every shape provides static `$serialize` and `$deserialize` methods that transform values without constructing instances:

```ts
class User extends Dict({ name: String, age: Number }) {}

// Transform a plain value without wrapping it in a User instance
User.$deserialize({ name: "Alice", age: 30 }); // { name: "Alice", age: 30 }
User.$serialize({ name: "Alice", age: 30 });    // { name: "Alice", age: 30 }
```

This is useful when you need to transform data at the boundary without allocating instances.
