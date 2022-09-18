# @ddd-ts/value

Eases creation of value objects.

## Installation

```bash
yarn add @ddd-ts/value
```

or

```bash
npm install @ddd-ts/value
```

## Features

- [x] string/number primitives
- [x] serialization/deserialization
- [x] composition
- [x] inheritance
- [ ] validation on deserialization
- [ ] optionnal ? not sure if support will be needed

## Usage

> For an exhaustive list of usages, please refer to the test file

import :

```ts
import { Value } from "@ddd-ts/value";
```

string :

```ts
class TaskName extends Value(String) {}
```

number :

```ts
class Duration extends Value(Number) {
  static aMinute() {
    return new Duration(60);
  }

  multiply(multiplier: number) {
    return new Duration(this.value * multiplier);
  }
}
```

list :

```ts
class Groceries extends Value([String]) {
  get size() {
    return this.value.length;
  }

  get estimatedShoppingDuration() {
    return Duration.aMinute().multiply(this.size);
  }
}
```

composite with primitives :

```ts
class GeoCoordinates extends Value({ lat: Number, lon: Number }) {
  static EARTH_RADIUS = 6_371_000;

  distanceFrom(other: GeoCoordinates) {
    // ...
  }
}
```

composite with values :

```ts
class Travel extends Value({
  origin: GeoCoordinates,
  destination: GeoCoordinates,
}) {
  get distance() {
    const { origin, destination } = this.value;

    return origin.distanceFrom(destination);
  }
}
```

serialization / deserialization :

```ts
const name = TaskName.deserialize("Documentation");
name.serialize(); // Documentation
```

validation :

```ts
class TaskName extends Value(String) {
  ensureValidity() {
    if (this.value.length > 10) {
      throw new Error("Task name too long !");
    }
  }
}

TaskName.deserialize("This task name is too long...").ensureValidity();
```
